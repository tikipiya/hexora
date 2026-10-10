import { useEffect, useState } from "react";
import { wasmToWat } from "../lib/wabtWasm";

interface Props {
  data: Uint8Array;
}

export function WasmWatPanel({ data }: Props) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void wasmToWat(data)
      .then((wat) => {
        if (!cancelled) setText(wat);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "WAT conversion failed");
          setText(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [data]);

  return (
    <div className="glass-card hairline-inset p-4 flex flex-col max-h-[480px]">
      <h3 className="font-aeonikpro text-heading-sm text-ice-highlight mb-2">
        WAT (wabt)
      </h3>
      {loading && <p className="text-caption text-fog-veil">変換中…</p>}
      {error && <p className="text-ember-glow text-caption">{error}</p>}
      {text && (
        <pre className="overflow-auto text-caption font-dotdigital text-moon-mist whitespace-pre-wrap">
          {text}
        </pre>
      )}
    </div>
  );
}
