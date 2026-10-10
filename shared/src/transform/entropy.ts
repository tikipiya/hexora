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
