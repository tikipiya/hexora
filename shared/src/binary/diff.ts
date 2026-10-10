export interface DiffRegion {
  start: number;
  end: number;
  aVal: number;
  bVal: number;
}

export interface DiffSummary {
  lengthA: number;
  lengthB: number;
  sameBytes: number;
  diffRegions: DiffRegion[];
  truncated: boolean;
}

const MAX_REGIONS = 2000;

export function compareBinary(a: Uint8Array, b: Uint8Array): DiffSummary {
  const len = Math.max(a.length, b.length);
  const diffRegions: DiffRegion[] = [];
  let sameBytes = 0;
  let runStart = -1;
  let aVal = 0;
  let bVal = 0;

  const flush = (end: number) => {
    if (runStart < 0) return;
    diffRegions.push({ start: runStart, end, aVal, bVal });
    runStart = -1;
  };

  for (let i = 0; i < len; i++) {
    const av = i < a.length ? a[i]! : -1;
    const bv = i < b.length ? b[i]! : -1;
    if (av === bv) {
      flush(i - 1);
      if (av >= 0) sameBytes++;
    } else if (runStart < 0) {
      runStart = i;
      aVal = av;
      bVal = bv;
    }
  }
  flush(len - 1);

  const truncated = diffRegions.length > MAX_REGIONS;
  return {
    lengthA: a.length,
    lengthB: b.length,
    sameBytes,
    diffRegions: diffRegions.slice(0, MAX_REGIONS),
    truncated,
  };
}
