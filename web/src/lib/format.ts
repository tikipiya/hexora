export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MiB`;
}

export function formatHex(n: number, width = 8): string {
  return `0x${n.toString(16).padStart(width, "0")}`;
}

export function readCString(view: DataView, offset: number, max = 256): string {
  const bytes: number[] = [];
  for (let i = 0; i < max; i++) {
    const b = view.getUint8(offset + i);
    if (b === 0) break;
    bytes.push(b);
  }
  return new TextDecoder("ascii", { fatal: false }).decode(new Uint8Array(bytes));
}
