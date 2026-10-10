export type ShareableTab =
  | "overview"
  | "hex"
  | "strings"
  | "disasm"
  | "structure"
  | "transform"
  | "diff";

export interface UrlViewState {
  tab?: ShareableTab;
  off?: number;
}

export function parseUrlHash(hash: string): UrlViewState {
  const raw = hash.replace(/^#/, "");
  if (!raw) return {};
  const params = new URLSearchParams(raw.includes("=") ? raw : `tab=${raw}`);
  const tab = params.get("tab") as ShareableTab | null;
  const offStr = params.get("off");
  let off: number | undefined;
  if (offStr) {
    const n = Number.parseInt(offStr.replace(/^0x/i, ""), offStr.startsWith("0x") ? 16 : 10);
    if (Number.isFinite(n) && n >= 0) off = n;
  }
  return { tab: tab ?? undefined, off };
}

export function writeUrlHash(state: UrlViewState): void {
  const params = new URLSearchParams();
  if (state.tab) params.set("tab", state.tab);
  if (state.off !== undefined) params.set("off", `0x${state.off.toString(16)}`);
  const next = params.toString();
  const url = `${window.location.pathname}${window.location.search}${next ? `#${next}` : ""}`;
  window.history.replaceState(null, "", url);
}
