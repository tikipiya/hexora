import { useMemo } from "react";
import type { DisasmInstruction } from "@hexora/shared";
import type { BinaryAnalysis } from "../lib/binaryAnalysis";
import {
  buildStaticXrefDatabase,
  xrefsFromDisasmSlice,
} from "../lib/xrefDatabase";
import { resolvePointerForUi } from "../lib/memoryMap";

export interface DisasmXrefContext {
  instructions: DisasmInstruction[];
  fileOffset: number;
  baseAddress: number;
  arch: "x86" | "x64" | "arm64" | "wasm";
}

export function useXrefDatabase(
  analysis: BinaryAnalysis | null,
  data: Uint8Array | null,
  disasm: DisasmXrefContext | null,
) {
  return useMemo(() => {
    if (!analysis) return null;
    const staticDb = buildStaticXrefDatabase(analysis);
    if (!disasm?.instructions.length) return staticDb;

    const resolveVa = (va: number): number | null => {
      if (disasm.arch === "wasm") {
        if (va >= 0 && data && va < data.length) return va;
        return null;
      }
      const hit = resolvePointerForUi(analysis, va);
      return hit?.fileOffset ?? null;
    };

    return xrefsFromDisasmSlice(
      staticDb,
      disasm.instructions,
      disasm.fileOffset,
      disasm.baseAddress,
      resolveVa,
    );
  }, [analysis, data, disasm]);
}
