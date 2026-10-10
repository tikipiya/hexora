import type { ElfAnalysis } from "./elf";
import { parseElf } from "./elf";
import type { PeAnalysis } from "./pe";
import { parsePe } from "./pe";

export type BinaryFormat = "pe" | "elf" | "unknown";

export interface DetectedBinary {
  format: BinaryFormat;
  pe: PeAnalysis | null;
  elf: ElfAnalysis | null;
}

export function detectBinary(buffer: ArrayBuffer): DetectedBinary {
  const pe = parsePe(buffer);
  if (pe) return { format: "pe", pe, elf: null };
  const elf = parseElf(buffer);
  if (elf) return { format: "elf", pe: null, elf };
  return { format: "unknown", pe: null, elf: null };
}
