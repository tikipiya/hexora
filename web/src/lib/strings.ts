export type StringEncoding =
  | "ascii"
  | "latin1"
  | "utf8"
  | "utf16le"
  | "utf16be";

export type StringTag = "url" | "path" | "ip" | "email" | "registry" | "pem";

export interface ExtractedString {
  offset: number;
  length: number;
  encoding: StringEncoding;
  value: string;
  tags: StringTag[];
}

export interface StringExtractOptions {
  minLength: number;
  maxResults: number;
  encodings: StringEncoding[];
  dedupe: boolean;
}

export const DEFAULT_STRING_OPTIONS: StringExtractOptions = {
  minLength: 4,
  maxResults: 20_000,
  encodings: ["ascii", "latin1", "utf8", "utf16le", "utf16be"],
  dedupe: false,
};

export interface StringExtractResult {
  strings: ExtractedString[];
  truncated: boolean;
  scannedBytes: number;
}

export function extractStrings(
  data: Uint8Array,
  options: StringExtractOptions = DEFAULT_STRING_OPTIONS,
): StringExtractResult {
  const out: ExtractedString[] = [];
  const seen = options.dedupe ? new Set<string>() : null;
  let truncated = false;

  const push = (item: ExtractedString) => {
    if (truncated || out.length >= options.maxResults) {
      truncated = true;
      return;
    }
    if (seen) {
      const key = `${item.encoding}:${item.value}`;
      if (seen.has(key)) return;
      seen.add(key);
    }
    out.push(item);
    if (out.length >= options.maxResults) truncated = true;
  };

  const isFull = () => truncated || out.length >= options.maxResults;

  for (const enc of options.encodings) {
    if (truncated) break;
    switch (enc) {
      case "ascii":
        scanRun(data, options.minLength, isAsciiPrintable, "ascii", push, isFull);
        break;
      case "latin1":
        scanRun(data, options.minLength, isLatin1Printable, "latin1", push, isFull);
        break;
      case "utf8":
        scanUtf8(data, options.minLength, push, isFull);
        break;
      case "utf16le":
        scanUtf16(data, options.minLength, "le", push, isFull);
        break;
      case "utf16be":
        scanUtf16(data, options.minLength, "be", push, isFull);
        break;
    }
  }

  out.sort((a, b) => a.offset - b.offset);
  return { strings: out, truncated, scannedBytes: data.length };
}

export async function extractStringsAsync(
  data: Uint8Array,
  options: StringExtractOptions,
  onPartial?: (strings: ExtractedString[]) => void,
): Promise<StringExtractResult> {
  onPartial?.([]);
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
  const result = extractStrings(data, options);
  onPartial?.(result.strings);
  return result;
}

function scanRun(
  data: Uint8Array,
  minLen: number,
  isPrintable: (b: number) => boolean,
  encoding: StringEncoding,
  push: (item: ExtractedString) => void,
  isFull: () => boolean,
): void {
  let start = -1;
  for (let i = 0; i < data.length; i++) {
    if (isFull()) return;
    const ok = isPrintable(data[i]);
    if (ok && start < 0) start = i;
    if (!ok && start >= 0) {
      flushRun(data, start, i - start, encoding, minLen, push);
      start = -1;
    }
  }
  if (start >= 0) {
    flushRun(data, start, data.length - start, encoding, minLen, push);
  }
}

function flushRun(
  data: Uint8Array,
  start: number,
  len: number,
  encoding: StringEncoding,
  minLen: number,
  push: (item: ExtractedString) => void,
): void {
  if (len < minLen) return;
  const value = decodeLatin(data, start, len);
  push({
    offset: start,
    length: len,
    encoding,
    value,
    tags: classify(value),
  });
}

function scanUtf8(
  data: Uint8Array,
  minLen: number,
  push: (item: ExtractedString) => void,
  isFull: () => boolean,
): void {
  let i = 0;
  while (i < data.length) {
    if (isFull()) return;
    const start = i;
    let chars = 0;
    while (i < data.length) {
      const cp = readUtf8CodePoint(data, i);
      if (cp === null) break;
      if (!isUtf8StringChar(cp)) break;
      i += cp.size;
      chars++;
    }
    const byteLen = i - start;
    if (chars >= minLen && byteLen >= minLen) {
      const value = new TextDecoder("utf-8", { fatal: false }).decode(
        data.subarray(start, i),
      );
      if (value.length >= minLen) {
        push({
          offset: start,
          length: byteLen,
          encoding: "utf8",
          value,
          tags: classify(value),
        });
      }
    }
    if (i === start) i++;
  }
}

function scanUtf16(
  data: Uint8Array,
  minLen: number,
  endian: "le" | "be",
  push: (item: ExtractedString) => void,
  isFull: () => boolean,
): void {
  let start = -1;
  let chars = 0;
  for (let i = 0; i + 1 < data.length; i += 2) {
    if (isFull()) return;
    const lo = endian === "le" ? data[i] : data[i + 1];
    const hi = endian === "le" ? data[i + 1] : data[i];
    const code = lo | (hi << 8);
    const ok =
      code >= 0x20 &&
      code <= 0x7e &&
      hi === 0;
    if (ok) {
      if (start < 0) start = i;
      chars++;
    } else if (start >= 0) {
      if (chars >= minLen) {
        const value = new TextDecoder(endian === "le" ? "utf-16le" : "utf-16be").decode(
          data.subarray(start, i),
        );
        push({
          offset: start,
          length: i - start,
          encoding: endian === "le" ? "utf16le" : "utf16be",
          value,
          tags: classify(value),
        });
      }
      start = -1;
      chars = 0;
    }
  }
}

function isAsciiPrintable(b: number): boolean {
  return b >= 0x20 && b <= 0x7e;
}

function isLatin1Printable(b: number): boolean {
  return b >= 0x20 && b <= 0xff && b !== 0x7f;
}

function decodeLatin(data: Uint8Array, offset: number, len: number): string {
  return new TextDecoder("latin1").decode(data.subarray(offset, offset + len));
}

function readUtf8CodePoint(
  data: Uint8Array,
  i: number,
): { size: number; code: number } | null {
  const b0 = data[i];
  if (b0 < 0x80) return { size: 1, code: b0 };
  if ((b0 & 0xe0) === 0xc0 && i + 1 < data.length) {
    const b1 = data[i + 1];
    if ((b1 & 0xc0) !== 0x80) return null;
    return { size: 2, code: ((b0 & 0x1f) << 6) | (b1 & 0x3f) };
  }
  if ((b0 & 0xf0) === 0xe0 && i + 2 < data.length) {
    const b1 = data[i + 1];
    const b2 = data[i + 2];
    if ((b1 & 0xc0) !== 0x80 || (b2 & 0xc0) !== 0x80) return null;
    return {
      size: 3,
      code: ((b0 & 0x0f) << 12) | ((b1 & 0x3f) << 6) | (b2 & 0x3f),
    };
  }
  return null;
}

function isUtf8StringChar(cp: { code: number }): boolean {
  const c = cp.code;
  if (c >= 0x20 && c <= 0x7e) return true;
  if (c === 0x09 || c === 0x0a || c === 0x0d) return true;
  return false;
}

const URL_RE = /^https?:\/\/[^\s]+$/i;
const PATH_RE = /^(?:[A-Za-z]:\\|\\\\|\/)[^\0\n\r]{2,}$/;
const IP_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REG_RE = /^HKEY_[A-Z_\\]+/i;
const PEM_RE = /^-----BEGIN /;

export function classify(value: string): StringTag[] {
  const tags: StringTag[] = [];
  if (URL_RE.test(value)) tags.push("url");
  if (PATH_RE.test(value)) tags.push("path");
  if (IP_RE.test(value)) tags.push("ip");
  if (EMAIL_RE.test(value)) tags.push("email");
  if (REG_RE.test(value)) tags.push("registry");
  if (PEM_RE.test(value)) tags.push("pem");
  return tags;
}
