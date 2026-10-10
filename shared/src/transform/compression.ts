export type CompressionKind =
  | "gzip"
  | "zlib"
  | "deflate"
  | "zip"
  | "bzip2"
  | "xz"
  | "zstd"
  | "lz4"
  | "unknown";

export interface CompressionHit {
  kind: CompressionKind;
  offset: number;
  sizeHint: number | null;
  confidence: number;
  description: string;
  heuristic: boolean;
}

export function scanCompression(data: Uint8Array, max = 500): CompressionHit[] {
  const hits: CompressionHit[] = [];
  for (let i = 0; i < data.length - 4 && hits.length < max; i++) {
    const h = detectAt(data, i);
    if (h) {
      hits.push(h);
      i += 4;
    }
  }
  return hits;
}

function detectAt(data: Uint8Array, offset: number): CompressionHit | null {
  const b0 = data[offset];
  const b1 = data[offset + 1];
  const b2 = data[offset + 2];
  const b3 = data[offset + 3];

  if (b0 === 0x1f && b1 === 0x8b) {
    return hit("gzip", offset, "GZIP (RFC 1952)", 0.95, null);
  }
  if (b0 === 0x78 && (b1 === 0x01 || b1 === 0x9c || b1 === 0xda)) {
    return hit("zlib", offset, `ZLIB CMF/FLG 0x78 0x${b1!.toString(16)}`, 0.9, null);
  }
  if (b0 === 0x50 && b1 === 0x4b && b2 === 0x03 && b3 === 0x04) {
    const size = readZipLocalSize(data, offset);
    return hit("zip", offset, "ZIP local file header", 0.92, size);
  }
  if (b0 === 0x42 && b1 === 0x5a && b2 === 0x68) {
    return hit("bzip2", offset, "bzip2 (BZh)", 0.9, null);
  }
  if (b0 === 0xfd && b1 === 0x37 && b2 === 0x7a && b3 === 0x58) {
    return hit("xz", offset, "XZ stream", 0.9, null);
  }
  if (b0 === 0x28 && b1 === 0xb5 && b2 === 0x2f && b3 === 0xfd) {
    return hit("zstd", offset, "Zstandard frame", 0.9, null);
  }
  if (b0 === 0x04 && b1 === 0x22 && b2 === 0x4d && b3 === 0x18) {
    return hit("lz4", offset, "LZ4 frame", 0.85, null);
  }
  return null;
}

function hit(
  kind: CompressionKind,
  offset: number,
  description: string,
  confidence: number,
  sizeHint: number | null,
): CompressionHit {
  return {
    kind,
    offset,
    sizeHint,
    confidence,
    description,
    heuristic: kind !== "gzip" && kind !== "zlib",
  };
}

function readZipLocalSize(data: Uint8Array, offset: number): number | null {
  if (offset + 30 > data.length) return null;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const comp = view.getUint32(offset + 18, true);
  const nameLen = view.getUint16(offset + 26, true);
  const extra = view.getUint16(offset + 28, true);
  return 30 + nameLen + extra + comp;
}
