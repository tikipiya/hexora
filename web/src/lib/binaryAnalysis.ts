import {
  buildElfAddressSpace,
  buildPeAddressSpace,
  detectBinaryKind,
  parseElf,
  parsePe,
  type ElfParseResult,
  type ParseIssue,
  type PeParseResult,
  type ElfAddressSpace,
  type PeAddressSpace,
} from "@hexora/shared";

export type ParseMode = "strict" | "lenient";

export interface BinaryAnalysis {
  kind: "elf" | "pe" | "unknown";
  elf: ElfParseResult | null;
  pe: PeParseResult | null;
  elfSpace: ElfAddressSpace | null;
  peSpace: PeAddressSpace | null;
  issues: ParseIssue[];
}

export function analyzeBinary(
  buffer: ArrayBuffer,
  mode: ParseMode = "lenient",
): BinaryAnalysis {
  const kind = detectBinaryKind(buffer);
  if (kind === "elf") {
    try {
      const elf = parseElf(buffer, mode);
      return {
        kind: "elf",
        elf,
        pe: null,
        elfSpace: buildElfAddressSpace(
          elf.programHeaders,
          elf.sectionHeaders,
          elf.issues,
        ),
        peSpace: null,
        issues: elf.issues,
      };
    } catch (e) {
      return {
        kind: "unknown",
        elf: null,
        pe: null,
        elfSpace: null,
        peSpace: null,
        issues: [
          {
            severity: "error",
            code: "elf_fatal",
            message: e instanceof Error ? e.message : "ELF parse failed",
          },
        ],
      };
    }
  }
  if (kind === "pe") {
    try {
      const pe = parsePe(buffer, mode);
      return {
        kind: "pe",
        elf: null,
        pe,
        elfSpace: null,
        peSpace: buildPeAddressSpace(
          pe.imageBase,
          pe.sections,
          pe.sizeOfHeaders,
          pe.issues,
        ),
        issues: pe.issues,
      };
    } catch (e) {
      return {
        kind: "unknown",
        elf: null,
        pe: null,
        elfSpace: null,
        peSpace: null,
        issues: [
          {
            severity: "error",
            code: "pe_fatal",
            message: e instanceof Error ? e.message : "PE parse failed",
          },
        ],
      };
    }
  }
  return {
    kind: "unknown",
    elf: null,
    pe: null,
    elfSpace: null,
    peSpace: null,
    issues: [],
  };
}
