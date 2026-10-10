import type { ExtractedString } from "../lib/strings";

interface Props {
  strings: ExtractedString[];
  onSelect: (offset: number) => void;
}

export function StringsPanel({ strings, onSelect }: Props) {
  return (
    <div className="glass-card hairline-inset p-4 max-h-[360px] flex flex-col">
      <h3 className="font-aeonikpro text-heading-sm text-ice-highlight mb-2">
        Strings
      </h3>
      <p className="text-fog-veil text-caption mb-3">
        {strings.length} 件（ASCII / UTF-16LE、最小長 4）
      </p>
      <ul className="overflow-auto text-body-sm space-y-1 font-dotdigital">
        {strings.map((s) => (
          <li key={`${s.offset}-${s.encoding}`}>
            <button
              type="button"
              className="w-full text-left px-2 py-1 rounded hover:bg-[rgba(186,214,247,0.06)]"
              onClick={() => onSelect(s.offset)}
            >
              <span className="text-fog-veil mr-2">0x{s.offset.toString(16)}</span>
              <span className="text-frost-glow break-all">{s.value}</span>
              <span className="text-fog-veil ml-2 text-caption">{s.encoding}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
