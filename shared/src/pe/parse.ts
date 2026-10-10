import type { ParseIssue, ParseMode } from "../binary/errors.ts";
import { BinaryParseError } from "../binary/errors.ts";
import { BinaryReader, safeAdd } from "../binary/reader.ts";
import type {
  CoffHeader,
  DataDirectoryEntry,
  DosHeader,
  PeExportEntry,
  PeImportEntry,
  PeParseResult,
  PeSection,
} from "./types.ts";
import { DATA_DIR_NAMES } from "./types.ts";
import { peRvaToFile, buildPeAddressSpace } from "./address.ts";
import { parsePeRelocBlocks } from "./relocs.ts";
import { parsePeResources } from "./resources.ts";

const MACHINE: Record<number, string> = {
  0x014c: "x86",
  0x8664: "x64",
  0xaa64: "ARM64",
};
const SUBSYS: Record<number, string> = {
  1: "Native",
  2: "Windows GUI",
  3: "Windows CUI",
  10: "EFI Application",
};

function secPermissions(c: number): string {
  const r = [] as string[];
  if (c & 0x20000000) r.push("X");
  if (c & 0x40000000) r.push("R");
  if (c & 0x80000000) r.push("W");
  return r.join("") || "-";
}

export function parsePe(
  buffer: ArrayBuffer | Uint8Array,
  mode: ParseMode = "lenient",
): PeParseResult {
  const issues: ParseIssue[] = [];
  const push = (issue: ParseIssue) => {
    if (mode === "strict" && issue.severity === "error") {
      throw new BinaryParseError(issue.message, issue.code, issue.offset);
    }
    issues.push(issue);
  };

  const r = new BinaryReader(buffer, "le");
  if (r.readU16(0) !== 0x5a4d) {
    throw new BinaryParseError("Missing MZ", "not_pe");
  }

  const e_lfanew = r.readU32(0x3c);
  const dos: DosHeader = {
    magic: 0x5a4d,
    cblp: r.readU16(2),
    e_lfanew,
    stubSize: Math.max(0, e_lfanew - 0x40),
  };

  if (dos.e_lfanew <= 0 || dos.e_lfanew + 4 > r.length) {
    push({ severity: "error", code: "pe_sig_oob", message: "Invalid e_lfanew" });
    throw new BinaryParseError("Invalid PE offset", "pe_sig_oob");
  }

  const peSig = r.readU32(dos.e_lfanew);
  if (peSig !== 0x00004550) {
    throw new BinaryParseError("Missing PE signature", "no_pe_sig");
  }

  const coffOff = dos.e_lfanew + 4;
  const coff: CoffHeader = {
    machine: r.readU16(coffOff),
    machineName: "",
    numberOfSections: r.readU16(coffOff + 2),
    timeDateStamp: r.readU32(coffOff + 4),
    pointerToSymbolTable: r.readU32(coffOff + 8),
    numberOfSymbols: r.readU32(coffOff + 12),
    sizeOfOptionalHeader: r.readU16(coffOff + 16),
    characteristics: r.readU16(coffOff + 18),
  };
  coff.machineName = MACHINE[coff.machine] ?? `0x${coff.machine.toString(16)}`;

  if (coff.numberOfSections > 512) {
    push({ severity: "error", code: "too_many_sections", message: "Too many sections" });
  }

  const optOff = coffOff + 20;
  const magic = r.readU16(optOff);
  const isPe32Plus = magic === 0x20b;
  const isPe32 = magic === 0x10b;
  if (!isPe32 && !isPe32Plus) {
    throw new BinaryParseError("Unknown optional magic", "bad_optional");
  }

  const entryPointRva = r.readU32(optOff + 16);
  let imageBase: bigint;
  let sectionAlignment: number;
  let fileAlignment: number;
  let sizeOfImage: number;
  let sizeOfHeaders: number;
  let subsystem: number;
  let dataDirOff: number;

  if (isPe32Plus) {
    imageBase = r.readU64(optOff + 24);
    sectionAlignment = r.readU32(optOff + 32);
    fileAlignment = r.readU32(optOff + 36);
    sizeOfImage = r.readU32(optOff + 56);
    sizeOfHeaders = r.readU32(optOff + 60);
    subsystem = r.readU16(optOff + 68);
    dataDirOff = optOff + 112;
  } else {
    imageBase = BigInt(r.readU32(optOff + 28));
    sectionAlignment = r.readU32(optOff + 32);
    fileAlignment = r.readU32(optOff + 36);
    sizeOfImage = r.readU32(optOff + 56);
    sizeOfHeaders = r.readU32(optOff + 60);
    subsystem = r.readU16(optOff + 68);
    dataDirOff = optOff + 96;
  }

  const sections: PeSection[] = [];
  const secTable = optOff + coff.sizeOfOptionalHeader;
  for (let i = 0; i < coff.numberOfSections; i++) {
    const off = safeAdd(secTable, i * 40);
    if (off === null || off + 40 > r.length) {
      push({ severity: "warning", code: "section_truncated", message: `Section ${i} truncated` });
      break;
    }
    const nameBytes = r.readBytes(8, off);
    const name = new TextDecoder("ascii").decode(nameBytes).replace(/\0/g, "");
    const virtualSize = r.readU32(off + 8);
    const virtualAddress = r.readU32(off + 12);
    const sizeOfRawData = r.readU32(off + 16);
    const pointerToRawData = r.readU32(off + 20);
    const characteristics = r.readU32(off + 36);
    if (virtualSize < sizeOfRawData) {
      push({
        severity: "warning",
        code: "sec_size_mismatch",
        message: `${name}: RawData > VirtualSize`,
        heuristic: true,
      });
    }
    if (pointerToRawData + sizeOfRawData > r.length) {
      push({ severity: "warning", code: "sec_oob", message: `${name} extends past file` });
    }
    sections.push({
      name,
      virtualSize,
      virtualAddress,
      sizeOfRawData,
      pointerToRawData,
      characteristics,
      permissions: secPermissions(characteristics),
    });
  }

  const space = buildPeAddressSpace(imageBase, sections, sizeOfHeaders, issues);

  const dataDirectories: DataDirectoryEntry[] = [];
  for (let i = 0; i < 16; i++) {
    const doff = dataDirOff + i * 8;
    const rva = r.readU32(doff);
    const size = r.readU32(doff + 4);
    let fileOffset: number | null = null;
    let valid = true;
    if (rva !== 0 || size !== 0) {
      const res = peRvaToFile(space, rva);
      if (res.status === "mapped" || res.status === "header") {
        fileOffset = res.fileOffset ?? null;
      } else {
        valid = false;
        push({
          severity: "warning",
          code: "datadir_invalid",
          message: `DataDirectory[${i}] RVA 0x${rva.toString(16)} unmapped`,
          heuristic: true,
        });
      }
      if (fileOffset !== null && safeAdd(fileOffset, size) !== null) {
        const end = fileOffset! + size;
        if (end > r.length) valid = false;
      }
    }
    dataDirectories.push({
      index: i,
      name: DATA_DIR_NAMES[i] ?? `Dir${i}`,
      rva,
      size,
      fileOffset,
      valid,
    });
  }

  const imports = parseImports(r, space, dataDirectories[1], isPe32Plus, push);
  const exports = parseExports(r, space, dataDirectories[0], push);
  const resources = parsePeResources(r, space, dataDirectories[2]);
  const relocBlocks = parsePeRelocBlocks(r, space, dataDirectories[5]);

  return {
    ok: !issues.some((i) => i.severity === "error"),
    dos,
    coff,
    isPe32Plus,
    subsystem,
    subsystemName: SUBSYS[subsystem] ?? String(subsystem),
    imageBase,
    entryPointRva,
    sectionAlignment,
    fileAlignment,
    sizeOfImage,
    sizeOfHeaders,
    sections,
    dataDirectories,
    imports,
    exports,
    resources,
    relocBlocks,
    issues,
  };
}

function parseImports(
  r: BinaryReader,
  space: ReturnType<typeof buildPeAddressSpace>,
  dir: DataDirectoryEntry | undefined,
  is64: boolean,
  push: (i: ParseIssue) => void,
): PeImportEntry[] {
  if (!dir || dir.rva === 0) return [];
  const loc = peRvaToFile(space, dir.rva);
  if (loc.fileOffset === undefined) return [];
  const out: PeImportEntry[] = [];
  let off = loc.fileOffset;
  const ptrSize = is64 ? 8 : 4;

  while (off + 20 <= r.length) {
    const desc = r.fork(off);
    const oft = is64 ? Number(desc.readU64()) : desc.readU32();
    const nameRva = desc.readU32(12);
    const ft = is64 ? Number(desc.readU64(16)) : desc.readU32(16);
    if (oft === 0 && nameRva === 0 && ft === 0) break;

    const nameLoc = peRvaToFile(space, nameRva);
    let dll = "";
    if (nameLoc.fileOffset !== undefined) {
      try {
        dll = r.readCStringAt(nameLoc.fileOffset, 260);
      } catch {
        dll = `dll_rva_0x${nameRva.toString(16)}`;
      }
    }

    const functions: PeImportEntry["functions"] = [];
    const thunkRva = ft || oft;
    const thunkLoc = peRvaToFile(space, thunkRva);
    if (thunkLoc.fileOffset !== undefined) {
      let to = thunkLoc.fileOffset;
      while (to + ptrSize <= r.length) {
        const val = is64 ? r.readU64(to) : BigInt(r.readU32(to));
        if (val === 0n) break;
        const valNum = Number(val);
        if (valNum & (is64 ? 1 << 63 : 1 << 31)) {
          functions.push({
            name: null,
            ordinal: valNum & 0xffff,
            iatRva: thunkRva + (to - thunkLoc.fileOffset!),
          });
        } else {
          const hintLoc = peRvaToFile(space, valNum);
          let fname = "";
          if (hintLoc.fileOffset !== undefined) {
            try {
              fname = r.readCStringAt(hintLoc.fileOffset + 2, 256);
            } catch {
              fname = `import_0x${valNum.toString(16)}`;
            }
          }
          functions.push({
            name: fname,
            ordinal: null,
            iatRva: thunkRva + (to - thunkLoc.fileOffset!),
          });
        }
        to += ptrSize;
        if (functions.length > 4096) break;
      }
    }

    out.push({ dll, functions });
    off += 20;
    if (out.length > 256) {
      push({ severity: "warning", code: "import_cap", message: "Import descriptor limit" });
      break;
    }
  }
  return out;
}

function parseExports(
  r: BinaryReader,
  space: ReturnType<typeof buildPeAddressSpace>,
  dir: DataDirectoryEntry | undefined,
  push: (i: ParseIssue) => void,
): PeExportEntry[] {
  if (!dir || dir.rva === 0 || dir.size < 40) return [];
  const loc = peRvaToFile(space, dir.rva);
  if (loc.fileOffset === undefined) return [];
  const base = loc.fileOffset;
  const numFuncs = r.readU32(base + 20);
  const numNames = r.readU32(base + 24);
  const addrTableRva = r.readU32(base + 28);
  const namePtrRva = r.readU32(base + 32);
  const ordTableRva = r.readU32(base + 36);

  const addrLoc = peRvaToFile(space, addrTableRva);
  const nameLoc = peRvaToFile(space, namePtrRva);
  const ordLoc = peRvaToFile(space, ordTableRva);
  if (addrLoc.fileOffset === undefined) return [];

  const out: PeExportEntry[] = [];
  const count = Math.min(numNames, 8192);
  for (let i = 0; i < count; i++) {
    let name: string | null = null;
    let ordinal = i;
    if (ordLoc.fileOffset !== undefined) {
      ordinal = r.readU16(ordLoc.fileOffset + i * 2);
    }
    if (nameLoc.fileOffset !== undefined) {
      const nrva = r.readU32(nameLoc.fileOffset + i * 4);
      const nloc = peRvaToFile(space, nrva);
      if (nloc.fileOffset !== undefined) {
        try {
          name = r.readCStringAt(nloc.fileOffset, 512);
        } catch {
          name = null;
        }
      }
    }
    const rva = r.readU32(addrLoc.fileOffset + ordinal * 4);
    out.push({ name, ordinal, rva });
  }
  if (numFuncs > 8192) {
    push({ severity: "warning", code: "export_cap", message: "Export table truncated in UI" });
  }
  return out;
}
