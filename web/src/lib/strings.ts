export interface ExtractedString {
  offset: number;
  length: number;
  encoding: "ascii" | "utf16le";
  value: string;
}

const MIN_LEN = 4;

export function extractStrings(data: Uint8Array, max = 5000): ExtractedString[] {
  const out: ExtractedString[] = [];
  out.push(...scanAscii(data, max - out.length));
  if (out.length < max) {
    out.push(...scanUtf16Le(data, max - out.length));
  }
  return out.sort((a, b) => a.offset - b.offset);
}

function scanAscii(data: Uint8Array, limit: number): ExtractedString[] {
  const out: ExtractedString[] = [];
  let start = -1;
  for (let i = 0; i < data.length; i++) {
    const b = data[i];
    const ok = b >= 0x20 && b <= 0x7e;
    if (ok && start < 0) start = i;
    if (!ok && start >= 0) {
      const len = i - start;
      if (len >= MIN_LEN) {
        out.push({
          offset: start,
          length: len,
          encoding: "ascii",
          value: decodeAscii(data, start, len),
        });
        if (out.length >= limit) return out;
      }
      start = -1;
    }
  }
  if (start >= 0) {
    const len = data.length - start;
    if (len >= MIN_LEN) {
      out.push({
        offset: start,
        length: len,
        encoding: "ascii",
        value: decodeAscii(data, start, len),
      });
    }
  }
  return out;
}

function scanUtf16Le(data: Uint8Array, limit: number): ExtractedString[] {
  const out: ExtractedString[] = [];
  let start = -1;
  for (let i = 0; i + 1 < data.length; i += 2) {
    const lo = data[i];
    const hi = data[i + 1];
    const ok = hi === 0 && lo >= 0x20 && lo <= 0x7e;
    if (ok && start < 0) start = i;
    if (!ok && start >= 0) {
      const len = (i - start) / 2;
      if (len >= MIN_LEN) {
        out.push({
          offset: start,
          length: len * 2,
          encoding: "utf16le",
          value: decodeUtf16Le(data, start, len),
        });
        if (out.length >= limit) return out;
      }
      start = -1;
    }
  }
  return out;
}

function decodeAscii(data: Uint8Array, offset: number, len: number): string {
  return new TextDecoder("ascii").decode(data.subarray(offset, offset + len));
}

function decodeUtf16Le(data: Uint8Array, offset: number, charCount: number): string {
  return new TextDecoder("utf-16le").decode(
    data.subarray(offset, offset + charCount * 2),
  );
}
