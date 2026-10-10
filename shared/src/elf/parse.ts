import type { ParseIssue, ParseMode } from "../binary/errors.ts";
import { BinaryParseError } from "../binary/errors.ts";
import { BinaryReader, safeAdd } from "../binary/reader.ts";
import type {
  ElfDynamicEntry,
  ElfHeader,
  ElfParseResult,
  ElfProgramHeader,
  ElfRelocation,
  ElfSectionHeader,
  ElfSymbol,
} from "./types.ts";
import { parseElfVersions, symbolVersionName } from "./version.ts";

const E_TYPE: Record<number, string> = {
  0: "NONE",
  1: "REL",
  2: "EXEC",
  3: "DYN",
  4: "CORE",
};
const E_MACHINE: Record<number, string> = {
  0x03: "x86",
  0x3e: "x64",
  0x28: "ARM",
  0xb7: "AArch64",
  0xf3: "RISC-V",
};
const P_TYPE: Record<number, string> = {
  0: "PT_NULL",
  1: "PT_LOAD",
  2: "PT_DYNAMIC",
  3: "PT_INTERP",
  4: "PT_NOTE",
  6: "PT_PHDR",
  0x6474e552: "PT_GNU_STACK",
  0x6474e550: "PT_GNU_RELRO",
};
const SHT: Record<number, string> = {
  0: "SHT_NULL",
  1: "SHT_PROGBITS",
  2: "SHT_SYMTAB",
  3: "SHT_STRTAB",
  4: "SHT_RELA",
  5: "SHT_HASH",
  6: "SHT_DYNAMIC",
  7: "SHT_NOTE",
  8: "SHT_NOBITS",
  9: "SHT_REL",
  11: "SHT_DYNSYM",
  0x6ffffff6: "SHT_GNU_HASH",
  0x6ffffffe: "SHT_VERSYM",
  0x6fffffff: "SHT_VERNEED",
};
const DT: Record<number, string> = {
  0: "DT_NULL",
  1: "DT_NEEDED",
  2: "DT_PLTRELSZ",
  3: "DT_PLTGOT",
  4: "DT_HASH",
  5: "DT_STRTAB",
  6: "DT_SYMTAB",
  7: "DT_RELA",
  8: "DT_RELASZ",
  10: "DT_STRSZ",
  11: "DT_SYMENT",
  12: "DT_INIT",
  13: "DT_FINI",
  23: "DT_JMPREL",
  0x6ffffef5: "DT_GNU_HASH",
};

const ST_BIND = ["LOCAL", "GLOBAL", "WEAK"];
const ST_TYPE = ["NOTYPE", "OBJECT", "FUNC", "SECTION", "FILE"];

export function parseElf(
  buffer: ArrayBuffer | Uint8Array,
  mode: ParseMode = "lenient",
): ElfParseResult {
  const issues: ParseIssue[] = [];
  const r = new BinaryReader(buffer);
  const push = (issue: ParseIssue) => {
    if (mode === "strict" && issue.severity === "error") throw new BinaryParseError(issue.message, issue.code, issue.offset);
    issues.push(issue);
  };

  if (!r.matchAt(0, [0x7f, 0x45, 0x4c, 0x46])) {
    push({ severity: "error", code: "not_elf", message: "Missing ELF magic" });
    throw new BinaryParseError("Not ELF", "not_elf");
  }

  const klass = r.readU8(4) === 2 ? 64 : 32;
  const endian = r.readU8(5) === 1 ? "LE" : "BE";
  r.endian = endian === "LE" ? "le" : "be";

  const header: ElfHeader = {
    class: klass,
    endian,
    version: r.readU8(6),
    osabi: r.readU8(7),
    abiVersion: r.readU8(8),
    type: 0,
    typeName: "",
    machine: 0,
    machineName: "",
    entry: 0n,
    phoff: 0n,
    shoff: 0n,
    flags: 0,
    ehsize: 0,
    phentsize: 0,
    phnum: 0,
    shentsize: 0,
    shnum: 0,
    shstrndx: 0,
  };

  r.seek(16);
  header.type = r.readU16();
  header.typeName = E_TYPE[header.type] ?? `0x${header.type.toString(16)}`;
  header.machine = r.readU16();
  header.machineName = E_MACHINE[header.machine] ?? `0x${header.machine.toString(16)}`;
  header.version = r.readU32();
  header.entry = klass === 64 ? r.readU64() : BigInt(r.readU32());
  header.phoff = klass === 64 ? r.readU64() : BigInt(r.readU32());
  header.shoff = klass === 64 ? r.readU64() : BigInt(r.readU32());
  header.flags = r.readU32();
  header.ehsize = r.readU16();
  header.phentsize = r.readU16();
  header.phnum = r.readU16();
  header.shentsize = r.readU16();
  header.shnum = r.readU16();
  header.shstrndx = r.readU16();

  if (header.phnum > 1024 || header.shnum > 8192) {
    push({ severity: "error", code: "absurd_count", message: "Suspicious phnum/shnum" });
  }

  const programHeaders: ElfProgramHeader[] = [];
  let interpreter: string | null = null;

  const phoff = Number(header.phoff);
  for (let i = 0; i < header.phnum; i++) {
    const off = safeAdd(phoff, i * header.phentsize);
    if (off === null || off + header.phentsize > r.length) {
      push({ severity: "warning", code: "phdr_truncated", message: `Program header ${i} OOB`, offset: off ?? phoff });
      break;
    }
    const pr = r.fork(off);
    const type = pr.readU32();
    const ph: ElfProgramHeader = {
      type,
      typeName: P_TYPE[type] ?? `PT_0x${type.toString(16)}`,
      flags: 0,
      offset: 0n,
      vaddr: 0n,
      paddr: 0n,
      filesz: 0n,
      memsz: 0n,
      align: 0n,
    };
    if (klass === 64) {
      ph.flags = pr.readU32();
      ph.offset = pr.readU64();
      ph.vaddr = pr.readU64();
      ph.paddr = pr.readU64();
      ph.filesz = pr.readU64();
      ph.memsz = pr.readU64();
      ph.align = pr.readU64();
    } else {
      ph.offset = BigInt(pr.readU32());
      ph.vaddr = BigInt(pr.readU32());
      ph.paddr = BigInt(pr.readU32());
      ph.filesz = BigInt(pr.readU32());
      ph.memsz = BigInt(pr.readU32());
      ph.align = BigInt(pr.readU32());
    }
    if (ph.memsz < ph.filesz) {
      push({ severity: "warning", code: "phdr_memsz", message: `PT_LOAD memsz < filesz (#${i})`, heuristic: true });
    }
    programHeaders.push(ph);
    if (type === 3 && ph.filesz > 0n) {
      try {
        interpreter = r.readCStringAt(Number(ph.offset), Number(ph.filesz));
      } catch {
        push({ severity: "warning", code: "interp_bad", message: "Could not read PT_INTERP" });
      }
    }
  }

  const sectionHeaders: ElfSectionHeader[] = [];
  const shoff = Number(header.shoff);
  let shstrOffset = 0;

  for (let i = 0; i < header.shnum; i++) {
    const off = safeAdd(shoff, i * header.shentsize);
    if (off === null || off + header.shentsize > r.length) break;
    const sr = r.fork(off);
    const sh_name = sr.readU32();
    const sh_type = sr.readU32();
    const sh: ElfSectionHeader = {
      index: i,
      nameIndex: sh_name,
      name: "",
      type: sh_type,
      typeName: SHT[sh_type] ?? `SHT_0x${sh_type.toString(16)}`,
      flags: 0n,
      addr: 0n,
      offset: 0n,
      size: 0n,
      link: 0,
      info: 0,
      addralign: 0n,
      entsize: 0n,
      fileBackedSize: 0n,
      isNobits: sh_type === 8,
    };
    if (klass === 64) {
      sh.flags = sr.readU64();
      sh.addr = sr.readU64();
      sh.offset = sr.readU64();
      sh.size = sr.readU64();
      sh.link = sr.readU32();
      sh.info = sr.readU32();
      sh.addralign = sr.readU64();
      sh.entsize = sr.readU64();
    } else {
      sh.flags = BigInt(sr.readU32());
      sh.addr = BigInt(sr.readU32());
      sh.offset = BigInt(sr.readU32());
      sh.size = BigInt(sr.readU32());
      sh.link = sr.readU32();
      sh.info = sr.readU32();
      sh.addralign = BigInt(sr.readU32());
      sh.entsize = BigInt(sr.readU32());
    }
    sh.fileBackedSize = sh.isNobits ? 0n : sh.size;
    sectionHeaders.push(sh);
  }

  if (header.shstrndx < sectionHeaders.length) {
    shstrOffset = Number(sectionHeaders[header.shstrndx]?.offset ?? 0);
    for (const sh of sectionHeaders) {
      try {
        sh.name = r.readStringTable(shstrOffset, sh.nameIndex, 128);
      } catch {
        sh.name = `section_${sh.index}`;
      }
    }
  } else {
    for (const sh of sectionHeaders) sh.name = `section_${sh.index}`;
  }

  const dynstr = sectionHeaders.find((s) => s.name === ".dynstr");
  const versions =
    dynstr && dynstr.size > 0n
      ? parseElfVersions(r, sectionHeaders, Number(dynstr.offset), klass)
      : null;

  const symbols: ElfSymbol[] = [];
  const parseSymtab = (sh: ElfSectionHeader, dynsym: boolean) => {
    const strSh = sectionHeaders[sh.link];
    if (!strSh) return;
    const strOff = Number(strSh.offset);
    const ent = Number(sh.entsize) || (klass === 64 ? 24 : 16);
    const count = Number(sh.size) / ent;
    if (count > 100_000) {
      push({ severity: "warning", code: "symtab_huge", message: `${sh.name} too many symbols` });
      return;
    }
    for (let i = 0; i < count; i++) {
      const so = Number(sh.offset) + i * ent;
      if (so + ent > r.length) break;
      const sym = parseSymbol(r, so, klass, strOff, dynsym);
      const sec =
        sym.shndx > 0 && sym.shndx < sectionHeaders.length
          ? sectionHeaders[sym.shndx]?.name
          : undefined;
      const versionName =
        dynsym && versions ? symbolVersionName(versions, i) : undefined;
      symbols.push({ ...sym, sectionName: sec, versionName });
    }
  };

  for (const sh of sectionHeaders) {
    if (sh.type === 2) parseSymtab(sh, false);
    if (sh.type === 11) parseSymtab(sh, true);
  }

  const dynamic: ElfDynamicEntry[] = [];
  const dynSh = sectionHeaders.find((s) => s.type === 6);
  if (dynSh) {
    const ent = klass === 64 ? 16 : 8;
    const count = Number(dynSh.size) / ent;
    for (let i = 0; i < count; i++) {
      const doff = Number(dynSh.offset) + i * ent;
      if (doff + ent > r.length) break;
      const dr = r.fork(doff);
      const tag = klass === 64 ? Number(dr.readU64()) : dr.readU32();
      const value = klass === 64 ? dr.readU64() : BigInt(dr.readU32());
      dynamic.push({ tag, tagName: DT[tag] ?? `DT_0x${tag.toString(16)}`, value });
      if (tag === 0) break;
    }
  }

  const relocations: ElfRelocation[] = [];
  for (const sh of sectionHeaders) {
    if (sh.type !== 4 && sh.type !== 9) continue;
    const rela = sh.type === 4;
    const ent = Number(sh.entsize) || (rela ? (klass === 64 ? 24 : 16) : klass === 64 ? 16 : 8);
    const count = Math.min(Number(sh.size) / ent, 50_000);
    for (let i = 0; i < count; i++) {
      const ro = Number(sh.offset) + i * ent;
      if (ro + ent > r.length) break;
      const rr = r.fork(ro);
      const offset = klass === 64 ? rr.readU64() : BigInt(rr.readU32());
      const info = klass === 64 ? rr.readU64() : BigInt(rr.readU32());
      const sym = klass === 64 ? Number(info >> 32) : Number(info >> 8);
      const type = klass === 64 ? Number(info & 0xffffffffn) : Number(info & 0xffn);
      const rel: ElfRelocation = {
        offset,
        info,
        sym,
        type,
        rela,
        sectionIndex: sh.index,
      };
      if (rela) rel.addend = klass === 64 ? rr.readU64() : BigInt(rr.readU32());
      relocations.push(rel);
    }
  }

  const gnuHashSh = sectionHeaders.find((s) => s.type === 0x6ffffff6);
  const gnuHash = gnuHashSh
    ? { present: true, bucket: Number(gnuHashSh.size), symoffset: Number(gnuHashSh.offset) }
    : { present: false };

  return {
    ok: !issues.some((i) => i.severity === "error"),
    header,
    programHeaders,
    sectionHeaders,
    symbols,
    dynamic,
    relocations,
    versions,
    interpreter,
    gnuHash,
    issues,
  };
}

function parseSymbol(
  r: BinaryReader,
  offset: number,
  klass: 32 | 64,
  strtab: number,
  fromDynsym: boolean,
): ElfSymbol {
  const sr = r.fork(offset);
  const nameIdx = sr.readU32();
  let value: bigint;
  let size: bigint;
  let info: number;
  let shndx: number;
  if (klass === 64) {
    value = sr.readU64();
    size = sr.readU64();
    info = sr.readU8();
    shndx = sr.readU16();
  } else {
    value = BigInt(sr.readU32());
    size = BigInt(sr.readU32());
    info = sr.readU8();
    shndx = sr.readU16();
  }
  const bind = ST_BIND[(info >> 4) & 3] ?? String((info >> 4) & 3);
  const type = ST_TYPE[info & 0xf] ?? String(info & 0xf);
  let name = "";
  try {
    name = r.readStringTable(strtab, nameIdx, 256);
  } catch {
    name = `sym_${nameIdx}`;
  }
  return { name, value, size, bind, type, shndx, fromDynsym };
}
