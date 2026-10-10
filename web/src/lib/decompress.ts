import { gunzipSync, unzipSync, zlibSync, unzlibSync } from "fflate";
import { decompress as zstdDecompress } from "fzstd";
import { decompress as xzDecompress } from "xz-decompress";
import type { CompressionKind } from "@hexora/shared";
// compressjs is AMD/CJS; Vite prebundles default export
import compressjs from "compressjs";

export interface DecompressResult {
  ok: boolean;
  data?: Uint8Array;
  error?: string;
  ratio?: number;
}

export async function tryDecompress(
  data: Uint8Array,
  offset: number,
  kind: CompressionKind,
  maxOut = 16 * 1024 * 1024,
): Promise<DecompressResult> {
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
      case "zip": {
        const files = unzipSync(slice);
        const first = Object.values(files)[0];
        if (!first) return { ok: false, error: "ZIP にファイルがありません" };
        out = first;
        break;
      }
      case "bzip2":
        out = Uint8Array.from(compressjs.Bzip2.decompressFile(slice) as number[]);
        break;
      case "zstd":
        out = zstdDecompress(slice);
        break;
      case "xz":
        out = await xzDecompress(slice);
        break;
      default:
        return { ok: false, error: `${kind} はブラウザ内デコード未対応` };
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
