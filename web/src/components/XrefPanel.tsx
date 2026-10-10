import { sitesAt, type XrefDatabase } from "@hexora/shared";

interface Props {
  database: XrefDatabase | null;
  offset: number;
  onJump: (fileOffset: number) => void;
}

export function XrefPanel({ database, offset, onJump }: Props) {
  if (!database) {
    return (
      <p className="text-caption text-fog-veil">
        クロスリファレンスは PE / ELF / WebAssembly で利用できます。
      </p>
    );
  }

  const { incoming, outgoing } = sitesAt(database, offset);

  return (
    <div className="space-y-3">
      <XrefList title="参照元 (incoming)" items={incoming} onJump={onJump} />
      <XrefList title="参照先 (outgoing)" items={outgoing} onJump={onJump} />
      {incoming.length === 0 && outgoing.length === 0 && (
        <p className="text-caption text-fog-veil">このオフセットへの xref はありません。</p>
      )}
    </div>
  );
}

function XrefList({
  title,
  items,
  onJump,
}: {
  title: string;
  items: ReturnType<typeof sitesAt>["incoming"];
  onJump: (o: number) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h4 className="text-moon-mist text-body-sm font-medium mb-1">{title}</h4>
      <ul className="text-caption font-dotdigital space-y-1 max-h-32 overflow-auto">
        {items.map((s, i) => (
          <li key={`${s.kind}-${s.offset}-${i}`} className="flex flex-wrap gap-2 items-center">
            <span className="text-fog-veil">{s.kind}</span>
            {s.label && <span className="text-frost-glow">{s.label}</span>}
            {s.peerOffset !== null && s.peerOffset >= 0 && (
              <button
                type="button"
                className="text-blueprint-blue hover:underline"
                onClick={() => onJump(s.peerOffset!)}
              >
                → 0x{s.peerOffset.toString(16)}
              </button>
            )}
            {s.peerVa && <span className="text-fog-veil">{s.peerVa}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
