import type { PeSection } from "./types.ts";
import type { ParseIssue } from "../binary/errors.ts";

export type PeMapStatus =
  | "mapped"
  | "uninitialized"
  | "unmapped"
  | "ambiguous"
  | "header";

export interface PeAddressSpace {
  imageBase: bigint;
  sections: PeSection[];
  sizeOfHeaders: number;
  issues: ParseIssue[];
}

export interface PeAddressResult {
  status: PeMapStatus;
  fileOffset?: number;
  rva?: number;
  va?: string;
  sectionName?: string;
  heuristic: boolean;
  messages: string[];
}

export function buildPeAddressSpace(
  imageBase: bigint,
  sections: PeSection[],
  sizeOfHeaders: number,
  issues: ParseIssue[],
): PeAddressSpace {
  return { imageBase, sections, sizeOfHeaders, issues };
}

export function peRvaToFile(space: PeAddressSpace, rva: number): PeAddressResult {
  if (rva < space.sizeOfHeaders) {
    return {
      status: "header",
      rva,
      fileOffset: rva,
      va: (space.imageBase + BigInt(rva)).toString(),
      heuristic: false,
      messages: ["RVA falls within PE headers"],
    };
  }

  const hits: { sec: PeSection; off: number; uninit: boolean }[] = [];
  for (const sec of space.sections) {
    const vsize = Math.max(sec.virtualSize, sec.sizeOfRawData);
    if (rva >= sec.virtualAddress && rva < sec.virtualAddress + vsize) {
      const delta = rva - sec.virtualAddress;
      if (delta < sec.sizeOfRawData) {
        hits.push({ sec, off: sec.pointerToRawData + delta, uninit: false });
      } else {
        hits.push({ sec, off: -1, uninit: true });
      }
    }
  }

  if (hits.length === 0) {
    return { status: "unmapped", rva, heuristic: false, messages: ["RVA not in any section"] };
  }
  if (hits.length > 1) {
    return {
      status: "ambiguous",
      rva,
      heuristic: true,
      messages: ["Overlapping section VAs"],
    };
  }
  const h = hits[0]!;
  if (h.uninit) {
    return {
      status: "uninitialized",
      rva,
      va: (space.imageBase + BigInt(rva)).toString(),
      sectionName: h.sec.name,
      heuristic: false,
      messages: ["RVA in VirtualSize > SizeOfRawData"],
    };
  }
  return {
    status: "mapped",
    rva,
    fileOffset: h.off,
    va: (space.imageBase + BigInt(rva)).toString(),
    sectionName: h.sec.name,
    heuristic: false,
    messages: [],
  };
}

export function peFileToRva(space: PeAddressSpace, fileOffset: number): PeAddressResult {
  if (fileOffset < space.sizeOfHeaders) {
    return {
      status: "header",
      fileOffset,
      rva: fileOffset,
      va: (space.imageBase + BigInt(fileOffset)).toString(),
      heuristic: false,
      messages: [],
    };
  }
  const hits: PeSection[] = [];
  for (const sec of space.sections) {
    const end = sec.pointerToRawData + sec.sizeOfRawData;
    if (fileOffset >= sec.pointerToRawData && fileOffset < end) hits.push(sec);
  }
  if (hits.length === 0) {
    return { status: "unmapped", fileOffset, heuristic: false, messages: [] };
  }
  if (hits.length > 1) {
    return { status: "ambiguous", fileOffset, heuristic: true, messages: ["Overlapping raw ranges"] };
  }
  const sec = hits[0]!;
  const rva = sec.virtualAddress + (fileOffset - sec.pointerToRawData);
  return {
    status: "mapped",
    fileOffset,
    rva,
    va: (space.imageBase + BigInt(rva)).toString(),
    sectionName: sec.name,
    heuristic: false,
    messages: [],
  };
}

export function peVaToRva(space: PeAddressSpace, va: bigint): number | null {
  const base = space.imageBase;
  if (va < base) return null;
  const rva = Number(va - base);
  if (rva < 0 || rva > 0xffff_ffff) return null;
  return rva;
}

export function peRvaToVa(space: PeAddressSpace, rva: number): bigint {
  return space.imageBase + BigInt(rva);
}
