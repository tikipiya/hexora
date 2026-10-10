import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { copyText, formatHexSelection } from "../lib/clipboard";
import {
  findMatches,
  offsetAddressWidth,
  parseOffset,
  parseSearchInput,
  type HexSearchMatch,
} from "../lib/hexSearch";
import { HexInspector } from "./HexInspector";
import type { HexRegion } from "../lib/hexRegions";
import { regionAt } from "../lib/hexRegions";
import type { BinaryAnalysis } from "../lib/binaryAnalysis";

const ROW_BYTES = 16;
const ROW_HEIGHT = 24;
const OVERSCAN = 12;

interface Props {
  data: Uint8Array;
  highlightOffset?: number;
  focusRange?: { start: number; end: number };
  regions?: HexRegion[];
  analysis?: BinaryAnalysis | null;
  onJump?: (offset: number) => void;
}

export function HexViewer({
  data,
  highlightOffset,
  focusRange,
  regions = [],
  analysis = null,
  onJump,
}: Props) {
  const [search, setSearch] = useState("");
  const [matchIndex, setMatchIndex] = useState(0);
  const [goto, setGoto] = useState("");
  const [selStart, setSelStart] = useState<number | null>(null);
  const [selEnd, setSelEnd] = useState<number | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportH, setViewportH] = useState(480);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const addrWidth = offsetAddressWidth(data.length);

  const matches: HexSearchMatch[] = useMemo(() => {
    const q = parseSearchInput(search);
    return findMatches(data, q);
  }, [data, search]);

  const activeOffset =
    matches.length > 0
      ? matches[Math.min(matchIndex, matches.length - 1)]!.offset
      : highlightOffset;

  const rowCount = Math.ceil(data.length / ROW_BYTES) || 1;

  const { startRow, endRow } = useMemo(() => {
    const first = Math.floor(scrollTop / ROW_HEIGHT);
    const visible = Math.ceil(viewportH / ROW_HEIGHT) + OVERSCAN;
    const start = Math.max(0, first - OVERSCAN);
    const end = Math.min(rowCount, first + visible);
    return { startRow: start, endRow: end };
  }, [scrollTop, viewportH, rowCount]);

  const matchSet = useMemo(() => {
    const set = new Set<number>();
    for (const m of matches) {
      for (let i = 0; i < m.length; i++) set.add(m.offset + i);
    }
    return set;
  }, [matches]);

  const scrollToOffset = useCallback(
    (offset: number) => {
      const row = Math.floor(offset / ROW_BYTES);
      const top = row * ROW_HEIGHT;
      scrollerRef.current?.scrollTo({ top, behavior: "smooth" });
      onJump?.(offset);
    },
    [onJump],
  );

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewportH(el.clientHeight));
    ro.observe(el);
    setViewportH(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (highlightOffset !== undefined) {
      scrollToOffset(highlightOffset);
    }
  }, [highlightOffset, scrollToOffset]);

  useEffect(() => {
    if (focusRange) {
      setSelStart(focusRange.start);
      setSelEnd(focusRange.end);
      scrollToOffset(focusRange.start);
    }
  }, [focusRange, scrollToOffset]);

  useEffect(() => {
    setMatchIndex(0);
  }, [search]);

  useEffect(() => {
    if (matches.length > 0) {
      scrollToOffset(matches[matchIndex]!.offset);
    }
  }, [matchIndex, matches, scrollToOffset]);

  const onByteClick = (offset: number, extend: boolean) => {
    if (extend && selStart !== null) {
      setSelEnd(offset);
    } else {
      setSelStart(offset);
      setSelEnd(offset);
    }
    onJump?.(offset);
  };

  const selectionRange = useMemo(() => {
    if (selStart === null || selEnd === null) return null;
    const a = Math.min(selStart, selEnd);
    const b = Math.max(selStart, selEnd);
    return { start: a, end: b };
  }, [selStart, selEnd]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && goto.trim()) {
      const off = parseOffset(goto, data.length);
      if (off !== null) scrollToOffset(off);
    }
    if (e.key === "F3" || (e.key === "g" && e.ctrlKey)) {
      e.preventDefault();
      if (matches.length === 0) return;
      const next = e.shiftKey
        ? (matchIndex - 1 + matches.length) % matches.length
        : (matchIndex + 1) % matches.length;
      setMatchIndex(next);
    }
  };

  const cursor =
    selEnd ?? selStart ?? activeOffset ?? highlightOffset ?? 0;

  const regionLabel =
    activeOffset !== undefined && activeOffset !== null
      ? regionAt(regions, activeOffset)?.label
      : null;

  const follow = (off: number) => {
    setSelStart(off);
    setSelEnd(off);
    scrollToOffset(off);
  };

  return (
    <div
      className="grid gap-4 lg:grid-cols-[1fr_minmax(280px,340px)]"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
    <div className="glass-card hairline-inset p-4 flex flex-col gap-3 min-h-[360px]">
      <div className="flex flex-wrap gap-2 items-end justify-between">
        <div>
          <h3 className="font-aeonikpro text-heading-sm text-ice-highlight">Hex</h3>
          {regionLabel && (
            <p className="text-caption text-fog-veil mt-1">Section: {regionLabel}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 w-full lg:w-auto">
          <input
            className="rounded-[var(--radius-inputs)] bg-[rgba(199,211,234,0.06)] px-3 py-2 text-body-sm text-pure-white hairline-inset min-w-[200px] flex-1 placeholder:text-moon-mist/60"
            placeholder="検索: text / h:48656c6c6f / @0x1000 / r:pattern"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <input
            className="rounded-[var(--radius-inputs)] bg-[rgba(199,211,234,0.06)] px-3 py-2 text-body-sm text-pure-white hairline-inset w-28 placeholder:text-moon-mist/60"
            placeholder="Go to"
            value={goto}
            onChange={(e) => setGoto(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-caption text-fog-veil items-center">
        <span>
          {matches.length > 0
            ? `一致 ${matchIndex + 1} / ${matches.length}（F3 / Shift+F3）`
            : "16 バイト行 · バイトクリックで選択（Shift で範囲拡張）"}
        </span>
        {selectionRange && (
          <span className="text-moon-mist">
            選択: 0x{selectionRange.start.toString(16)}–0x
            {selectionRange.end.toString(16)} (
            {selectionRange.end - selectionRange.start + 1} B)
          </span>
        )}
        {selectionRange && (
          <>
            {(["hex", "c-array"] as const).map((style) => (
              <button
                key={style}
                type="button"
                className="hairline-inset rounded-[var(--radius-badges)] px-2 py-0.5 text-frost-glow hover:bg-[rgba(186,214,247,0.06)]"
                onClick={() =>
                  void copyText(
                    formatHexSelection(
                      data,
                      selectionRange.start,
                      selectionRange.end,
                      style,
                    ),
                  )
                }
              >
                Copy {style}
              </button>
            ))}
          </>
        )}
      </div>

      <div
        ref={scrollerRef}
        className="font-dotdigital text-caption overflow-auto max-h-[min(70vh,560px)] leading-6 relative hairline-inset rounded-[var(--radius-badges)] bg-[rgba(5,6,15,0.4)]"
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      >
        <div style={{ height: rowCount * ROW_HEIGHT, position: "relative" }}>
          {Array.from({ length: endRow - startRow }, (_, i) => startRow + i).map(
            (row) => {
              const offset = row * ROW_BYTES;
              return (
                <HexRow
                  key={row}
                  top={row * ROW_HEIGHT}
                  offset={offset}
                  data={data}
                  addrWidth={addrWidth}
                  matchSet={matchSet}
                  activeOffset={activeOffset}
                  selection={selectionRange}
                  regions={regions}
                  onByteClick={onByteClick}
                />
              );
            },
          )}
        </div>
      </div>
    </div>

    <HexInspector
      data={data}
      cursor={Math.min(cursor, data.length - 1)}
      selection={selectionRange}
      analysis={analysis}
      onFollow={follow}
    />
    </div>
  );
}

function HexRow({
  top,
  offset,
  data,
  addrWidth,
  matchSet,
  activeOffset,
  selection,
  regions,
  onByteClick,
}: {
  top: number;
  offset: number;
  data: Uint8Array;
  addrWidth: number;
  matchSet: Set<number>;
  activeOffset?: number;
  selection: { start: number; end: number } | null;
  regions: HexRegion[];
  onByteClick: (offset: number, extend: boolean) => void;
}) {
  const region = regionAt(regions, offset);
  const rowRegionTint = region
    ? "border-l-2 border-l-[rgba(102,58,243,0.35)]"
    : "";

  return (
    <div
      className={`absolute left-0 right-0 grid grid-cols-[auto_1fr_auto] gap-3 px-2 ${rowRegionTint}`}
      style={{ top, height: ROW_HEIGHT }}
    >
      <span className="text-fog-veil tabular-nums">
        {offset.toString(16).padStart(addrWidth, "0")}
      </span>
      <span className="text-frost-glow tracking-wider flex">
        {Array.from({ length: ROW_BYTES }, (_, i) => {
          const pos = offset + i;
          if (pos >= data.length) {
            return (
              <span key={i} className="inline-block w-[1.35rem] text-center opacity-30">
                ··
              </span>
            );
          }
          const b = data[pos];
          const isMatch = matchSet.has(pos);
          const inSel =
            selection && pos >= selection.start && pos <= selection.end;
          const isActive = activeOffset === pos;
          return (
            <button
              key={i}
              type="button"
              className={`inline-block w-[1.35rem] text-center rounded-sm hover:bg-[rgba(186,214,247,0.12)] ${
                isActive ? "bg-[rgba(102,58,243,0.35)]" : ""
              } ${isMatch ? "text-blueprint-blue" : ""} ${
                inSel ? "bg-[rgba(199,211,234,0.15)]" : ""
              }`}
              onClick={(e) => onByteClick(pos, e.shiftKey)}
            >
              {b.toString(16).padStart(2, "0")}
            </button>
          );
        })}
      </span>
      <span className="text-moon-mist">
        {Array.from({ length: ROW_BYTES }, (_, i) => {
          const pos = offset + i;
          if (pos >= data.length) return " ";
          const b = data[pos];
          return b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : ".";
        }).join("")}
      </span>
    </div>
  );
}
