import { useRef, useState } from "react";
import { compareBinary, type DiffSummary } from "../lib/binaryDiff";
import { loadFile } from "../lib/fileLoad";

interface Props {
  primary: Uint8Array;
  primaryName: string;
  onJump: (offset: number) => void;
}

export function DiffPanel({ primary, primaryName, onJump }: Props) {
  const [secondary, setSecondary] = useState<Uint8Array | null>(null);
  const [secondaryName, setSecondaryName] = useState<string | null>(null);
  const [summary, setSummary] = useState<DiffSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const runCompare = (b: Uint8Array) => {
    setSummary(compareBinary(primary, b));
  };

  const onPick = async (file: File) => {
    setError(null);
    try {
      const loaded = await loadFile(file);
      setSecondary(loaded.bytes);
      setSecondaryName(loaded.file.name);
      runCompare(loaded.bytes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    }
  };

  const pct =
    summary && summary.lengthA > 0
      ? ((summary.sameBytes / Math.max(summary.lengthA, summary.lengthB)) * 100).toFixed(
          1,
        )
      : null;

  return (
    <div className="space-y-4">
      <div className="glass-card hairline-inset p-4 flex flex-wrap gap-3 items-center justify-between">
        <div className="text-body-sm text-moon-mist">
          <span className="text-frost-glow">{primaryName}</span>
          <span className="text-fog-veil mx-2">vs</span>
          <span className="text-frost-glow">{secondaryName ?? "（比較ファイル未選択）"}</span>
        </div>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onPick(f);
          }}
        />
        <button
          type="button"
          className="rounded-[var(--radius-buttons)] px-4 py-2 text-body-sm hairline-inset text-frost-glow"
          onClick={() => inputRef.current?.click()}
        >
          比較ファイルを選ぶ
        </button>
      </div>

      {error && <p className="text-ember-glow text-caption">{error}</p>}

      {summary && (
        <div className="glass-card hairline-inset p-4 space-y-3">
          <p className="text-body-sm text-moon-mist">
            サイズ A={summary.lengthA} B={summary.lengthB} · 一致バイト≈{pct}%
            {summary.truncated && " · 差分領域は表示上限で切り詰め"}
          </p>
          <div className="max-h-[360px] overflow-auto font-dotdigital text-caption space-y-1">
            {summary.diffRegions.length === 0 ? (
              <p className="text-fog-veil">完全一致</p>
            ) : (
              summary.diffRegions.map((r) => (
                <button
                  key={`${r.start}-${r.end}`}
                  type="button"
                  className="block w-full text-left hover:text-frost-glow"
                  onClick={() => onJump(r.start)}
                >
                  0x{r.start.toString(16)}–0x{r.end.toString(16)} · A=
                  {r.aVal < 0 ? "—" : `0x${r.aVal.toString(16)}`} B=
                  {r.bVal < 0 ? "—" : `0x${r.bVal.toString(16)}`}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {secondary && summary && summary.diffRegions.length > 0 && (
        <p className="text-caption text-fog-veil px-1">
          差分行をクリックすると Hex タブへジャンプします（プライマリ側オフセット）。
        </p>
      )}
    </div>
  );
}
