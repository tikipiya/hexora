import type { BinaryReader } from "../binary/reader.ts";
import type { PeAddressSpace } from "./address.ts";
import { peRvaToFile } from "./address.ts";
import type { DataDirectoryEntry, PeResourceEntry } from "./types.ts";

const RT: Record<number, string> = {
  1: "CURSOR",
  2: "BITMAP",
  3: "ICON",
  4: "MENU",
  5: "DIALOG",
  6: "STRING",
  7: "FONTDIR",
  8: "FONT",
  9: "ACCELERATOR",
  10: "RCDATA",
  11: "MESSAGETABLE",
  14: "GROUP_ICON",
  16: "VERSION",
  24: "MANIFEST",
};

export function parsePeResources(
  r: BinaryReader,
  space: PeAddressSpace,
  dir: DataDirectoryEntry | undefined,
  maxEntries = 400,
): PeResourceEntry[] {
  if (!dir || dir.rva === 0 || dir.fileOffset === null) return [];
  const out: PeResourceEntry[] = [];
  visitDir(r, space, dir.fileOffset, dir.fileOffset, 0, 0, 0, out, maxEntries);
  return out;
}

function visitDir(
  r: BinaryReader,
  space: PeAddressSpace,
  rootOff: number,
  dirOff: number,
  depth: number,
  typeId: number,
  nameId: number,
  out: PeResourceEntry[],
  max: number,
): void {
  if (dirOff + 16 > r.length || out.length >= max) return;
  const named = r.readU16(dirOff + 12);
  const idCount = r.readU16(dirOff + 14);
  let entOff = dirOff + 16;

  for (let i = 0; i < named + idCount && out.length < max; i++) {
    if (entOff + 8 > r.length) break;
    const nameOrId = r.readU32(entOff);
    const offset = r.readU32(entOff + 4);
    const isDir = (offset & 0x80000000) !== 0;
    const target = rootOff + (offset & 0x7fffffff);
    const id = nameOrId;

    if (isDir) {
      if (depth === 0) visitDir(r, space, rootOff, target, 1, id, 0, out, max);
      else if (depth === 1) visitDir(r, space, rootOff, target, 2, typeId, id, out, max);
      else if (depth === 2) visitDir(r, space, rootOff, target, 3, typeId, nameId, out, max);
    } else if (depth === 3) {
      pushData(r, space, rootOff, target, typeId, nameId, id, out);
    }
    entOff += 8;
  }
}

function pushData(
  r: BinaryReader,
  space: PeAddressSpace,
  rootOff: number,
  dataEntRel: number,
  typeId: number,
  nameId: number,
  langId: number,
  out: PeResourceEntry[],
): void {
  const dataEntOff = rootOff + dataEntRel;
  if (dataEntOff + 16 > r.length) return;
  const dataRva = r.readU32(dataEntOff);
  const size = r.readU32(dataEntOff + 4);
  const codepage = r.readU32(dataEntOff + 8);
  const loc = peRvaToFile(space, dataRva);
  out.push({
    typeId,
    typeName: RT[typeId] ?? `RT_${typeId}`,
    nameId,
    langId,
    dataRva,
    size,
    fileOffset: loc.fileOffset ?? null,
    codepage,
  });
}
