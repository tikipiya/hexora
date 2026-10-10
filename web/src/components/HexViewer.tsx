import { useMemo, useState } from "react";
import { formatHex } from "../lib/format";

const ROW = 16;

interface Props {
  data: Uint8Array;
  highlightOffset?: number;
  onJump?: (offset: number) => void;
}

export function HexViewer({ data, highlightOffset, onJump }: Props) {
  const [search, setSearch] = useState("");
  const [scrollTo, setScrollTo] = useState<number | null>(null);

  const rows = useMemo(() => {
    const count = Math.ceil(data.length / ROW);
    return Array.from({ length: count }, (_, i) => i * ROW);
  }, [data.length]);

  const searchOffset = useMemo(() => {
    if (!search) return null;
    const term = search.trim();
    if (!term) return null;
    if (term.startsWith("0x")) {
      const n = parseInt(term.slice(2), 16);
      if (!Number.isNaN(n) && n < data.length) return n;
    }
    const hex = term.replace(/\s+/g, "");
    if (/^[0-9a-fA-F]+$/.test(hex) && hex.length % 2 === 0) {
      const pattern = new Uint8Array(hex.length / 2);
      for (let i = 0; i < pattern.length; i++) {
        pattern[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
      }
      for (let i = 0; i <= data.length - pattern.length; i++) {
        let ok = true;
        for (let j = 0; j < pattern.length; j++) {
          if (data[i + j] !== pattern[j]) {
            ok = false;
            break;
          }
        }
        if (ok) return i;
      }
    }
    const ascii = new TextEncoder().encode(term);
    for (let i = 0; i <= data.length - ascii.length; i++) {
      let ok = true;
      for (let j = 0; j < ascii.length; j++) {
        if (data[i + j] !== ascii[j]) {
          ok = false;
          break;
        }
      }
      if (ok) return i;
    }
    return null;
  }, [data, search]);

  const active = scrollTo ?? searchOffset ?? highlightOffset;

  return (
    <div className="glass-card hairline-inset p-4 flex flex-col gap-3 min-h-[320px]">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <h3 className="font-aeonikpro text-heading-sm text-ice-highlight">Hex</h3>
        <input
          className="rounded-[var(--radius-inputs)] bg-[rgba(199,211,234,0.06)] px-3 py-2 text-body-sm text-pure-white hairline-inset w-full max-w-xs placeholder:text-moon-mist/60"
          placeholder="オフセット / hex / ASCII で検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="font-dotdigital text-caption overflow-auto max-h-[480px] leading-relaxed">
        {rows.map((offset) => (
          <HexRow
            key={offset}
            offset={offset}
            data={data}
            active={active !== undefined && active !== null && active >= offset && active < offset + ROW}
            onJump={onJump ?? setScrollTo}
          />
        ))}
      </div>
    </div>
  );
}

function HexRow({
  offset,
  data,
  active,
  onJump,
}: {
  offset: number;
  data: Uint8Array;
  active: boolean;
  onJump: (o: number) => void;
}) {
  const bytes = data.subarray(offset, offset + ROW);
  const ascii = [...bytes]
    .map((b) => (b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : "."))
    .join("");

  return (
    <button
      type="button"
      onClick={() => onJump(offset)}
      className={`w-full text-left grid grid-cols-[auto_1fr_auto] gap-4 px-1 rounded hover:bg-[rgba(186,214,247,0.06)] ${
        active ? "bg-[rgba(102,58,243,0.15)]" : ""
      }`}
    >
      <span className="text-fog-veil">{formatHex(offset)}</span>
      <span className="text-frost-glow tracking-wider">
        {[...bytes]
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(" ")
          .padEnd(ROW * 3 - 1, " ")}
      </span>
      <span className="text-moon-mist">{ascii}</span>
    </button>
  );
}
