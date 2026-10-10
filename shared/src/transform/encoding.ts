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
  scanAscii85(data, hits, maxHits);
  scanUuencode(data, hits, maxHits);
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

function scanAscii85(data: Uint8Array, hits: EncodingHit[], max: number): void {
  for (let i = 0; i < data.length - 4 && hits.length < max; i++) {
    if (data[i] !== 0x3c || data[i + 1] !== 0x7e) continue;
    const end = findAscii85End(data, i + 2);
    if (end < 0) continue;
    const len = end - i + 2;
    const body = new TextDecoder("ascii").decode(data.subarray(i + 2, end));
    const decoded = decodeAscii85(body);
    if (!decoded || decoded.length < 4) continue;
    hits.push({
      kind: "ascii85",
      offset: i,
      length: len,
      confidence: 0.75,
      decodedPreview: previewBytes(decoded),
      decodedBytes: decoded,
      heuristic: true,
    });
    i = end;
  }
}

function findAscii85End(data: Uint8Array, from: number): number {
  for (let i = from; i < data.length - 1; i++) {
    if (data[i] === 0x7e && data[i + 1] === 0x3e) return i + 1;
  }
  return -1;
}

function decodeAscii85(input: string): Uint8Array | null {
  const clean = input.replace(/\s+/g, "");
  if (clean.length < 5) return null;
  const out: number[] = [];
  let i = 0;
  while (i < clean.length) {
    if (clean[i] === "z") {
      out.push(0, 0, 0, 0);
      i++;
      continue;
    }
    let acc = 0;
    let count = 0;
    for (let j = 0; j < 5 && i + j < clean.length; j++) {
      const c = clean.charCodeAt(i + j);
      if (c < 0x21 || c > 0x75) return null;
      acc = acc * 85 + (c - 0x21);
      count++;
    }
    if (count < 5) {
      for (let k = count; k < 5; k++) acc = acc * 85 + 0x54;
    }
    const b0 = (acc >>> 24) & 0xff;
    const b1 = (acc >>> 16) & 0xff;
    const b2 = (acc >>> 8) & 0xff;
    const b3 = acc & 0xff;
    const emit = count === 5 ? 4 : count - 1;
    if (emit > 0) out.push(b0);
    if (emit > 1) out.push(b1);
    if (emit > 2) out.push(b2);
    if (emit > 3) out.push(b3);
    i += count;
  }
  return new Uint8Array(out);
}

function scanUuencode(data: Uint8Array, hits: EncodingHit[], max: number): void {
  for (let i = 0; i < data.length - 10 && hits.length < max; i++) {
    if (data[i] !== 0x62 || data[i + 1] !== 0x65 || data[i + 2] !== 0x67 || data[i + 3] !== 0x69)
      continue;
    const end = findBytesLine(data, "end", i);
    if (end < 0) continue;
    const chunk = data.subarray(i, end + 3);
    const decoded = decodeUu(chunk);
    if (!decoded || decoded.length < 4) continue;
    hits.push({
      kind: "uuencode",
      offset: i,
      length: chunk.length,
      confidence: 0.7,
      decodedPreview: previewBytes(decoded),
      decodedBytes: decoded,
      heuristic: true,
    });
    i = end;
  }
}

function findBytesLine(data: Uint8Array, word: string, from: number): number {
  const pat = new TextEncoder().encode(word);
  for (let i = from; i < data.length - pat.length; i++) {
    let ok = true;
    for (let j = 0; j < pat.length; j++) {
      if (data[i + j] !== pat[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return i;
  }
  return -1;
}

function decodeUu(data: Uint8Array): Uint8Array | null {
  const text = new TextDecoder("ascii").decode(data);
  const lines = text.split(/\r?\n/);
  const out: number[] = [];
  for (const line of lines) {
    if (!line || line.startsWith("begin ") || line === "end") continue;
    const len = (line.charCodeAt(0) - 0x20) & 0x3f;
    if (len <= 0) continue;
    for (let i = 1; i + 3 < line.length && out.length < len; i += 4) {
      const c1 = line.charCodeAt(i) - 0x20;
      const c2 = line.charCodeAt(i + 1) - 0x20;
      const c3 = line.charCodeAt(i + 2) - 0x20;
      const c4 = line.charCodeAt(i + 3) - 0x20;
      out.push((c1 << 2) | (c2 >> 4));
      if (out.length < len) out.push(((c2 & 0x0f) << 4) | (c3 >> 2));
      if (out.length < len) out.push(((c3 & 0x03) << 6) | c4);
    }
  }
  return out.length ? new Uint8Array(out) : null;
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
    if (kind === "ascii85") {
      const inner = text.replace(/^<~/, "").replace(/~>$/, "");
      return decodeAscii85(inner);
    }
    if (kind === "uuencode") return decodeUu(slice);
    if (kind === "url") return new TextEncoder().encode(decodeURIComponent(text));
  } catch {
    return null;
  }
  return null;
}
