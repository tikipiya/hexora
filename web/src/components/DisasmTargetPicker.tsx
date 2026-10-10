import { useEffect, useMemo, useState } from "react";
import type { Arch } from "@hexora/shared";
import {
  DEFAULT_DISASM_BYTES,
  listDisasmTargets,
  MAX_DISASM_BYTES,
  sliceForDisasm,
  type DisasmTarget,
  unsupportedMachineLabel,
} from "../lib/disasmTargets";
import type { BinaryAnalysis } from "../lib/binaryAnalysis";

export interface DisasmSliceState {
  arch: Arch;
  base: number;
  fileOffset: number;
  bytes: Uint8Array;
  label: string;
}

interface Props {
  data: Uint8Array;
  analysis: BinaryAnalysis;
  value: DisasmSliceState | null;
  onChange: (slice: DisasmSliceState | null) => void;
  /** Structure / Hex から「ここを Disasm」 */
  jumpFileOffset?: number;
  fileKey: string;
}

export function DisasmTargetPicker({
  data,
  analysis,
  value,
  onChange,
  jumpFileOffset,
  fileKey,
}: Props) {
  const unsupported = unsupportedMachineLabel(analysis);
  const targets = useMemo(
    () => listDisasmTargets(analysis, data.length),
    [analysis, data.length],
  );
  const [targetId, setTargetId] = useState(() => targets.find((t) => t.executable)?.id ?? targets[0]?.id ?? "");
  const [byteLimit, setByteLimit] = useState(DEFAULT_DISASM_BYTES);
  const [customOffset, setCustomOffset] = useState("0");
  const [customBase, setCustomBase] = useState("0");

  const selected = targets.find((t) => t.id === targetId) ?? targets[0];

  const applyTarget = (t: DisasmTarget, limit: number) => {
    const bytes = sliceForDisasm(data, t, limit);
    onChange({
      arch: t.arch,
      base: t.baseAddress,
      fileOffset: t.fileOffset,
      bytes,
      label: `${t.label} · ${bytes.length} B @ 0x${t.fileOffset.toString(16)}`,
    });
  };

  const applyCustom = () => {
    const arch = targets[0]?.arch;
    if (!arch) return;
    const off = Number.parseInt(customOffset.replace(/^0x/i, ""), 16);
    const base = Number.parseInt(customBase.replace(/^0x/i, ""), 16);
    if (!Number.isFinite(off) || off < 0 || off >= data.length) return;
    const limit = Math.min(byteLimit, data.length - off, MAX_DISASM_BYTES);
    onChange({
      arch,
      base,
      fileOffset: off,
      bytes: data.subarray(off, off + limit),
      label: `Custom @ 0x${off.toString(16)} · ${limit} B`,
    });
  };

  useEffect(() => {
    if (unsupported || targets.length === 0) return;
    const t = targets.find((x) => x.executable) ?? targets[0];
    if (t) {
      setTargetId(t.id);
      applyTarget(t, DEFAULT_DISASM_BYTES);
    }
  }, [fileKey, unsupported]);

  useEffect(() => {
    if (jumpFileOffset === undefined || unsupported || targets.length === 0) return;
    const t = targets.find(
      (x) =>
        jumpFileOffset >= x.fileOffset &&
        jumpFileOffset < x.fileOffset + x.maxSize,
    );
    if (t) {
      setTargetId(t.id);
      applyTarget(t, byteLimit);
    }
  }, [jumpFileOffset]);

  if (unsupported) {
    return (
      <div className="glass-card hairline-inset p-4 text-fog-veil text-body-sm">
        このマシン（{unsupported}）は x86/x64 ディスアセンブリ未対応です。ARM64 等は将来のデコーダ拡張が必要です。
      </div>
    );
  }

  if (targets.length === 0) {
    return (
      <div className="glass-card hairline-inset p-4 text-fog-veil text-body-sm">
        ディスアセンブリ対象を特定できません。
      </div>
    );
  }

  return (
    <div className="glass-card hairline-inset p-4 space-y-3">
      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-caption text-moon-mist flex-1 min-w-[200px]">
          Target
          <select
            className="mt-1 w-full rounded-[var(--radius-inputs)] bg-[rgba(199,211,234,0.06)] px-3 py-2 text-body-sm hairline-inset"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
          >
            {targets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
                {t.executable ? " · X" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="text-caption text-moon-mist w-32">
          Max bytes
          <input
            type="number"
            min={256}
            max={MAX_DISASM_BYTES}
            className="mt-1 w-full rounded-[var(--radius-inputs)] bg-[rgba(199,211,234,0.06)] px-3 py-2 text-body-sm hairline-inset"
            value={byteLimit}
            onChange={(e) => setByteLimit(Number(e.target.value) || DEFAULT_DISASM_BYTES)}
          />
        </label>
        <button
          type="button"
          className="rounded-[var(--radius-buttons)] px-4 py-2 text-body-sm hairline-inset text-frost-glow"
          onClick={() => selected && applyTarget(selected, byteLimit)}
        >
          Load
        </button>
      </div>
      <div className="flex flex-wrap gap-2 items-end border-t border-[rgba(186,215,247,0.08)] pt-3">
        <label className="text-caption text-fog-veil">
          File offset (hex)
          <input
            className="mt-1 w-28 rounded-[var(--radius-inputs)] bg-[rgba(199,211,234,0.06)] px-2 py-1.5 font-dotdigital text-body-sm hairline-inset"
            value={customOffset}
            onChange={(e) => setCustomOffset(e.target.value)}
          />
        </label>
        <label className="text-caption text-fog-veil">
          Base VA (hex)
          <input
            className="mt-1 w-28 rounded-[var(--radius-inputs)] bg-[rgba(199,211,234,0.06)] px-2 py-1.5 font-dotdigital text-body-sm hairline-inset"
            value={customBase}
            onChange={(e) => setCustomBase(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="text-caption hairline-inset px-3 py-1.5 rounded text-blueprint-blue"
          onClick={applyCustom}
        >
          Custom range
        </button>
      </div>
      {value && (
        <p className="text-caption text-fog-veil">Active: {value.label}</p>
      )}
    </div>
  );
}
