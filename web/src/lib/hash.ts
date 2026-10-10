import { MD5, SHA1 } from "@noble/hashes/legacy";
import { SHA256, SHA384, SHA512 } from "@noble/hashes/sha2";

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
  incremental: boolean;
}

const ORDER: HashAlgorithm[] = [
  "crc32",
  "md5",
  "sha1",
  "sha256",
  "sha384",
  "sha512",
];

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

/** 読み込みストリームと同時に更新するマルチハッシュ */
export class IncrementalHashSuite {
  private crcState = 0xffffffff;
  private readonly md5 = new MD5();
  private readonly sha1 = new SHA1();
  private readonly sha256 = new SHA256();
  private readonly sha384 = new SHA384();
  private readonly sha512 = new SHA512();
  private readonly started = performance.now();
  private bytesProcessed = 0;

  update(chunk: Uint8Array): void {
    if (chunk.length === 0) return;
    this.bytesProcessed += chunk.length;
    this.crcState = crc32Update(this.crcState, chunk);
    this.md5.update(chunk);
    this.sha1.update(chunk);
    this.sha256.update(chunk);
    this.sha384.update(chunk);
    this.sha512.update(chunk);
  }

  getBytesProcessed(): number {
    return this.bytesProcessed;
  }

  finalize(): FileHashes {
    const results: HashResult[] = [
      {
        algorithm: "crc32",
        hex: ((this.crcState ^ 0xffffffff) >>> 0).toString(16).padStart(8, "0"),
      },
      { algorithm: "md5", hex: bytesToHex(this.md5.digest()) },
      { algorithm: "sha1", hex: bytesToHex(this.sha1.digest()) },
      { algorithm: "sha256", hex: bytesToHex(this.sha256.digest()) },
      { algorithm: "sha384", hex: bytesToHex(this.sha384.digest()) },
      { algorithm: "sha512", hex: bytesToHex(this.sha512.digest()) },
    ];
    results.sort((a, b) => ORDER.indexOf(a.algorithm) - ORDER.indexOf(b.algorithm));
    return {
      results,
      elapsedMs: Math.round(performance.now() - this.started),
      incremental: true,
    };
  }
}

function crc32Update(crc: number, data: Uint8Array): number {
  let c = crc;
  for (let i = 0; i < data.length; i++) {
    c ^= data[i];
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
    }
  }
  return c >>> 0;
}

export function createIncrementalHasher(): IncrementalHashSuite {
  return new IncrementalHashSuite();
}

export async function hashFile(
  data: ArrayBuffer,
  onProgress?: (label: string, percent: number) => void,
): Promise<FileHashes> {
  const h = createIncrementalHasher();
  h.update(new Uint8Array(data));
  onProgress?.("finalize", 100);
  const result = h.finalize();
  return { ...result, incremental: false };
}

export function getHash(
  hashes: FileHashes | null,
  algorithm: HashAlgorithm,
): string | null {
  return hashes?.results.find((r) => r.algorithm === algorithm)?.hex ?? null;
}
