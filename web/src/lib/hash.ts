export type HashAlgorithm =
  | "md5"
  | "sha1"
  | "sha256"
  | "sha384"
  | "sha512"
  | "crc32";

export interface HashResult {
  algorithm: HashAlgorithm;
  hex: string;
}

export interface FileHashes {
  results: HashResult[];
  elapsedMs: number;
}

const ORDER: HashAlgorithm[] = [
  "crc32",
  "md5",
  "sha1",
  "sha256",
  "sha384",
  "sha512",
];

export async function hashFile(
  data: ArrayBuffer,
  onProgress?: (label: string, percent: number) => void,
): Promise<FileHashes> {
  const start = performance.now();
  onProgress?.("ハッシュ計算", 0);
  const view = new Uint8Array(data);
  const results: HashResult[] = [];

  results.push({ algorithm: "crc32", hex: crc32Hex(view).padStart(8, "0") });
  onProgress?.("CRC32", 12);
  results.push({ algorithm: "md5", hex: md5Hex(view) });
  onProgress?.("MD5", 24);

  const subtle: { id: HashAlgorithm; name: string }[] = [
    { id: "sha1", name: "SHA-1" },
    { id: "sha256", name: "SHA-256" },
    { id: "sha384", name: "SHA-384" },
    { id: "sha512", name: "SHA-512" },
  ];
  let p = 24;
  const step = 76 / subtle.length;
  for (const { id, name } of subtle) {
    const digest = await crypto.subtle.digest(name, data);
    results.push({ algorithm: id, hex: bufToHex(digest) });
    p += step;
    onProgress?.(name, Math.round(p));
  }

  results.sort((a, b) => ORDER.indexOf(a.algorithm) - ORDER.indexOf(b.algorithm));
  return { results, elapsedMs: Math.round(performance.now() - start) };
}

export function getHash(
  hashes: FileHashes | null,
  algorithm: HashAlgorithm,
): string | null {
  return hashes?.results.find((r) => r.algorithm === algorithm)?.hex ?? null;
}

function bufToHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

function crc32Hex(data: Uint8Array): string {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return ((crc ^ 0xffffffff) >>> 0).toString(16);
}

function md5Hex(data: Uint8Array): string {
  const words = md5Words(data);
  return words.map((w) => (w >>> 0).toString(16).padStart(8, "0")).join("");
}

function md5Words(input: Uint8Array): number[] {
  const n = input.length;
  const paddedLen = (((n + 8) >>> 6) + 1) << 6;
  const buf = new Uint8Array(paddedLen);
  buf.set(input);
  buf[n] = 0x80;
  const view = new DataView(buf.buffer);
  view.setUint32(paddedLen - 8, n << 3, true);
  view.setUint32(paddedLen - 4, n >>> 29, true);

  let a = 0x67452301;
  let b = 0xefcdab89;
  let c = 0x98badcfe;
  let d = 0x10325476;

  const K = new Array<number>(64);
  for (let i = 0; i < 64; i++) {
    K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0;
  }
  const S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9,
    14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];

  const rotl = (x: number, n: number) => ((x << n) | (x >>> (32 - n))) >>> 0;

  for (let i = 0; i < paddedLen; i += 64) {
    const M = new Array<number>(16);
    for (let j = 0; j < 16; j++) M[j] = view.getUint32(i + j * 4, true);

    let A = a;
    let B = b;
    let C = c;
    let D = d;

    for (let j = 0; j < 64; j++) {
      let F: number;
      let g: number;
      if (j < 16) {
        F = (B & C) | (~B & D);
        g = j;
      } else if (j < 32) {
        F = (D & B) | (~D & C);
        g = (5 * j + 1) % 16;
      } else if (j < 48) {
        F = B ^ C ^ D;
        g = (3 * j + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * j) % 16;
      }
      const tmp = D;
      D = C;
      C = B;
      const sum = (A + F + K[j] + M[g]) >>> 0;
      B = (B + rotl(sum, S[j])) >>> 0;
      A = tmp;
    }

    a = (a + A) >>> 0;
    b = (b + B) >>> 0;
    c = (c + C) >>> 0;
    d = (d + D) >>> 0;
  }

  return [a, b, c, d];
}
