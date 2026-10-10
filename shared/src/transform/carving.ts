export interface CarveSignature {
  id: string;
  label: string;
  magic: number[];
  mask?: number[];
  offset?: number;
  maxLength?: number;
  validate?: (data: Uint8Array, at: number) => boolean;
}

export interface CarvedArtifact {
  id: string;
  label: string;
  offset: number;
  length: number;
  confidence: number;
  previewHex: string;
}

export const CARVE_SIGNATURES: CarveSignature[] = [
  { id: "png", label: "PNG image", magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], validate: validatePng },
  { id: "jpg", label: "JPEG image", magic: [0xff, 0xd8, 0xff] },
  { id: "gif", label: "GIF image", magic: [0x47, 0x49, 0x46, 0x38] },
  { id: "pdf", label: "PDF document", magic: [0x25, 0x50, 0x44, 0x46] },
  { id: "zip", label: "ZIP archive", magic: [0x50, 0x4b, 0x03, 0x04] },
  { id: "zip-eocd", label: "ZIP (empty/spanned)", magic: [0x50, 0x4b, 0x05, 0x06] },
  { id: "rar", label: "RAR archive", magic: [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07] },
  { id: "7z", label: "7-Zip", magic: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c] },
  { id: "elf", label: "ELF binary", magic: [0x7f, 0x45, 0x4c, 0x46] },
  { id: "pe", label: "PE (MZ)", magic: [0x4d, 0x5a] },
  { id: "wasm", label: "WebAssembly", magic: [0x00, 0x61, 0x73, 0x6d] },
  { id: "gzip", label: "GZIP", magic: [0x1f, 0x8b] },
  { id: "sqlite", label: "SQLite DB", magic: [0x53, 0x51, 0x4c, 0x69, 0x74, 0x65] },
  { id: "ogg", label: "OGG", magic: [0x4f, 0x67, 0x67, 0x53] },
  { id: "mp3-id3", label: "MP3 (ID3)", magic: [0x49, 0x44, 0x33] },
  { id: "flag", label: "CTF flag pattern", magic: [0x66, 0x6c, 0x61, 0x67], validate: validateFlag },
];

function matchMagic(data: Uint8Array, at: number, sig: CarveSignature): boolean {
  const off = sig.offset ?? 0;
  const pos = at + off;
  if (pos + sig.magic.length > data.length) return false;
  for (let i = 0; i < sig.magic.length; i++) {
    const mask = sig.mask?.[i] ?? 0xff;
    if ((data[pos + i] & mask) !== (sig.magic[i] & mask)) return false;
  }
  return true;
}

function validatePng(data: Uint8Array, at: number): boolean {
  const end = findBytes(data, [0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82], at);
  return end >= 0 && end - at < 50 * 1024 * 1024;
}

function validateFlag(data: Uint8Array, at: number): boolean {
  for (let i = at; i < Math.min(at + 120, data.length); i++) {
    if (data[i] === 0x7d) return true;
  }
  return false;
}

function findBytes(data: Uint8Array, pat: number[], from: number): number {
  for (let i = from; i <= data.length - pat.length; i++) {
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

export function estimateCarveLength(
  data: Uint8Array,
  sig: CarveSignature,
  at: number,
): number {
  if (sig.maxLength) return Math.min(sig.maxLength, data.length - at);
  if (sig.id === "png") {
    const end = findBytes(data, [0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82], at);
    if (end >= 0) return end - at + 8;
  }
  if (sig.id === "jpg") {
    const end = findBytes(data, [0xff, 0xd9], at + 3);
    if (end >= 0) return end - at + 2;
  }
  if (sig.id === "zip") {
    if (at + 30 <= data.length) {
      const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
      const comp = view.getUint32(at + 18, true);
      const nameLen = view.getUint16(at + 26, true);
      const extra = view.getUint16(at + 28, true);
      return 30 + nameLen + extra + comp;
    }
  }
  return Math.min(4096, data.length - at);
}

const SIGS_BY_FIRST_BYTE = buildFirstByteIndex();

function buildFirstByteIndex(): Map<number, CarveSignature[]> {
  const map = new Map<number, CarveSignature[]>();
  for (const sig of CARVE_SIGNATURES) {
    const fb = sig.magic[0];
    const list = map.get(fb) ?? [];
    list.push(sig);
    map.set(fb, list);
  }
  return map;
}

export function carveFiles(
  data: Uint8Array,
  maxArtifacts = 500,
  onProgress?: (scanned: number, total: number) => void,
): CarvedArtifact[] {
  const out: CarvedArtifact[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < data.length && out.length < maxArtifacts; i++) {
    if (i % 65536 === 0) onProgress?.(i, data.length);
    const sigs = SIGS_BY_FIRST_BYTE.get(data[i]);
    if (!sigs) continue;
    for (const sig of sigs) {
      if (!matchMagic(data, i, sig)) continue;
      if (sig.validate && !sig.validate(data, i)) continue;
      const key = `${sig.id}:${i}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const length = estimateCarveLength(data, sig, i);
      const preview = [...data.subarray(i, Math.min(i + 16, data.length))]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(" ");
      out.push({
        id: sig.id,
        label: sig.label,
        offset: i,
        length,
        confidence: sig.validate ? 0.9 : 0.75,
        previewHex: preview,
      });
    }
  }
  onProgress?.(data.length, data.length);
  return out.sort((a, b) => a.offset - b.offset);
}
