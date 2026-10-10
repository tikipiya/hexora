import { gunzipSync, zlibSync, unzlibSync } from "fflate";
import type { CompressionKind } from "@hexora/shared";

export interface DecompressResult {
  ok: boolean;
  data?: Uint8Array;
  error?: string;
  ratio?: number;
}

export function tryDecompress(
  data: Uint8Array,
  offset: number,
  kind: CompressionKind,
  maxOut = 16 * 1024 * 1024,
): DecompressResult {
  const slice = data.subarray(offset);
  try {
    let out: Uint8Array;
    switch (kind) {
      case "gzip":
        out = gunzipSync(slice);
        break;
      case "zlib":
        out = unzlibSync(slice);
        break;
      case "deflate":
        out = zlibSync(slice);
        break;
      default:
        return { ok: false, error: `${kind} はブラウザ内デコード未対応（カービングのみ）` };
    }
    if (out.length > maxOut) {
      return { ok: false, error: `展開結果が上限 (${maxOut} B) を超えました` };
    }
    return {
      ok: true,
      data: out,
      ratio: slice.length / Math.max(1, out.length),
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Decompress failed",
    };
  }
}
