import { useState } from "react";
import type { BinaryAnalysis } from "../lib/binaryAnalysis";
import {
  elfFileToVa,
  elfVaToFile,
  peFileToRva,
  peRvaToFile,
  peVaToRva,
  peRvaToVa,
} from "@hexora/shared";

interface Props {
  analysis: BinaryAnalysis;
  onJump: (fileOffset: number) => void;
}

export function AddressConverter({ analysis, onJump }: Props) {
  const [input, setInput] = useState("");
  const [kind, setKind] = useState<"file" | "rva" | "va" | "vaddr">("file");
  const [result, setResult] = useState<string>("");

  const convert = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const n = trimmed.startsWith("0x") ? Number.parseInt(trimmed, 16) : Number.parseInt(trimmed, 10);
    if (!Number.isFinite(n)) {
      setResult("Invalid number");
      return;
    }

    if (analysis.kind === "pe" && analysis.peSpace) {
      let res;
      if (kind === "file") res = peFileToRva(analysis.peSpace, n);
      else if (kind === "rva") res = peRvaToFile(analysis.peSpace, n);
      else if (kind === "va") {
        const rva = peVaToRva(analysis.peSpace, BigInt(n));
        res = rva === null ? null : peRvaToFile(analysis.peSpace, rva);
      } else res = peRvaToFile(analysis.peSpace, n);
      if (!res) {
        setResult("Conversion failed");
        return;
      }
      const va =
        res.rva !== undefined
          ? peRvaToVa(analysis.peSpace, res.rva).toString()
          : res.va;
      setResult(
        `status=${res.status} file=0x${res.fileOffset?.toString(16) ?? "—"} RVA=0x${res.rva?.toString(16) ?? "—"} VA=${va ?? "—"} ${res.sectionName ?? ""}`,
      );
      if (res.fileOffset !== undefined && res.status === "mapped") {
        onJump(res.fileOffset);
      }
      return;
    }

    if (analysis.kind === "elf" && analysis.elfSpace) {
      const res =
        kind === "file" || kind === "vaddr"
          ? elfFileToVa(analysis.elfSpace, n)
          : elfVaToFile(analysis.elfSpace, BigInt(n));
      setResult(
        `status=${res.status} file=0x${res.fileOffset?.toString(16) ?? "—"} VA=${res.vaddr ?? "—"} ${res.messages.join("; ")}`,
      );
      if (res.fileOffset !== undefined && res.status === "mapped") onJump(res.fileOffset);
      return;
    }

    setResult("Load a PE or ELF file first");
  };

  const pe = analysis.kind === "pe";
  const elf = analysis.kind === "elf";

  return (
    <div className="glass-card hairline-inset p-4 space-y-3">
      <h3 className="font-aeonikpro text-heading-sm text-ice-highlight">
        Address converter
      </h3>
      <p className="text-caption text-fog-veil">
        {pe && "File offset · RVA · VA（ImageBase 付き）"}
        {elf && "File offset · 仮想アドレス（PT_LOAD 基準）"}
        {!pe && !elf && "PE / ELF を開いてください"}
      </p>
      <div className="flex flex-wrap gap-2">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as typeof kind)}
          className="rounded-[var(--radius-inputs)] bg-[rgba(199,211,234,0.06)] px-2 py-2 text-body-sm hairline-inset"
        >
          <option value="file">File offset</option>
          {pe && <option value="rva">RVA</option>}
          {pe && <option value="va">VA</option>}
          {elf && <option value="vaddr">VAddr</option>}
        </select>
        <input
          className="flex-1 min-w-[120px] rounded-[var(--radius-inputs)] bg-[rgba(199,211,234,0.06)] px-3 py-2 text-body-sm hairline-inset"
          placeholder="0x1000"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          type="button"
          className="rounded-[var(--radius-buttons)] px-4 py-2 text-body-sm bg-[rgba(186,214,247,0.08)] hairline-inset"
          onClick={convert}
        >
          Convert
        </button>
      </div>
      {result && (
        <p className="font-dotdigital text-caption text-moon-mist break-all">{result}</p>
      )}
    </div>
  );
}
