import { useMemo, useState } from "react";
import type { CompressionKind, XorCandidate } from "@hexora/shared";
import { tryDecodeAt, xorWithKey } from "@hexora/shared";
import { tryDecompress } from "../lib/decompress";
import type { TransformScanResult } from "../hooks/useTransformScan";

export type TransformScopeMode = "full" | "selection";

interface Props {
  data: Uint8Array;
  workData: Uint8Array;
  scopeMode: TransformScopeMode;
  onScopeModeChange: (mode: TransformScopeMode) => void;
  hexSelection: { start: number; end: number } | null;
  result: TransformScanResult | null;
  scanning: boolean;
  progress: { phase: string; percent: number } | null;
  usedWorker: boolean;
  onJump: (offset: number, length?: number) => void;
  onReanalyze: (bytes: Uint8Array, suggestedName: string) => void;
}

type SubTab = "xor" | "encoding" | "compression" | "carving";

export function TransformPanel({
  data,
  workData,
  scopeMode,
  onScopeModeChange,
  hexSelection,
  result,
  scanning,
  progress,
  usedWorker,
  onJump,
  onReanalyze,
}: Props) {
  const [sub, setSub] = useState<SubTab>("xor");
  const [preview, setPreview] = useState<{
    title: string;
    bytes: Uint8Array;
  } | null>(null);
  const [customKey, setCustomKey] = useState("");

  const applyXor = (c: XorCandidate) => {
    const decoded = xorWithKey(workData, c.key);
    setPreview({ title: `XOR key ${c.keyHex}`, bytes: decoded });
  };

  const applyCustomXor = () => {
    const parts = customKey.trim().split(/\s+/).filter(Boolean);
    const key = new Uint8Array(
      parts.map((p) => Number.parseInt(p.replace(/^0x/i, ""), 16)),
    );
    if (key.length === 0) return;
    setPreview({
      title: `XOR key ${[...key].map((b) => b.toString(16).padStart(2, "0")).join(" ")}`,
      bytes: xorWithKey(workData, key),
    });
  };

  const decompressAt = (offset: number, kind: CompressionKind) => {
    const res = tryDecompress(data, offset, kind);
    if (res.ok && res.data) {
      setPreview({
        title: `${kind} @ 0x${offset.toString(16)} (${res.data.length} B)`,
        bytes: res.data,
      });
    } else {
      setPreview({
        title: `Failed: ${res.error}`,
        bytes: new Uint8Array(),
      });
    }
  };

  const downloadPreview = () => {
    if (!preview?.bytes.length) return;
    const blob = new Blob([preview.bytes], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hexora-extract.bin";
    a.click();
    URL.revokeObjectURL(url);
  };

  const xorRows = useMemo(() => {
    if (!result) return [];
    return [...result.singleXor.slice(0, 16), ...result.repeatXor.slice(0, 8)];
  }, [result]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <nav className="flex flex-wrap gap-2">
          {(
            [
              ["xor", "XOR"],
              ["encoding", "Encoding"],
              ["compression", "Compression"],
              ["carving", "Carving"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSub(id)}
              className={`rounded-[var(--radius-buttons)] px-3 py-1.5 text-body-sm hairline-inset ${
                sub === id
                  ? "bg-[rgba(186,214,247,0.12)] text-pure-white"
                  : "text-frost-glow"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-caption text-fog-veil flex gap-2">
            <label className="inline-flex items-center gap-1">
              <input
                type="radio"
                checked={scopeMode === "full"}
                onChange={() => onScopeModeChange("full")}
              />
              Full file
            </label>
            <label className="inline-flex items-center gap-1">
              <input
                type="radio"
                checked={scopeMode === "selection"}
                disabled={!hexSelection}
                onChange={() => onScopeModeChange("selection")}
              />
              Hex selection
              {hexSelection && scopeMode === "selection"
                ? ` (${hexSelection.end - hexSelection.start + 1} B)`
                : ""}
            </label>
          </span>
          <span className="text-caption text-fog-veil">
            {scanning
              ? `Scanning ${progress?.phase ?? ""} ${progress?.percent ?? 0}%${usedWorker ? " · Worker" : ""}`
              : result
                ? "Scan complete"
                : "Waiting…"}
          </span>
        </div>
      </div>

      {sub === "xor" && (
        <div className="glass-card hairline-inset p-4 space-y-4">
          <div className="flex flex-wrap gap-2 items-end">
            <label className="text-caption text-moon-mist flex-1 min-w-[200px]">
              Custom key (hex bytes)
              <input
                className="mt-1 w-full rounded-[var(--radius-inputs)] bg-[rgba(199,211,234,0.06)] px-3 py-2 text-body-sm hairline-inset"
                placeholder="41 42 43 or 414243"
                value={customKey}
                onChange={(e) => setCustomKey(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="rounded-[var(--radius-buttons)] px-4 py-2 text-body-sm hairline-inset"
              onClick={applyCustomXor}
            >
              Apply XOR
            </button>
          </div>
          <CandidateTable
            rows={xorRows}
            onApply={applyXor}
            empty={!scanning && xorRows.length === 0}
          />
        </div>
      )}

      {sub === "encoding" && result && (
        <HitTable
          title="Encoded regions (heuristic)"
          rows={result.encodings.map((e) => ({
            offset: e.offset,
            label: e.kind,
            detail: `${(e.confidence * 100).toFixed(0)}% · ${e.decodedPreview}`,
            length: e.length,
          }))}
          onJump={(o, len) => onJump(o, len)}
          actionLabel="Decode"
          onAction={(row) => {
            const hit = result.encodings.find((x) => x.offset === row.offset);
            if (!hit) return;
            const bytes = tryDecodeAt(data, hit.offset, hit.kind, hit.length);
            if (bytes) {
              setPreview({
                title: `${hit.kind} @ 0x${hit.offset.toString(16)}`,
                bytes,
              });
            }
          }}
        />
      )}

      {sub === "compression" && result && (
        <div className="space-y-2">
          <HitTable
            title="Compression signatures"
            rows={result.compression.map((c) => ({
              offset: c.offset,
              label: c.kind,
              detail: `${c.description}${c.heuristic ? " (heuristic)" : ""}`,
            }))}
            onJump={(o) => onJump(o)}
            actionLabel="Inflate"
            onAction={(row) => {
              const hit = result.compression.find((x) => x.offset === row.offset);
              if (hit) decompressAt(hit.offset, hit.kind);
            }}
          />
          <p className="text-caption text-fog-veil px-1">
            gzip / zlib / deflate は fflate で展開。zip/bzip2/xz/zstd は検出のみ（カービングで抽出）。
          </p>
        </div>
      )}

      {sub === "carving" && result && (
        <HitTable
          title="Carved artifacts"
          rows={result.carved.map((c) => ({
            offset: c.offset,
            label: c.label,
            detail: `${c.length} B · ${c.previewHex}…`,
            length: c.length,
          }))}
          onJump={(o, len) => onJump(o, len)}
          actionLabel="Extract"
          onAction={(row) => {
            const art = result.carved.find((x) => x.offset === row.offset);
            if (!art) return;
            const slice = data.subarray(art.offset, art.offset + art.length);
            setPreview({
              title: `${art.label} @ 0x${art.offset.toString(16)}`,
              bytes: slice,
            });
          }}
        />
      )}

      {preview && (
        <div className="glass-card hairline-inset p-4">
          <div className="flex flex-wrap justify-between gap-2 mb-2">
            <h4 className="text-moon-mist text-body-sm font-medium">{preview.title}</h4>
            <div className="flex gap-2">
              <button
                type="button"
                className="text-caption hairline-inset px-2 py-1 rounded"
                onClick={() => setPreview(null)}
              >
                Close
              </button>
              <button
                type="button"
                disabled={!preview.bytes.length}
                className="text-caption hairline-inset px-2 py-1 rounded text-frost-glow"
                onClick={downloadPreview}
              >
                Download
              </button>
              <button
                type="button"
                disabled={!preview.bytes.length}
                className="text-caption hairline-inset px-2 py-1 rounded text-blueprint-blue"
                onClick={() =>
                  onReanalyze(preview.bytes, preview.title.replace(/\s+/g, "_").slice(0, 48))
                }
              >
                Open as file
              </button>
            </div>
          </div>
          <p className="font-dotdigital text-caption text-frost-glow break-all max-h-32 overflow-auto">
            {previewBytes(preview.bytes)}
          </p>
          <p className="text-caption text-fog-veil mt-2">{preview.bytes.length} bytes</p>
        </div>
      )}
    </div>
  );
}

function previewBytes(buf: Uint8Array): string {
  let s = "";
  for (let i = 0; i < Math.min(buf.length, 4096); i++) {
    const b = buf[i];
    s += b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : ".";
  }
  if (buf.length > 4096) s += "\n…";
  return s;
}

function CandidateTable({
  rows,
  onApply,
  empty,
}: {
  rows: XorCandidate[];
  onApply: (c: XorCandidate) => void;
  empty: boolean;
}) {
  if (empty) {
    return <p className="text-fog-veil text-caption">No XOR candidates yet.</p>;
  }
  return (
    <table className="w-full text-caption font-dotdigital">
      <thead className="text-fog-veil">
        <tr>
          <th className="text-left py-1">Key</th>
          <th className="text-left py-1">Score</th>
          <th className="text-left py-1">Print%</th>
          <th className="text-left py-1">ΔH</th>
          <th className="text-left py-1">Preview</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {rows.map((c, i) => (
          <tr key={`${c.keyHex}-${i}`} className="border-t border-[rgba(186,215,247,0.06)]">
            <td className="py-1.5 text-frost-glow">{c.keyHex}</td>
            <td className="py-1.5">{c.score.toFixed(2)}</td>
            <td className="py-1.5">{(c.printableRatio * 100).toFixed(0)}%</td>
            <td className="py-1.5">{c.entropyDelta.toFixed(2)}</td>
            <td className="py-1.5 text-moon-mist max-w-md truncate">{c.preview}</td>
            <td className="py-1.5 text-right">
              <button
                type="button"
                className="text-blueprint-blue hover:underline"
                onClick={() => onApply(c)}
              >
                Apply
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function HitTable({
  title,
  rows,
  onJump,
  actionLabel,
  onAction,
}: {
  title: string;
  rows: { offset: number; label: string; detail: string; length?: number }[];
  onJump: (offset: number, length?: number) => void;
  actionLabel?: string;
  onAction?: (row: { offset: number; label: string; detail: string }) => void;
}) {
  return (
    <div className="glass-card hairline-inset p-4 max-h-[420px] overflow-auto">
      <h4 className="text-moon-mist text-body-sm font-medium mb-2">{title}</h4>
      {rows.length === 0 ? (
        <p className="text-fog-veil text-caption">No hits.</p>
      ) : (
        <ul className="space-y-1 text-caption font-dotdigital">
          {rows.map((r) => (
            <li
              key={`${r.label}-${r.offset}`}
              className="flex flex-wrap items-center gap-2 py-1 border-b border-[rgba(186,215,247,0.04)]"
            >
              <button
                type="button"
                className="text-fog-veil hover:text-frost-glow"
                onClick={() => onJump(r.offset, r.length)}
              >
                0x{r.offset.toString(16)}
              </button>
              <span className="text-frost-glow">{r.label}</span>
              <span className="text-moon-mist break-all flex-1">{r.detail}</span>
              {actionLabel && onAction && (
                <button
                  type="button"
                  className="text-blueprint-blue hover:underline"
                  onClick={() => onAction(r)}
                >
                  {actionLabel}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
