import type { Arch } from "../types.ts";

/** Capstone オペランド文字列から参照先アドレス候補を抽出 */
export function parseOperandAddresses(operands: string, arch: Arch): number[] {
  const out = new Set<number>();
  const patterns = [
    /#?(?:0x)?([0-9a-f]+)\b/gi,
    /\$?(?:0x)?([0-9a-f]+)\b/gi,
    /\[rip\s*\+\s*(?:0x)?([0-9a-f]+)\]/gi,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    const copy = new RegExp(re.source, re.flags);
    while ((m = copy.exec(operands)) !== null) {
      const n = Number.parseInt(m[1]!, 16);
      if (Number.isFinite(n) && n > 0xff) out.add(n);
    }
  }
  if (arch === "wasm") {
    const br = operands.match(/(?:br|br_if|br_table)\s+(\d+)/i);
    if (br) out.add(Number.parseInt(br[1]!, 10));
    const call = operands.match(/call\s+(\d+)/i);
    if (call) out.add(Number.parseInt(call[1]!, 10));
  }
  if (arch === "arm64") {
    const m = operands.match(/#(?:0x)?([0-9a-f]+)/i);
    if (m) {
      const n = Number.parseInt(m[1]!, 16);
      if (Number.isFinite(n)) out.add(n);
    }
  }
  return [...out];
}
