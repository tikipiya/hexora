export interface EntropyChunk {
  offset: number;
  size: number;
  entropy: number;
}

export function shannonEntropy(data: Uint8Array): number {
  if (data.length === 0) return 0;
  const freq = new Array<number>(256).fill(0);
  for (const b of data) freq[b]++;
  let e = 0;
  const len = data.length;
  for (const c of freq) {
    if (c === 0) continue;
    const p = c / len;
    e -= p * Math.log2(p);
  }
  return e;
}

export function chunkEntropy(
  data: Uint8Array,
  chunkSize = 256,
): EntropyChunk[] {
  const out: EntropyChunk[] = [];
  for (let offset = 0; offset < data.length; offset += chunkSize) {
    const slice = data.subarray(offset, Math.min(offset + chunkSize, data.length));
    out.push({
      offset,
      size: slice.length,
      entropy: shannonEntropy(slice),
    });
  }
  return out;
}

export function entropyColor(entropy: number): string {
  const t = Math.min(1, entropy / 8);
  const r = Math.round(38 + t * 80);
  const g = Math.round(60 + (1 - t) * 40);
  const b = Math.round(120 + t * 100);
  return `rgb(${r},${g},${b})`;
}
