import type { FileSession } from "../lib/workspace/types";

interface Props {
  sessions: FileSession[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onAdd: () => void;
}

export function FileTabs({ sessions, activeId, onSelect, onClose, onAdd }: Props) {
  if (sessions.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[rgba(186,215,247,0.1)] pb-3">
      {sessions.map((s) => {
        const active = s.id === activeId;
        return (
          <div
            key={s.id}
            className={`flex items-center gap-1 rounded-[var(--radius-buttons)] pl-3 pr-1 py-1.5 text-body-sm hairline-inset max-w-[220px] ${
              active
                ? "bg-[rgba(186,214,247,0.14)] text-pure-white"
                : "bg-[rgba(186,214,247,0.04)] text-frost-glow"
            }`}
          >
            <button
              type="button"
              className="truncate flex-1 text-left"
              title={s.fileName}
              onClick={() => onSelect(s.id)}
            >
              {s.fileName}
              {s.dirty && <span className="text-ember-glow ml-1">•</span>}
            </button>
            <button
              type="button"
              className="shrink-0 w-7 h-7 rounded text-fog-veil hover:text-pure-white hover:bg-[rgba(186,214,247,0.1)]"
              aria-label={`${s.fileName} を閉じる`}
              onClick={() => onClose(s.id)}
            >
              ×
            </button>
          </div>
        );
      })}
      <button
        type="button"
        className="rounded-[var(--radius-buttons)] px-3 py-1.5 text-body-sm text-blueprint-blue hairline-inset hover:bg-[rgba(186,214,247,0.06)]"
        onClick={onAdd}
      >
        + ファイル
      </button>
    </div>
  );
}
