import { BinaryReader } from "./reader.ts";

export type BinaryKind = "elf" | "pe" | "unknown";

export function detectBinaryKind(buffer: ArrayBuffer | Uint8Array): BinaryKind {
  const r = new BinaryReader(buffer);
  if (r.length < 4) return "unknown";
  if (r.matchAt(0, [0x7f, 0x45, 0x4c, 0x46])) return "elf";
  if (r.readU16(0) === 0x5a4d) {
    if (r.length < 0x40) return "unknown";
    const peOff = r.readU32(0x3c);
    if (peOff + 4 <= r.length && r.readU32(peOff) === 0x00004550) return "pe";
  }
  return "unknown";
}
