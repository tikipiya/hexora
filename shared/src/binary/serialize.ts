/** JSON 用: bigint と大きな数値を安全に文字列化 */
export function jsonSafe(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = jsonSafe(v);
    }
    return out;
  }
  return value;
}

export function hexAddr(n: number | bigint, width = 8): string {
  const s =
    typeof n === "bigint" ? n.toString(16) : n.toString(16);
  return `0x${s.padStart(width, "0")}`;
}
