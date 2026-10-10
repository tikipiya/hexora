export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function formatHexSelection(
  data: Uint8Array,
  start: number,
  end: number,
  style: "hex" | "c-array" | "python",
): string {
  const slice = data.subarray(start, end + 1);
  switch (style) {
    case "hex":
      return [...slice].map((b) => b.toString(16).padStart(2, "0")).join(" ");
    case "c-array":
      return `{ ${[...slice].map((b) => `0x${b.toString(16).padStart(2, "0")}`).join(", ")} }`;
    case "python":
      return `bytes([${[...slice].join(", ")}])`;
    default:
      return "";
  }
}
