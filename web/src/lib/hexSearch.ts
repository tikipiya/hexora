export type SearchMode = "auto" | "offset" | "hex" | "text" | "regex";

export interface HexSearchQuery {
  mode: SearchMode;
  raw: string;
}

export interface HexSearchMatch {
  offset: number;
  length: number;
}

export function parseSearchInput(input: string): HexSearchQuery {
  const raw = input.trim();
  if (!raw) return { mode: "auto", raw: "" };
  if (raw.startsWith("@") || raw.startsWith("0x") || /^\d+$/.test(raw)) {
    return { mode: "offset", raw };
  }
  if (raw.startsWith("h:") || raw.startsWith("hex:")) {
    return { mode: "hex", raw: raw.replace(/^(h|hex):/, "") };
  }
  if (raw.startsWith("r:") || raw.startsWith("regex:")) {
    return { mode: "regex", raw: raw.replace(/^(r|regex):/, "") };
  }
  if (/^[0-9a-fA-F\s]+$/.test(raw) && raw.replace(/\s/g, "").length >= 2) {
    const compact = raw.replace(/\s/g, "");
    if (compact.length % 2 === 0 && /[a-fA-F]/.test(compact)) {
      return { mode: "hex", raw };
    }
  }
  return { mode: "text", raw };
}

export function parseOffset(input: string, fileSize: number): number | null {
  const t = input.trim().replace(/^@/, "");
  if (!t) return null;
  let n: number;
  if (t.startsWith("0x") || t.startsWith("0X")) {
    n = Number.parseInt(t.slice(2), 16);
  } else {
    n = Number.parseInt(t, 10);
  }
  if (!Number.isFinite(n) || n < 0 || n >= fileSize) return null;
  return n;
}

export function findMatches(
  data: Uint8Array,
  query: HexSearchQuery,
  maxMatches = 10_000,
): HexSearchMatch[] {
  if (!query.raw) return [];

  if (query.mode === "offset" || query.mode === "auto") {
    const off = parseOffset(query.raw, data.length);
    if (off !== null) return [{ offset: off, length: 1 }];
  }

  if (query.mode === "hex" || (query.mode === "auto" && isHexLike(query.raw))) {
    const pattern = parseHexPattern(query.raw);
    if (pattern.length === 0) return [];
    return findPatternAll(data, pattern, maxMatches);
  }

  if (query.mode === "regex") {
    try {
      const re = new RegExp(query.raw, "g");
      const text = new TextDecoder("latin1").decode(data);
      const out: HexSearchMatch[] = [];
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null && out.length < maxMatches) {
        out.push({ offset: m.index, length: m[0].length });
      }
      return out;
    } catch {
      return [];
    }
  }

  const pattern = new TextEncoder().encode(query.raw);
  if (pattern.length === 0) return [];
  return findPatternAll(data, pattern, maxMatches);
}

function isHexLike(raw: string): boolean {
  const compact = raw.replace(/\s/g, "");
  return compact.length >= 2 && compact.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(compact);
}

function parseHexPattern(raw: string): Uint8Array {
  const hex = raw.replace(/\s+/g, "").replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]*$/.test(hex) || hex.length % 2 !== 0) return new Uint8Array();
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function findPatternAll(
  data: Uint8Array,
  pattern: Uint8Array,
  maxMatches: number,
): HexSearchMatch[] {
  if (pattern.length === 0) return [];
  const out: HexSearchMatch[] = [];
  const lastStart = data.length - pattern.length;
  for (let i = 0; i <= lastStart; i++) {
    let ok = true;
    for (let j = 0; j < pattern.length; j++) {
      if (data[i + j] !== pattern[j]) {
        ok = false;
        break;
      }
    }
    if (ok) {
      out.push({ offset: i, length: pattern.length });
      if (out.length >= maxMatches) break;
    }
  }
  return out;
}

export function offsetAddressWidth(fileSize: number): number {
  if (fileSize > 0xffff_ffff) return 16;
  if (fileSize > 0xffff) return 8;
  return 6;
}
