import { useMemo, useState } from "react";
import type { ExtractedString, StringEncoding, StringTag } from "../lib/strings";

interface Props {
  strings: ExtractedString[];
  scanning?: boolean;
  truncated?: boolean;
  minLength: number;
  onMinLengthChange: (n: number) => void;
  dedupe: boolean;
  onDedupeChange: (v: boolean) => void;
  onSelect: (offset: number, length: number) => void;
}

const ENCODING_LABEL: Record<StringEncoding, string> = {
  ascii: "ASCII",
  latin1: "Latin-1",
  utf8: "UTF-8",
  utf16le: "UTF-16LE",
  utf16be: "UTF-16BE",
};

const TAG_STYLE: Record<StringTag, string> = {
  url: "text-blueprint-blue",
  path: "text-moon-mist",
  ip: "text-deep-teal",
  email: "text-frost-glow",
  registry: "text-fog-veil",
  pem: "text-ember-glow",
};

export function StringsPanel({
  strings,
  scanning,
  truncated,
  minLength,
  onMinLengthChange,
  dedupe,
  onDedupeChange,
  onSelect,
}: Props) {
  const [filter, setFilter] = useState("");
  const [encodingFilter, setEncodingFilter] = useState<StringEncoding | "all">("all");
  const [tagFilter, setTagFilter] = useState<StringTag | "all">("all");
  const [sort, setSort] = useState<"offset" | "length">("offset");

  const filtered = useMemo(() => {
    let list = strings;
    if (encodingFilter !== "all") {
      list = list.filter((s) => s.encoding === encodingFilter);
    }
    if (tagFilter !== "all") {
      list = list.filter((s) => s.tags.includes(tagFilter));
    }
    if (filter.trim()) {
      const q = filter.toLowerCase();
      const isRegex = filter.startsWith("r:");
      if (isRegex) {
        try {
          const re = new RegExp(filter.slice(2), "i");
          list = list.filter((s) => re.test(s.value));
        } catch {
          list = [];
        }
      } else {
        list = list.filter((s) => s.value.toLowerCase().includes(q));
      }
    }
    if (sort === "length") {
      list = [...list].sort((a, b) => b.value.length - a.value.length);
    }
    return list;
  }, [strings, filter, encodingFilter, tagFilter, sort]);

  const exportText = () => {
    const body = filtered.map((s) => `0x${s.offset.toString(16)}\t${s.encoding}\t${s.value}`).join("\n");
    const blob = new Blob([body], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hexora-strings.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="glass-card hairline-inset p-4 flex flex-col min-h-[400px] max-h-[min(80vh,720px)]">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="font-aeonikpro text-heading-sm text-ice-highlight">Strings</h3>
        <button
          type="button"
          disabled={filtered.length === 0}
          className="text-caption hairline-inset rounded-[var(--radius-badges)] px-2 py-1 text-frost-glow disabled:opacity-40"
          onClick={exportText}
        >
          Export
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-3 text-caption">
        <label className="flex items-center gap-2 text-moon-mist">
          Min
          <input
            type="number"
            min={2}
            max={64}
            value={minLength}
            onChange={(e) => onMinLengthChange(Number(e.target.value) || 4)}
            className="w-14 rounded-[var(--radius-inputs)] bg-[rgba(199,211,234,0.06)] px-2 py-1 text-pure-white hairline-inset"
          />
        </label>
        <label className="flex items-center gap-2 text-moon-mist">
          <input
            type="checkbox"
            checked={dedupe}
            onChange={(e) => onDedupeChange(e.target.checked)}
          />
          重複除去
        </label>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as "offset" | "length")}
          className="rounded-[var(--radius-inputs)] bg-[rgba(199,211,234,0.06)] px-2 py-1 text-frost-glow hairline-inset"
        >
          <option value="offset">オフセット順</option>
          <option value="length">長さ順</option>
        </select>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <input
          className="flex-1 min-w-[160px] rounded-[var(--radius-inputs)] bg-[rgba(199,211,234,0.06)] px-3 py-2 text-body-sm text-pure-white hairline-inset placeholder:text-moon-mist/60"
          placeholder="フィルタ（r:regex 可）"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <select
          value={encodingFilter}
          onChange={(e) => setEncodingFilter(e.target.value as StringEncoding | "all")}
          className="rounded-[var(--radius-inputs)] bg-[rgba(199,211,234,0.06)] px-2 py-2 text-body-sm hairline-inset"
        >
          <option value="all">All encodings</option>
          {(Object.keys(ENCODING_LABEL) as StringEncoding[]).map((k) => (
            <option key={k} value={k}>{ENCODING_LABEL[k]}</option>
          ))}
        </select>
        <select
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value as StringTag | "all")}
          className="rounded-[var(--radius-inputs)] bg-[rgba(199,211,234,0.06)] px-2 py-2 text-body-sm hairline-inset"
        >
          <option value="all">All tags</option>
          <option value="url">URL</option>
          <option value="path">Path</option>
          <option value="ip">IP</option>
          <option value="email">Email</option>
          <option value="registry">Registry</option>
          <option value="pem">PEM</option>
        </select>
      </div>

      <p className="text-fog-veil text-caption mb-2">
        {scanning
          ? "スキャン中…"
          : `${filtered.length.toLocaleString()} / ${strings.length.toLocaleString()} 件表示`}
        {truncated && " · 上限に達したため一部のみ"}
      </p>

      <ul className="overflow-auto text-body-sm space-y-0.5 font-dotdigital flex-1">
        {filtered.map((s) => (
          <li key={`${s.offset}-${s.encoding}-${s.value.slice(0, 8)}`}>
            <button
              type="button"
              className="w-full text-left px-2 py-1.5 rounded hover:bg-[rgba(186,214,247,0.06)] grid grid-cols-[auto_1fr] gap-2"
              onClick={() => onSelect(s.offset, s.length)}
            >
              <span className="text-fog-veil whitespace-nowrap">
                0x{s.offset.toString(16)}
                <span className="ml-2 text-[10px] opacity-70">
                  {ENCODING_LABEL[s.encoding]}
                </span>
              </span>
              <span className="text-frost-glow break-all text-left">
                {s.value}
                {s.tags.length > 0 && (
                  <span className="ml-2 inline-flex gap-1">
                    {s.tags.map((t) => (
                      <span
                        key={t}
                        className={`text-[10px] uppercase ${TAG_STYLE[t]}`}
                      >
                        {t}
                      </span>
                    ))}
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
