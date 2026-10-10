import {
  buildXrefsFromDisasm,
  buildXrefsFromElf,
  buildXrefsFromPeFixed,
  buildXrefsFromWasm,
  elfVaToFile,
  mergeXrefDatabase,
  peRvaToFile,
  type DisasmInstruction,
  type XrefDatabase,
} from "@hexora/shared";
import type { BinaryAnalysis } from "./binaryAnalysis";

export function buildStaticXrefDatabase(analysis: BinaryAnalysis): XrefDatabase {
  const parts: Parameters<typeof mergeXrefDatabase>[0] = [];

  if (analysis.pe && analysis.peSpace) {
    parts.push(
      buildXrefsFromPeFixed(analysis.pe, (rva) => {
        const res = peRvaToFile(analysis.peSpace!, rva);
        return res.fileOffset ?? null;
      }),
    );
  }

  if (analysis.elf && analysis.elfSpace) {
    parts.push(
      buildXrefsFromElf(analysis.elf, (va) => {
        const res = elfVaToFile(analysis.elfSpace!, va);
        return res.fileOffset ?? null;
      }),
    );
  }

  if (analysis.wasm) {
    parts.push(buildXrefsFromWasm(analysis.wasm));
  }

  return mergeXrefDatabase(parts);
}

export function xrefsFromDisasmSlice(
  db: XrefDatabase,
  instructions: DisasmInstruction[],
  sliceFileOffset: number,
  sliceBaseAddress: number,
  resolveFileOffset: (va: number) => number | null,
): XrefDatabase {
  const edges = buildXrefsFromDisasm(
    instructions,
    sliceFileOffset,
    sliceBaseAddress,
    resolveFileOffset,
  );
  return mergeXrefDatabase([db.edges, edges]);
}
