import { useEffect, useState } from "react";
import type { Arch, DisasmInstruction } from "@hexora/shared";
import { disassemble } from "../lib/disasm";
import { formatHex } from "../lib/format";

interface Props {
  arch: Arch | null;
  baseAddress: number;
  bytes: Uint8Array;
  label: string;
  onJump?: (fileOffset: number) => void;
  onInstructions?: (items: DisasmInstruction[]) => void;
}

export function DisasmPanel({
  arch,
  baseAddress,
  bytes,
  label,
  onJump,
  onInstructions,
}: Props) {
  const [items, setItems] = useState<DisasmInstruction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    if (!arch || bytes.length === 0) {
      setItems([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void disassemble(arch, baseAddress, bytes)
      .then((res) => {
        if (cancelled) return;
        setItems(res.instructions);
        setTruncated(res.truncated);
        onInstructions?.(res.instructions);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [arch, baseAddress, bytes, onInstructions]);

  if (!arch) {
    return (
      <div className="glass-card hairline-inset p-4 text-fog-veil text-body-sm">
        このファイル形式ではディスアセンブリに未対応です。
      </div>
    );
  }

  return (
    <div className="glass-card hairline-inset p-4 flex flex-col max-h-[420px]">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="font-aeonikpro text-heading-sm text-ice-highlight">Disasm</h3>
        <span className="text-caption text-fog-veil truncate">
          {label} · Capstone WASM
        </span>
      </div>
      {loading && <p className="text-fog-veil text-caption">デコード中…</p>}
      {error && <p className="text-ember-glow text-caption">{error}</p>}
      {truncated && (
        <p className="text-fog-veil text-caption mb-2">
          表示件数上限に達しました。セクションを絞ると続きを確認できます。
        </p>
      )}
      <div className="overflow-auto font-dotdigital text-caption space-y-0.5">
        {items.map((i) => (
          <div key={i.address} className="grid grid-cols-[auto_auto_1fr] gap-3">
            <span className="text-fog-veil">{formatHex(i.address)}</span>
            <span className="text-moon-mist">{i.bytes}</span>
            <span className="text-frost-glow">
              {i.mnemonic} {i.operands}
              {i.targets?.map((t) => (
                <button
                  key={`${t.address}-${t.kind}`}
                  type="button"
                  className="ml-2 text-blueprint-blue hover:underline text-caption"
                  onClick={() => onJump?.(t.address)}
                >
                  [{t.kind} → {formatHex(t.address)}]
                </button>
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
