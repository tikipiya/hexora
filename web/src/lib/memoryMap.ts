import type { BinaryAnalysis } from "./binaryAnalysis";
import {
  elfFileToVa,
  elfVaToFile,
  peRvaToFile,
  peRvaToVa,
  peVaToRva,
} from "@hexora/shared";
import type { HexRegion } from "./hexRegions";

/** UI 用: ファイルオフセットへのポインタ解決 */
export function resolvePointerForUi(
  analysis: BinaryAnalysis,
  raw: number,
): { fileOffset?: number; label: string } | null {
  if (analysis.peSpace) {
    const rva = raw < analysis.peSpace.sizeOfHeaders ? raw : null;
    if (rva !== null) {
      const res = peRvaToFile(analysis.peSpace, rva);
      if (res.fileOffset !== undefined) {
        return { fileOffset: res.fileOffset, label: `RVA 0x${rva.toString(16)}` };
      }
    }
    const va = BigInt(raw);
    const asRva = peVaToRva(analysis.peSpace, va);
    if (asRva !== null) {
      const res = peRvaToFile(analysis.peSpace, asRva);
      if (res.fileOffset !== undefined) {
        return { fileOffset: res.fileOffset, label: `VA 0x${raw.toString(16)}` };
      }
    }
    const res = peRvaToFile(analysis.peSpace, raw);
    if (res.fileOffset !== undefined) {
      return { fileOffset: res.fileOffset, label: `RVA 0x${raw.toString(16)}` };
    }
  }
  if (analysis.elfSpace) {
    const res = elfVaToFile(analysis.elfSpace, BigInt(raw));
    if (res.fileOffset !== undefined) {
      return { fileOffset: res.fileOffset, label: `VA ${res.vaddr}` };
    }
    const f2v = elfFileToVa(analysis.elfSpace, raw);
    if (f2v.fileOffset !== undefined) return { fileOffset: raw, label: "file offset" };
  }
  return null;
}

export function regionsFromAnalysis(analysis: BinaryAnalysis): HexRegion[] {
  if (analysis.pe?.sections) {
    return analysis.pe.sections
      .filter((s) => s.sizeOfRawData > 0)
      .map((s) => ({
        start: s.pointerToRawData,
        end: s.pointerToRawData + s.sizeOfRawData,
        label: s.name || ".unnamed",
      }));
  }
  if (analysis.elf?.sectionHeaders) {
    return analysis.elf.sectionHeaders
      .filter((s) => !s.isNobits && s.fileBackedSize > 0n)
      .map((s) => ({
        start: Number(s.offset),
        end: Number(s.offset + s.fileBackedSize),
        label: s.name,
      }));
  }
  if (analysis.wasm?.sections) {
    return analysis.wasm.sections.map((s) => ({
      start: s.fileOffset,
      end: s.fileOffset + s.size,
      label: `wasm:${s.name}`,
    }));
  }
  return [];
}

export function peRvaToVaString(analysis: BinaryAnalysis, rva: number): string {
  if (!analysis.peSpace) return `0x${rva.toString(16)}`;
  return peRvaToVa(analysis.peSpace, rva).toString();
}
