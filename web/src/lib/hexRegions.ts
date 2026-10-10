import type { ElfAnalysis } from "./elf";
import type { PeAnalysis } from "./pe";

export interface HexRegion {
  start: number;
  end: number;
  label: string;
}

export function regionsFromPe(pe: PeAnalysis): HexRegion[] {
  return pe.sections
    .filter((s) => s.rawSize > 0)
    .map((s) => ({
      start: s.rawOffset,
      end: s.rawOffset + s.rawSize,
      label: s.name || ".unnamed",
    }));
}

export function regionsFromElf(elf: ElfAnalysis): HexRegion[] {
  return elf.sections
    .filter((s) => s.size > 0 && s.offset > 0)
    .map((s) => ({
      start: s.offset,
      end: s.offset + s.size,
      label: s.name,
    }));
}

export function regionAt(regions: HexRegion[], offset: number): HexRegion | null {
  for (const r of regions) {
    if (offset >= r.start && offset < r.end) return r;
  }
  return null;
}
