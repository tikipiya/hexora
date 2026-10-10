import type { ElfAnalysis } from "./elf";
import type { PeAnalysis } from "./pe";

export interface MemorySegment {
  name: string;
  vaStart: number;
  vaEnd: number;
  fileStart: number;
  fileEnd: number;
}

export interface MemoryMap {
  is64: boolean;
  littleEndian: boolean;
  imageBase: number;
  segments: MemorySegment[];
}

export function memoryMapFromPe(pe: PeAnalysis): MemoryMap {
  const segments: MemorySegment[] = pe.sections
    .filter((s) => s.rawSize > 0)
    .map((s) => ({
      name: s.name || ".unnamed",
      vaStart: pe.imageBase + s.virtualAddress,
      vaEnd: pe.imageBase + s.virtualAddress + Math.max(s.virtualSize, s.rawSize),
      fileStart: s.rawOffset,
      fileEnd: s.rawOffset + s.rawSize,
    }));
  return {
    is64: pe.is64,
    littleEndian: true,
    imageBase: pe.imageBase,
    segments,
  };
}

export function memoryMapFromElf(elf: ElfAnalysis): MemoryMap {
  const le = elf.endian === "LE";
  const segments: MemorySegment[] = elf.sections
    .filter((s) => s.size > 0 && s.offset > 0)
    .map((s) => ({
      name: s.name,
      vaStart: s.address,
      vaEnd: s.address + s.size,
      fileStart: s.offset,
      fileEnd: s.offset + s.size,
    }));
  return {
    is64: elf.klass === 64,
    littleEndian: le,
    imageBase: 0,
    segments,
  };
}

export function vaToOffset(map: MemoryMap, va: number): number | null {
  for (const s of map.segments) {
    if (va >= s.vaStart && va < s.vaEnd) {
      const delta = va - s.vaStart;
      const off = s.fileStart + delta;
      if (off >= s.fileStart && off < s.fileEnd) return off;
    }
  }
  return null;
}

export function offsetToVa(map: MemoryMap, fileOffset: number): number | null {
  for (const s of map.segments) {
    if (fileOffset >= s.fileStart && fileOffset < s.fileEnd) {
      return s.vaStart + (fileOffset - s.fileStart);
    }
  }
  return null;
}

export function segmentNameAt(map: MemoryMap, fileOffset: number): string | null {
  for (const s of map.segments) {
    if (fileOffset >= s.fileStart && fileOffset < s.fileEnd) return s.name;
  }
  return null;
}

/** ポインタ値がモジュール内 VA として妥当か */
export function looksLikeMappedVa(map: MemoryMap, va: number): boolean {
  return resolvePointer(map, va) !== null;
}

/** VA / RVA / 生値からファイルオフセットを解決 */
export function resolvePointer(
  map: MemoryMap,
  raw: number,
): { va: number; fileOffset: number } | null {
  const candidates = [raw];
  if (map.imageBase > 0) {
    candidates.push(map.imageBase + raw);
  }
  if (raw > map.imageBase) {
    candidates.push(raw - map.imageBase + map.imageBase);
  }
  for (const va of candidates) {
    const fileOffset = vaToOffset(map, va);
    if (fileOffset !== null) return { va, fileOffset };
  }
  return null;
}
