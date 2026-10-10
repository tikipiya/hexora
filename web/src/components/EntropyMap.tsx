import { chunkEntropy, entropyColor } from "../lib/entropy";

interface Props {
  data: Uint8Array;
  onSelect?: (offset: number) => void;
}

export function EntropyMap({ data, onSelect }: Props) {
  const chunks = chunkEntropy(data, 256);

  return (
    <div className="glass-card hairline-inset p-4">
      <h3 className="font-aeonikpro text-heading-sm text-ice-highlight mb-2">
        Entropy
      </h3>
      <p className="text-fog-veil text-caption mb-4">
        256 バイト単位のシャノンエントロピー（0–8）。高い領域は圧縮・暗号化の可能性。
      </p>
      <div className="flex flex-wrap gap-0.5 max-h-40 overflow-auto">
        {chunks.map((c) => (
          <button
            key={c.offset}
            type="button"
            title={`${c.offset}: ${c.entropy.toFixed(2)}`}
            className="h-3 w-3 rounded-sm opacity-90 hover:ring-1 hover:ring-frost-glow"
            style={{ backgroundColor: entropyColor(c.entropy) }}
            onClick={() => onSelect?.(c.offset)}
          />
        ))}
      </div>
    </div>
  );
}
