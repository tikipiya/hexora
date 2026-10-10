import type { BinaryReader } from "../binary/reader.ts";
import type { PeAddressSpace } from "./address.ts";
import { peRvaToFile } from "./address.ts";
import type { DataDirectoryEntry, PeRelocBlock } from "./types.ts";

export function parsePeRelocBlocks(
  r: BinaryReader,
  space: PeAddressSpace,
  dir: DataDirectoryEntry | undefined,
  maxBlocks = 200,
): PeRelocBlock[] {
  if (!dir || dir.rva === 0) return [];
  const loc = peRvaToFile(space, dir.rva);
  if (loc.fileOffset === undefined) return [];
  const out: PeRelocBlock[] = [];
  let off = loc.fileOffset;
  const end = loc.fileOffset + dir.size;

  while (off + 8 <= r.length && off < end && out.length < maxBlocks) {
    const pageRva = r.readU32(off);
    const blockSize = r.readU32(off + 4);
    if (blockSize < 8) break;
    const entryCount = (blockSize - 8) / 2;
    out.push({
      pageRva,
      blockSize,
      entryCount,
      fileOffset: off,
    });
    off += blockSize;
  }
  return out;
}
