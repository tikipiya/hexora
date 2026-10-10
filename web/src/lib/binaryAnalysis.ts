import {
  buildElfAddressSpace,
  buildPeAddressSpace,
  detectBinaryKind,
  parseElf,
  parsePe,
  parseMachO,
  parseWasm,
  type ElfParseResult,
  type MachOParseResult,
  type ParseIssue,
  type PeParseResult,
  type WasmParseResult,
  type ElfAddressSpace,
  type PeAddressSpace,
} from "@hexora/shared";

export type ParseMode = "strict" | "lenient";

export interface BinaryAnalysis {
  kind: "elf" | "pe" | "macho" | "wasm" | "unknown";
  elf: ElfParseResult | null;
  pe: PeParseResult | null;
  macho: MachOParseResult | null;
  wasm: WasmParseResult | null;
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
        macho: null,
        wasm: null,
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
        macho: null,
        wasm: null,
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
        macho: null,
        wasm: null,
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
        macho: null,
        wasm: null,
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
  if (kind === "macho") {
    try {
      const macho = parseMachO(buffer, mode);
      return {
        kind: "macho",
        elf: null,
        pe: null,
        macho,
        wasm: null,
        elfSpace: null,
        peSpace: null,
        issues: macho.issues,
      };
    } catch (e) {
      return {
        kind: "unknown",
        elf: null,
        pe: null,
        macho: null,
        wasm: null,
        elfSpace: null,
        peSpace: null,
        issues: [
          {
            severity: "error",
            code: "macho_fatal",
            message: e instanceof Error ? e.message : "Mach-O parse failed",
          },
        ],
      };
    }
  }
  if (kind === "wasm") {
    try {
      const wasm = parseWasm(buffer, mode);
      return {
        kind: "wasm",
        elf: null,
        pe: null,
        macho: null,
        wasm,
        elfSpace: null,
        peSpace: null,
        issues: wasm.issues,
      };
    } catch (e) {
      return {
        kind: "unknown",
        elf: null,
        pe: null,
        macho: null,
        wasm: null,
        elfSpace: null,
        peSpace: null,
        issues: [
          {
            severity: "error",
            code: "wasm_fatal",
            message: e instanceof Error ? e.message : "Wasm parse failed",
          },
        ],
      };
    }
  }
  return {
    kind: "unknown",
    elf: null,
    pe: null,
    macho: null,
    wasm: null,
    elfSpace: null,
    peSpace: null,
    issues: [],
  };
}
