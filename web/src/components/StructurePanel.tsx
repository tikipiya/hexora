import type { ElfAnalysis } from "../lib/elf";
import type { PeAnalysis } from "../lib/pe";
import { formatHex } from "../lib/format";

interface Props {
  pe: PeAnalysis | null;
  elf: ElfAnalysis | null;
  onSectionSelect?: (offset: number) => void;
}

export function StructurePanel({ pe, elf, onSectionSelect }: Props) {
  if (!pe && !elf) {
    return (
      <div className="glass-card hairline-inset p-4 text-fog-veil text-body-sm">
        認識された PE / ELF ヘッダーがありません。Hex ビューでは raw として表示されます。
      </div>
    );
  }

  const summary = pe?.summary ?? elf?.summary ?? {};

  return (
    <div className="glass-card hairline-inset p-4 space-y-4">
      <h3 className="font-aeonikpro text-heading-sm text-ice-highlight">Structure</h3>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-body-sm">
        {Object.entries(summary).map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-fog-veil">{k}</dt>
            <dd className="text-frost-glow font-dotdigital">{v}</dd>
          </div>
        ))}
      </dl>

      {pe && (
        <SectionTable
          title="PE sections"
          rows={pe.sections.map((s) => ({
            name: s.name,
            vaddr: formatHex(s.virtualAddress),
            raw: formatHex(s.rawOffset),
            size: s.rawSize,
            offset: s.rawOffset,
          }))}
          onSelect={onSectionSelect}
        />
      )}

      {elf && (
        <SectionTable
          title="ELF sections"
          rows={elf.sections
            .filter((s) => s.type !== "NULL" && s.size > 0)
            .map((s) => ({
              name: s.name,
              vaddr: formatHex(s.address),
              raw: formatHex(s.offset),
              size: s.size,
              offset: s.offset,
            }))}
          onSelect={onSectionSelect}
        />
      )}
    </div>
  );
}

function SectionTable({
  title,
  rows,
  onSelect,
}: {
  title: string;
  rows: {
    name: string;
    vaddr: string;
    raw: string;
    size: number;
    offset: number;
  }[];
  onSelect?: (offset: number) => void;
}) {
  return (
    <div>
      <h4 className="text-moon-mist text-body-sm font-medium mb-2">{title}</h4>
      <div className="overflow-auto max-h-48">
        <table className="w-full text-caption font-dotdigital">
          <thead className="text-fog-veil">
            <tr>
              <th className="text-left py-1">Name</th>
              <th className="text-left py-1">VAddr</th>
              <th className="text-left py-1">File</th>
              <th className="text-right py-1">Size</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.name}-${r.raw}`}>
                <td className="py-1 text-frost-glow">
                  <button
                    type="button"
                    className="hover:underline"
                    onClick={() => onSelect?.(r.offset)}
                  >
                    {r.name || "(null)"}
                  </button>
                </td>
                <td className="py-1 text-moon-mist">{r.vaddr}</td>
                <td className="py-1 text-moon-mist">{r.raw}</td>
                <td className="py-1 text-right text-moon-mist">{r.size}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
