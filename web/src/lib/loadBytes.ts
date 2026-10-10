import { analyzeBinary } from "./binaryAnalysis";
import { hashFile } from "./hash";
import type { LoadedFile } from "./fileLoad";
import { FILE_SIZE_SOFT_WARN } from "./fileLoad";

/** Transform やデコード結果を新しい解析対象として読み込む */
export async function loadFromBytes(
  fileName: string,
  bytes: Uint8Array,
): Promise<{
  fileName: string;
  data: Uint8Array;
  buffer: ArrayBuffer;
  analysis: ReturnType<typeof analyzeBinary>;
  hashes: LoadedFile["hashes"];
  warnedLarge: boolean;
}> {
  const copy = bytes.slice();
  const buffer = copy.buffer;
  const hashes = await hashFile(buffer);
  const analysis = analyzeBinary(buffer, "lenient");
  return {
    fileName,
    data: copy,
    buffer,
    analysis,
    hashes,
    warnedLarge: bytes.length >= FILE_SIZE_SOFT_WARN,
  };
}
