import { shannonEntropy } from "./entropy.ts";

export interface XorCandidate {
  key: Uint8Array;
  keyHex: string;
  score: number;
  printableRatio: number;
  entropy: number;
  entropyDelta: number;
  preview: string;
}

function printableRatio(buf: Uint8Array): number {
  if (buf.length === 0) return 0;
  let n = 0;
  for (const b of buf) {
    if (b === 9 || b === 10 || b === 13 || (b >= 0x20 && b <= 0x7e)) n++;
  }
  return n / buf.length;
}

function chiEnglishScore(buf: Uint8Array): number {
  const freq = new Array(256).fill(0);
  for (const b of buf) freq[b]++;
  const space = freq[0x20] / buf.length;
  const e = freq[0x65] / buf.length;
  const t = freq[0x74] / buf.length;
  return space * 2 + e * 3 + t * 2;
}

export function xorWithKey(data: Uint8Array, key: Uint8Array): Uint8Array {
  const out = new Uint8Array(data.length);
  const klen = key.length;
  for (let i = 0; i < data.length; i++) {
    out[i] = data[i] ^ key[i % klen];
  }
  return out;
}

function previewAscii(buf: Uint8Array, max = 120): string {
  const slice = buf.subarray(0, Math.min(buf.length, max));
  let s = "";
  for (const b of slice) {
    s += b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : ".";
  }
  return s;
}

export function analyzeSingleByteXor(
  data: Uint8Array,
  sampleLen = 8192,
  topN = 32,
): XorCandidate[] {
  const sample = data.subarray(0, Math.min(data.length, sampleLen));
  const baseEntropy = shannonEntropy(sample);
  const out: XorCandidate[] = [];

  for (let k = 0; k < 256; k++) {
    const decoded = xorWithKey(sample, new Uint8Array([k]));
    const pr = printableRatio(decoded);
    const ent = shannonEntropy(decoded);
    const score = pr * 4 + chiEnglishScore(decoded) - ent * 0.15;
    out.push({
      key: new Uint8Array([k]),
      keyHex: k.toString(16).padStart(2, "0"),
      score,
      printableRatio: pr,
      entropy: ent,
      entropyDelta: baseEntropy - ent,
      preview: previewAscii(decoded),
    });
  }

  out.sort((a, b) => b.score - a.score);
  return out.slice(0, topN);
}

/** 繰り返しキー XOR（キー長 2〜maxKeyLen） */
export function analyzeRepeatingXor(
  data: Uint8Array,
  maxKeyLen = 24,
  sampleLen = 16384,
  topN = 16,
): XorCandidate[] {
  const sample = data.subarray(0, Math.min(data.length, sampleLen));
  const baseEntropy = shannonEntropy(sample);
  const candidates: XorCandidate[] = [];

  for (let len = 2; len <= maxKeyLen; len++) {
    const key = new Uint8Array(len);
    for (let pos = 0; pos < len; pos++) {
      let bestK = 0;
      let bestScore = -Infinity;
      for (let k = 0; k < 256; k++) {
        let score = 0;
        let count = 0;
        for (let i = pos; i < sample.length; i += len) {
          const d = sample[i] ^ k;
          if (d === 9 || d === 10 || d === 13 || (d >= 0x20 && d <= 0x7e)) score += 1;
          count++;
        }
        const avg = count ? score / count : 0;
        if (avg > bestScore) {
          bestScore = avg;
          bestK = k;
        }
      }
      key[pos] = bestK;
    }
    const decoded = xorWithKey(sample, key);
    const pr = printableRatio(decoded);
    const ent = shannonEntropy(decoded);
    const score = pr * 5 + chiEnglishScore(decoded) - ent * 0.1;
    candidates.push({
      key,
      keyHex: [...key].map((b) => b.toString(16).padStart(2, "0")).join(" "),
      score,
      printableRatio: pr,
      entropy: ent,
      entropyDelta: baseEntropy - ent,
      preview: previewAscii(decoded),
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, topN);
}
