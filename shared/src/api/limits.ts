/** Workers 向け上限（プランにより変わるため環境変数で上書き可能） */
export const DEFAULT_MAX_ANALYZE_BYTES = 4 * 1024 * 1024;
export const DEFAULT_MAX_JSON_BODY = 6 * 1024 * 1024;

export function maxAnalyzeBytes(env?: { MAX_ANALYZE_BYTES?: string }): number {
  const n = Number(env?.MAX_ANALYZE_BYTES);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_ANALYZE_BYTES;
}

export function parseBase64Payload(
  body: string,
  maxBytes: number,
): { ok: true; bytes: Uint8Array } | { ok: false; status: number; error: string } {
  if (!body || body.length > maxBytes * 1.4) {
    return { ok: false, status: 413, error: "Payload too large" };
  }
  try {
    const bin = atob(body);
    if (bin.length > maxBytes) {
      return { ok: false, status: 413, error: `Binary exceeds ${maxBytes} bytes` };
    }
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return { ok: true, bytes: out };
  } catch {
    return { ok: false, status: 400, error: "Invalid base64" };
  }
}
