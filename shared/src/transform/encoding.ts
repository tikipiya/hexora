export type EncodingKind =
  | "base64"
  | "base64url"
  | "hex"
  | "url"
  | "rot13"
  | "ascii85"
  | "uuencode";

export interface EncodingHit {
  kind: EncodingKind;
  offset: number;
  length: number;
  confidence: number;
  decodedPreview: string;
  decodedBytes?: Uint8Array;
  heuristic: boolean;
}

const B64 = /^[A-Za-z0-9+/]{4,}={0,2}$/;
const B64URL = /^[A-Za-z0-9_-]{4,}={0,2}$/;

export function scanEncodings(
  data: Uint8Array,
  maxHits = 200,
): EncodingHit[] {
  const hits: EncodingHit[] = [];
  scanBase64Ascii(data, hits, maxHits);
  scanHexAscii(data, hits, maxHits);
  scanRot13Regions(data, hits, maxHits);
  return hits.sort((a, b) => a.offset - b.offset).slice(0, maxHits);
}

function scanBase64Ascii(data: Uint8Array, hits: EncodingHit[], max: number): void {
  let start = -1;
  for (let i = 0; i < data.length && hits.length < max; i++) {
    const b = data[i];
    const ok =
      (b >= 0x41 && b <= 0x5a) ||
      (b >= 0x61 && b <= 0x7a) ||
      (b >= 0x30 && b <= 0x39) ||
      b === 0x2b ||
      b === 0x2f ||
      b === 0x3d ||
      b === 0x2d ||
      b === 0x5f;
    if (ok && start < 0) start = i;
    if (!ok && start >= 0) {
      flushB64(data, start, i - start, hits);
      start = -1;
    }
  }
}

function flushB64(
  data: Uint8Array,
  start: number,
  len: number,
  hits: EncodingHit[],
): void {
  if (len < 16) return;
  const ascii = new TextDecoder("ascii").decode(data.subarray(start, start + len));
  const compact = ascii.replace(/\s+/g, "");
  let kind: EncodingKind = "base64";
  if (B64URL.test(compact)) kind = "base64url";
  else if (!B64.test(compact)) return;

  try {
    const bin = atob(compact.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    hits.push({
      kind,
      offset: start,
      length: len,
      confidence: Math.min(1, len / 64),
      decodedPreview: previewBytes(bytes),
      decodedBytes: bytes,
      heuristic: true,
    });
  } catch {
    /* invalid b64 */
  }
}

function scanHexAscii(data: Uint8Array, hits: EncodingHit[], max: number): void {
  let start = -1;
  for (let i = 0; i < data.length && hits.length < max; i++) {
    const b = data[i];
    const ok =
      (b >= 0x30 && b <= 0x39) ||
      (b >= 0x41 && b <= 0x46) ||
      (b >= 0x61 && b <= 0x66) ||
      b === 0x20 ||
      b === 0x0a;
    if (ok && start < 0) start = i;
    if (!ok && start >= 0) {
      const len = i - start;
      if (len >= 32) {
        const hex = new TextDecoder("ascii")
          .decode(data.subarray(start, i))
          .replace(/\s+/g, "");
        if (hex.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(hex)) {
          const bytes = new Uint8Array(hex.length / 2);
          for (let j = 0; j < bytes.length; j++) {
            bytes[j] = Number.parseInt(hex.slice(j * 2, j * 2 + 2), 16);
          }
          hits.push({
            kind: "hex",
            offset: start,
            length: len,
            confidence: 0.7,
            decodedPreview: previewBytes(bytes),
            decodedBytes: bytes,
            heuristic: false,
          });
        }
      }
      start = -1;
    }
  }
}

function scanRot13Regions(data: Uint8Array, hits: EncodingHit[], max: number): void {
  let start = -1;
  for (let i = 0; i < data.length && hits.length < max; i++) {
    const b = data[i];
    const ok = b >= 0x41 && b <= 0x5a;
    if (ok && start < 0) start = i;
    if (!ok && start >= 0) {
      const len = i - start;
      if (len >= 8) {
        const raw = data.subarray(start, i);
        const decoded = rot13(raw);
        const pr = printableScore(decoded);
        if (pr > 0.85) {
          hits.push({
            kind: "rot13",
            offset: start,
            length: len,
            confidence: pr,
            decodedPreview: new TextDecoder("ascii").decode(decoded),
            decodedBytes: decoded,
            heuristic: true,
          });
        }
      }
      start = -1;
    }
  }
}

function rot13(data: Uint8Array): Uint8Array {
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    let c = data[i];
    if (c >= 0x41 && c <= 0x5a) {
      c = ((c - 0x41 + 13) % 26) + 0x41;
    }
    out[i] = c;
  }
  return out;
}

function printableScore(buf: Uint8Array): number {
  let n = 0;
  for (const b of buf) if (b >= 0x20 && b <= 0x7e) n++;
  return n / buf.length;
}

function previewBytes(buf: Uint8Array, max = 80): string {
  let s = "";
  for (let i = 0; i < Math.min(buf.length, max); i++) {
    const b = buf[i];
    s += b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : ".";
  }
  if (buf.length > max) s += "…";
  return s;
}

export function tryDecodeAt(
  data: Uint8Array,
  offset: number,
  kind: EncodingKind,
  length?: number,
): Uint8Array | null {
  const slice = length
    ? data.subarray(offset, offset + length)
    : data.subarray(offset);
  const text = new TextDecoder("latin1").decode(slice).trim();
  try {
    if (kind === "base64" || kind === "base64url") {
      const c = text.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
      const bin = atob(c);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    if (kind === "hex") {
      const hex = text.replace(/\s+/g, "");
      const out = new Uint8Array(hex.length / 2);
      for (let i = 0; i < out.length; i++) {
        out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
      }
      return out;
    }
    if (kind === "rot13") return rot13(slice);
    if (kind === "url") return new TextEncoder().encode(decodeURIComponent(text));
  } catch {
    return null;
  }
  return null;
}
