import { useCallback, useRef, useState } from "react";
import { formatBytes } from "../lib/format";

interface Props {
  onFile: (file: File, buffer: ArrayBuffer) => void;
  busy?: boolean;
}

export function FileDropzone({ onFile, busy }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      const buffer = await file.arrayBuffer();
      onFile(file, buffer);
    },
    [onFile],
  );

  return (
    <div
      className={`glass-card hairline-inset p-8 text-center transition-colors ${
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
        void handleFiles(e.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
      <p className="text-moon-mist text-body-sm mb-2">
        PE / ELF をドロップ、またはファイルを選択
      </p>
      <p className="text-fog-veil text-caption mb-6">
        解析はブラウザ内で実行。4 KiB を超えるディスアセンブリのみ Worker に送信します。
      </p>
      <button
        type="button"
        disabled={busy}
        className="rounded-[var(--radius-buttons)] px-4 py-2 text-body-sm font-medium text-pure-white bg-[rgba(186,214,247,0.06)] hairline-inset hover:bg-[rgba(186,214,247,0.12)] disabled:opacity-50"
        onClick={() => inputRef.current?.click()}
      >
        {busy ? "解析中…" : "バイナリを開く"}
      </button>
    </div>
  );
}

export function FileMeta({
  name,
  size,
}: {
  name: string;
  size: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-body-sm">
      <span className="rounded-[var(--radius-badges)] bg-luminous-fill px-2 py-1 text-frost-glow font-medium">
        {name}
      </span>
      <span className="text-fog-veil">{formatBytes(size)}</span>
    </div>
  );
}
