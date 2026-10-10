import type { BinaryReader } from "../binary/reader.ts";
import type { PeAddressSpace } from "./address.ts";
import { peRvaToFile } from "./address.ts";
import type {
  DataDirectoryEntry,
  PeDebugEntry,
  PeDelayImportDll,
  PeTlsInfo,
} from "./types.ts";

const DEBUG_TYPES: Record<number, string> = {
  0: "UNKNOWN",
  1: "COFF",
  2: "CODEVIEW",
  3: "FPO",
  4: "MISC",
  5: "EXCEPTION",
  6: "FIXUP",
  7: "OMAP_TO_SRC",
  8: "OMAP_FROM_SRC",
  9: "BORLAND",
  10: "RESERVED10",
  11: "CLSID",
  12: "VC_FEATURE",
  13: "POGO",
  14: "ILTCG",
  16: "REPRO",
};

export function parsePeDebug(
  r: BinaryReader,
  space: PeAddressSpace,
  dir: DataDirectoryEntry | undefined,
  max = 32,
): PeDebugEntry[] {
  if (!dir || dir.rva === 0) return [];
  const loc = peRvaToFile(space, dir.rva);
  if (loc.fileOffset === undefined) return [];
  const out: PeDebugEntry[] = [];
  let off = loc.fileOffset;
  const entSize = 28;
  while (out.length < max && off + entSize <= r.length) {
    const timeDateStamp = r.readU32(off + 4);
    const type = r.readU32(off + 12);
    const sizeOfData = r.readU32(off + 16);
    const rva = r.readU32(off + 20);
    const ptrRaw = r.readU32(off + 24);
    const fileOff = ptrRaw > 0 ? ptrRaw : peRvaToFile(space, rva).fileOffset;
    if (type === 0 && sizeOfData === 0 && rva === 0) break;
    out.push({
      type,
      typeName: DEBUG_TYPES[type] ?? `TYPE_${type}`,
      sizeOfData,
      rva,
      fileOffset: fileOff ?? null,
      timeDateStamp,
    });
    off += entSize;
  }
  return out;
}

export function parsePeTls(
  r: BinaryReader,
  space: PeAddressSpace,
  dir: DataDirectoryEntry | undefined,
  is64: boolean,
): PeTlsInfo | null {
  if (!dir || dir.rva === 0) return null;
  const loc = peRvaToFile(space, dir.rva);
  if (loc.fileOffset === undefined) return null;
  const off = loc.fileOffset;
  if (is64) {
    if (off + 40 > r.length) return null;
    return {
      startRva: Number(r.readU64(off)),
      endRva: Number(r.readU64(off + 8)),
      indexRva: Number(r.readU64(off + 16)),
      callbacksRva: Number(r.readU64(off + 24)),
      sizeOfZeroFill: r.readU32(off + 32),
      characteristics: r.readU32(off + 36),
    };
  }
  if (off + 24 > r.length) return null;
  return {
    startRva: r.readU32(off),
    endRva: r.readU32(off + 4),
    indexRva: r.readU32(off + 8),
    callbacksRva: r.readU32(off + 12),
    sizeOfZeroFill: r.readU32(off + 16),
    characteristics: r.readU32(off + 20),
  };
}

export function parsePeDelayImports(
  r: BinaryReader,
  space: PeAddressSpace,
  dir: DataDirectoryEntry | undefined,
  is64: boolean,
  max = 64,
): PeDelayImportDll[] {
  if (!dir || dir.rva === 0) return [];
  const loc = peRvaToFile(space, dir.rva);
  if (loc.fileOffset === undefined) return [];
  const out: PeDelayImportDll[] = [];
  let off = loc.fileOffset;
  const descSize = 32;

  while (out.length < max && off + descSize <= r.length) {
    const attrs = is64 ? Number(r.readU64(off)) : r.readU32(off);
    const nameRva = r.readU32(off + 8);
    const module = is64 ? Number(r.readU64(off + 16)) : r.readU32(off + 12);
    if (attrs === 0 && nameRva === 0 && module === 0) break;
    const nameLoc = peRvaToFile(space, nameRva);
    let dll = "";
    if (nameLoc.fileOffset !== undefined) {
      try {
        dll = r.readCStringAt(nameLoc.fileOffset, 260);
      } catch {
        dll = `rva_0x${nameRva.toString(16)}`;
      }
    }
    out.push({ dll, attributes: attrs, rva: nameRva });
    off += descSize;
  }
  return out;
}
