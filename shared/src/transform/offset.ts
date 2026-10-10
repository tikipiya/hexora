import type { CarvedArtifact } from "./carving.ts";
import type { CompressionHit } from "./compression.ts";
import type { EncodingHit } from "./encoding.ts";

export function shiftTransformOffsets<
  T extends { offset: number },
>(items: T[], base: number): T[] {
  if (base === 0) return items;
  return items.map((item) => ({ ...item, offset: item.offset + base }));
}

export function shiftScanResults(
  base: number,
  encodings: EncodingHit[],
  compression: CompressionHit[],
  carved: CarvedArtifact[],
) {
  return {
    encodings: shiftTransformOffsets(encodings, base),
    compression: shiftTransformOffsets(compression, base),
    carved: shiftTransformOffsets(carved, base),
  };
}
