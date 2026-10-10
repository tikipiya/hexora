import { useEffect, useRef, useState } from "react";
import type { FileSession } from "../lib/workspace/types";
import {
  downloadJson,
  exportSessionsWithBytes,
  importSessionsFromExport,
  type WorkspaceManifest,
} from "../lib/workspace/storage";

interface StoredRow {
  id: string;
  fileName: string;
  savedAt: number;
  size: number;
  sha256: string;
}

interface Props {
  sessions: FileSession[];
  active: FileSession | null;
  storageBusy: boolean;
  onSaveActive: () => void;
  onSaveAll: () => void;
  onRestore: (id: string) => void;
  onDeleteStored: (id: string) => void;
  listStored: () => Promise<StoredRow[]>;
  onImportSessions: (sessions: FileSession[]) => void;
  onNotesChange: (notes: string) => void;
}

export function WorkspacePanel({
  sessions,
  active,
  storageBusy,
  onSaveActive,
  onSaveAll,
  onRestore,
  onDeleteStored,
  listStored,
  onImportSessions,
  onNotesChange,
}: Props) {
  const [stored, setStored] = useState<StoredRow[]>([]);
  const importRef = useRef<HTMLInputElement>(null);

  const refresh = () => {
    void listStored().then(setStored);
  };

  useEffect(() => {
    refresh();
  }, [sessions.length, storageBusy]);

  const exportAll = () => {
    const { manifest, files } = exportSessionsWithBytes(sessions);
    downloadJson(`hexora-workspace-${Date.now()}.json`, { manifest, files });
  };

  const onImportFile = async (file: File) => {
    const text = await file.text();
    const payload = JSON.parse(text) as {
      manifest: WorkspaceManifest;
      files?: Parameters<typeof importSessionsFromExport>[0]["files"];
    };
    const imported = await importSessionsFromExport(payload);
    onImportSessions(imported);
  };

  return (
    <div className="glass-card hairline-inset p-4 space-y-4">
      <h3 className="font-aeonikpro text-heading-sm text-ice-highlight">ワークスペース</h3>
      <p className="text-caption text-fog-veil">
        開いている {sessions.length} ファイル。バイト列と UI 状態（タブ・Disasm スライス・メモ）を
        IndexedDB に保存、または JSON でエクスポートできます。
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!active || storageBusy}
          className="rounded-[var(--radius-buttons)] px-4 py-2 text-body-sm hairline-inset text-frost-glow disabled:opacity-40"
          onClick={onSaveActive}
        >
          現在のファイルを保存
        </button>
        <button
          type="button"
          disabled={sessions.length === 0 || storageBusy}
          className="rounded-[var(--radius-buttons)] px-4 py-2 text-body-sm hairline-inset text-frost-glow disabled:opacity-40"
          onClick={onSaveAll}
        >
          すべて保存
        </button>
        <button
          type="button"
          disabled={sessions.length === 0}
          className="rounded-[var(--radius-buttons)] px-4 py-2 text-body-sm hairline-inset text-frost-glow"
          onClick={exportAll}
        >
          JSON エクスポート
        </button>
        <button
          type="button"
          className="rounded-[var(--radius-buttons)] px-4 py-2 text-body-sm hairline-inset text-frost-glow"
          onClick={() => importRef.current?.click()}
        >
          JSON インポート
        </button>
        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onImportFile(f);
          }}
        />
      </div>

      {active && (
        <label className="block text-body-sm">
          <span className="text-moon-mist">メモ（{active.fileName}）</span>
          <textarea
            className="mt-1 w-full min-h-[72px] rounded-lg bg-[rgba(0,0,0,0.25)] border border-[rgba(186,215,247,0.12)] p-2 text-caption text-frost-glow font-dotdigital"
            value={active.ui.notes}
            onChange={(e) => onNotesChange(e.target.value)}
          />
        </label>
      )}

      <div>
        <h4 className="text-moon-mist text-body-sm font-medium mb-2">IndexedDB に保存済み</h4>
        {stored.length === 0 ? (
          <p className="text-caption text-fog-veil">まだありません。</p>
        ) : (
          <ul className="text-caption font-dotdigital space-y-2 max-h-48 overflow-auto">
            {stored.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-2 justify-between border-t border-[rgba(186,215,247,0.06)] pt-2"
              >
                <span className="text-frost-glow truncate">{r.fileName}</span>
                <span className="text-fog-veil">
                  {(r.size / 1024).toFixed(1)} KiB · {new Date(r.savedAt).toLocaleString()}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-blueprint-blue hover:underline"
                    onClick={() => onRestore(r.id)}
                  >
                    開く
                  </button>
                  <button
                    type="button"
                    className="text-ember-glow hover:underline"
                    onClick={() => {
                      void onDeleteStored(r.id).then(refresh);
                    }}
                  >
                    削除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
