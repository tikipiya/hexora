import { useEffect, useState } from "react";
import type { Arch, DisasmInstruction } from "@hexora/shared";
import { disassemble } from "../lib/disasm";
import { formatHex } from "../lib/format";

interface Props {
  arch: Arch | null;
  baseAddress: number;
  bytes: Uint8Array;
  label: string;
}

export function DisasmPanel({ arch, baseAddress, bytes, label }: Props) {
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
  }, [arch, baseAddress, bytes]);

  if (!arch) {
    return (
      <div className="glass-card hairline-inset p-4 text-fog-veil text-body-sm">
        このファイル形式では x86/x64 ディスアセンブリに未対応です。
      </div>
    );
  }

  return (
    <div className="glass-card hairline-inset p-4 flex flex-col max-h-[420px]">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="font-aeonikpro text-heading-sm text-ice-highlight">Disasm</h3>
        <span className="text-caption text-fog-veil truncate">{label}</span>
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
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
