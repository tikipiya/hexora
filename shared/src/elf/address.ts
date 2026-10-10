import type { ElfProgramHeader, ElfSectionHeader } from "./types.ts";
import type { ParseIssue } from "../binary/errors.ts";

export type ElfMapStatus =
  | "mapped"
  | "bss"
  | "unmapped"
  | "ambiguous"
  | "invalid";

export interface ElfAddressQuery {
  fileOffset?: number;
  vaddr?: bigint;
}

export interface ElfAddressResult {
  status: ElfMapStatus;
  fileOffset?: number;
  vaddr?: string;
  segmentName?: string;
  sectionName?: string;
  heuristic: boolean;
  messages: string[];
}

export interface ElfAddressSpace {
  loadSegments: ElfProgramHeader[];
  sections: ElfSectionHeader[];
  issues: ParseIssue[];
}

export function buildElfAddressSpace(
  phdrs: ElfProgramHeader[],
  shdrs: ElfSectionHeader[],
  issues: ParseIssue[],
): ElfAddressSpace {
  return { loadSegments: phdrs.filter((p) => p.type === 1), sections: shdrs, issues };
}

export function elfFileToVa(
  space: ElfAddressSpace,
  fileOffset: number,
): ElfAddressResult {
  const messages: string[] = [];
  const matches: { vaddr: bigint; seg: ElfProgramHeader }[] = [];

  for (const seg of space.loadSegments) {
    const start = Number(seg.offset);
    const fend = Number(seg.offset + seg.filesz);
    if (fileOffset >= start && fileOffset < fend) {
      const delta = BigInt(fileOffset - start);
      matches.push({ vaddr: seg.vaddr + delta, seg });
    }
  }

  if (matches.length === 0) {
    return { status: "unmapped", heuristic: false, messages: ["No PT_LOAD covers file offset"] };
  }
  if (matches.length > 1) {
    return {
      status: "ambiguous",
      fileOffset,
      vaddr: matches[0]!.vaddr.toString(),
      heuristic: true,
      messages: [`${matches.length} PT_LOAD segments overlap`],
    };
  }

  const m = matches[0]!;
  const sec = space.sections.find(
    (s) =>
      !s.isNobits &&
      fileOffset >= Number(s.offset) &&
      fileOffset < Number(s.offset + s.fileBackedSize),
  );
  return {
    status: "mapped",
    fileOffset,
    vaddr: m.vaddr.toString(),
    segmentName: m.seg.typeName,
    sectionName: sec?.name,
    heuristic: false,
    messages,
  };
}

export function elfVaToFile(
  space: ElfAddressSpace,
  vaddr: bigint,
): ElfAddressResult {
  const matches: { off: number; seg: ElfProgramHeader; bss: boolean }[] = [];

  for (const seg of space.loadSegments) {
    const vend = seg.vaddr + seg.memsz;
    if (vaddr >= seg.vaddr && vaddr < vend) {
      const delta = vaddr - seg.vaddr;
      const fileEnd = seg.offset + seg.filesz;
      const filePos = seg.offset + delta;
      const inFile = filePos < fileEnd;
      matches.push({
        off: inFile ? Number(filePos) : -1,
        seg,
        bss: !inFile,
      });
    }
  }

  if (matches.length === 0) {
    return { status: "unmapped", vaddr: vaddr.toString(), heuristic: false, messages: [] };
  }
  if (matches.length > 1) {
    return {
      status: "ambiguous",
      vaddr: vaddr.toString(),
      heuristic: true,
      messages: ["Overlapping PT_LOAD mappings"],
    };
  }

  const m = matches[0]!;
  if (m.bss) {
    return {
      status: "bss",
      vaddr: vaddr.toString(),
      heuristic: false,
      messages: ["Address in memsz > filesz (zero-initialized)"],
    };
  }

  return {
    status: "mapped",
    fileOffset: m.off,
    vaddr: vaddr.toString(),
    segmentName: m.seg.typeName,
    heuristic: false,
    messages: [],
  };
}
