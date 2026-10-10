import { useCallback, useRef, useState } from "react";
import { formatBytes } from "../lib/format";
import {
  FILE_SIZE_SOFT_WARN,
  FileLoadError,
  loadFile,
  type LoadProgress,
} from "../lib/fileLoad";

interface Props {
  onLoaded: (result: Awaited<ReturnType<typeof loadFile>>) => void;
  onError?: (message: string) => void;
}

export function FileDropzone({ onLoaded, onError }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState<LoadProgress | null>(null);
  const [busy, setBusy] = useState(false);

  const processFile = useCallback(
    async (file: File) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setBusy(true);
      setProgress({ loaded: 0, total: file.size, phase: "read", percent: 0 });
      try {
        const result = await loadFile(
          file,
          (p) => setProgress(p),
          ac.signal,
        );
        onLoaded(result);
      } catch (e) {
        const msg =
          e instanceof FileLoadError
            ? e.message
            : "ファイルを開けませんでした。";
        onError?.(msg);
      } finally {
        setBusy(false);
        setProgress(null);
        abortRef.current = null;
      }
    },
    [onLoaded, onError],
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      void processFile(file);
    },
    [processFile],
  );

  const cancel = () => {
    abortRef.current?.abort();
  };

  return (
    <div
      className={`glass-card hairline-inset p-8 text-center transition-colors relative ${
        drag ? "bg-[rgba(186,214,247,0.08)]" : ""
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <p className="text-moon-mist text-body-sm mb-2">
        バイナリをドロップ、またはファイルを選択
      </p>
      <p className="text-fog-veil text-caption mb-6 max-w-md mx-auto">
        読み込み・ハッシュ・ストリング・Hex はすべてブラウザ内。
        {formatBytes(FILE_SIZE_SOFT_WARN)} 超で警告、256 MiB 超は拒否します。
      </p>

      {busy && progress && (
        <div className="max-w-sm mx-auto mb-6 text-left">
          <div className="flex justify-between text-caption text-moon-mist mb-1">
            <span>{progress.phase === "ready" ? "準備完了" : "読み込み中"}</span>
            <span>{progress.percent}%</span>
          </div>
          <div className="h-2 rounded-full bg-[rgba(199,211,234,0.08)] overflow-hidden">
            <div
              className="h-full bg-void-violet transition-all"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <button
            type="button"
            className="mt-2 text-caption text-fog-veil hover:text-frost-glow"
            onClick={cancel}
          >
            キャンセル
          </button>
        </div>
      )}

      <button
        type="button"
        disabled={busy}
        className="rounded-[var(--radius-buttons)] px-4 py-2 text-body-sm font-medium text-pure-white bg-[rgba(186,214,247,0.06)] hairline-inset hover:bg-[rgba(186,214,247,0.12)] disabled:opacity-50"
        onClick={() => inputRef.current?.click()}
      >
        {busy ? "読み込み中…" : "バイナリを開く"}
      </button>
    </div>
  );
}

export function FileMeta({
  name,
  size,
  warnedLarge,
  formatLabel,
}: {
  name: string;
  size: number;
  warnedLarge?: boolean;
  formatLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-body-sm">
      <span className="rounded-[var(--radius-badges)] bg-luminous-fill px-2 py-1 text-frost-glow font-medium max-w-[min(100%,320px)] truncate">
        {name}
      </span>
      <span className="text-fog-veil">{formatBytes(size)}</span>
      {formatLabel && (
        <span className="rounded-[var(--radius-badges)] bg-[rgba(186,214,247,0.06)] px-2 py-0.5 text-caption text-moon-mist">
          {formatLabel}
        </span>
      )}
      {warnedLarge && (
        <span className="text-caption text-ember-glow">大容量ファイル</span>
      )}
    </div>
  );
}
