import { useMemo } from "react";
import type { MemoryMap } from "../lib/memoryMap";
import { inspectAt, inspectStructBlock } from "../lib/structInspector";

interface Props {
  data: Uint8Array;
  cursor: number;
  selection: { start: number; end: number } | null;
  memoryMap: MemoryMap | null;
  onFollow: (fileOffset: number) => void;
}

export function HexInspector({
  data,
  cursor,
  selection,
  memoryMap,
  onFollow,
}: Props) {
  const fields = useMemo(
    () => inspectAt({ data, offset: cursor, map: memoryMap }),
    [data, cursor, memoryMap],
  );

  const structFields = useMemo(() => {
    if (!selection || selection.end <= selection.start) return [];
    const len = selection.end - selection.start + 1;
    if (len < 8) return [];
    const stride = memoryMap?.is64 ? 8 : 4;
    return inspectStructBlock(
      data,
      selection.start,
      selection.end,
      memoryMap,
      stride,
    );
  }, [data, selection, memoryMap]);

  return (
    <div className="glass-card hairline-inset p-4 flex flex-col gap-4 min-h-[200px] max-h-[min(70vh,560px)] overflow-auto">
      <div>
        <h3 className="font-aeonikpro text-heading-sm text-ice-highlight mb-1">
          Inspector
        </h3>
        <p className="text-caption text-fog-veil">
          カーソル 0x{cursor.toString(16)}
          {memoryMap && (
            <span className="ml-2">
              · {memoryMap.is64 ? "64-bit" : "32-bit"} ·{" "}
              {memoryMap.littleEndian ? "LE" : "BE"}
            </span>
          )}
        </p>
      </div>

      <FieldTable title="デコード" fields={fields} onFollow={onFollow} />

      {structFields.length > 0 && (
        <FieldTable
          title={`選択範囲（${memoryMap?.is64 ? "qword" : "dword"} 配列）`}
          fields={structFields}
          onFollow={onFollow}
        />
      )}

      {!memoryMap && (
        <p className="text-caption text-fog-veil">
          PE / ELF 以外はポインタ追跡は利用できません。
        </p>
      )}
    </div>
  );
}

function FieldTable({
  title,
  fields,
  onFollow,
}: {
  title: string;
  fields: ReturnType<typeof inspectAt>;
  onFollow: (o: number) => void;
}) {
  return (
    <div>
      <h4 className="text-moon-mist text-body-sm font-medium mb-2">{title}</h4>
      <table className="w-full text-caption font-dotdigital">
        <thead className="text-fog-veil">
          <tr>
            <th className="text-left py-1 pr-2">型</th>
            <th className="text-left py-1 pr-2">値</th>
            <th className="text-right py-1">追跡</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f) => (
            <tr key={`${f.id}-${f.offset}`} className="border-t border-[rgba(186,215,247,0.06)]">
              <td className="py-1.5 pr-2 text-moon-mist whitespace-nowrap">{f.label}</td>
              <td className="py-1.5 pr-2 text-frost-glow break-all">{f.display}</td>
              <td className="py-1.5 text-right">
                {f.followFileOffset !== undefined ? (
                  <button
                    type="button"
                    className="text-blueprint-blue hover:underline"
                    onClick={() => onFollow(f.followFileOffset!)}
                  >
                    → 0x{f.followFileOffset.toString(16)}
                  </button>
                ) : (
                  <span className="text-fog-veil">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
