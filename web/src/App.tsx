import { useCallback, useMemo, useState } from "react";
import type { Arch } from "@hexora/shared";
import { Background } from "./components/Background";
import { AddressConverter } from "./components/AddressConverter";
import { AnalysisWarnings } from "./components/AnalysisWarnings";
import { BinaryStructureView } from "./components/BinaryStructureView";
import { DisasmPanel } from "./components/DisasmPanel";
import { EntropyMap } from "./components/EntropyMap";
import { Eyebrow } from "./components/Eyebrow";
import { FileDropzone, FileMeta } from "./components/FileDropzone";
import { HashPanel } from "./components/HashPanel";
import { HexViewer } from "./components/HexViewer";
import { StringsPanel } from "./components/StringsPanel";
import { useExtractedStrings } from "./hooks/useExtractedStrings";
import { analyzeBinary, type BinaryAnalysis } from "./lib/binaryAnalysis";
import type { LoadedFile } from "./lib/fileLoad";
import { regionsFromAnalysis } from "./lib/memoryMap";
import { DEFAULT_STRING_OPTIONS } from "./lib/strings";

type Tab = "overview" | "hex" | "strings" | "disasm" | "structure";

export function App() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [data, setData] = useState<Uint8Array | null>(null);
  const [analysis, setAnalysis] = useState<BinaryAnalysis | null>(null);
  const [warnedLarge, setWarnedLarge] = useState(false);
  const [hashes, setHashes] = useState<LoadedFile["hashes"] | null>(null);
  const [loadBusy, setLoadBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [jumpOffset, setJumpOffset] = useState<number | undefined>();
  const [hexFocus, setHexFocus] = useState<{ start: number; end: number } | null>(
    null,
  );
  const [stringMinLen, setStringMinLen] = useState(DEFAULT_STRING_OPTIONS.minLength);
  const [stringDedupe, setStringDedupe] = useState(DEFAULT_STRING_OPTIONS.dedupe);
  const [disasmSlice, setDisasmSlice] = useState<{
    arch: Arch;
    base: number;
    bytes: Uint8Array;
    label: string;
  } | null>(null);

  const stringOptions = useMemo(
    () => ({
      ...DEFAULT_STRING_OPTIONS,
      minLength: stringMinLen,
      dedupe: stringDedupe,
    }),
    [stringMinLen, stringDedupe],
  );

  const { strings, scanning, truncated, scanProgress, usedWorker } =
    useExtractedStrings(data, stringOptions);

  const hexRegions = useMemo(
    () => (analysis ? regionsFromAnalysis(analysis) : []),
    [analysis],
  );

  const formatLabel = useMemo(() => {
    if (!analysis) return "Raw";
    if (analysis.kind === "pe") return analysis.pe?.isPe32Plus ? "PE32+" : "PE32";
    if (analysis.kind === "elf") return `ELF${analysis.elf?.header.class ?? ""}`;
    return "Unknown";
  }, [analysis]);

  const jumpTo = (offset: number) => {
    setJumpOffset(offset);
    setHexFocus(null);
    setTab("hex");
  };

  const onLoaded = useCallback(async (loaded: LoadedFile) => {
    setLoadError(null);
    setLoadBusy(true);
    setFileName(loaded.file.name);
    setData(loaded.bytes);
    setWarnedLarge(loaded.warnedLarge);
    setHashes(loaded.hashes);
    setTab("overview");
    setJumpOffset(undefined);
    setHexFocus(null);

    try {
      const a = analyzeBinary(loaded.buffer, "lenient");
      setAnalysis(a);

      if (a.pe) {
        const text = a.pe.sections.find((s) =>
          s.name.toLowerCase().includes(".text"),
        );
        const sec = text ?? a.pe.sections[0];
        const arch = a.pe.coff.machine === 0x8664 ? "x64" : a.pe.coff.machine === 0x014c ? "x86" : null;
        if (sec && arch) {
          const start = sec.pointerToRawData;
          const end = Math.min(start + sec.sizeOfRawData, loaded.bytes.length);
          setDisasmSlice({
            arch,
            base: Number(a.pe.imageBase + BigInt(sec.virtualAddress)),
            bytes: loaded.bytes.subarray(start, Math.min(end, start + 65536)),
            label: `${sec.name} @ ${loaded.file.name}`,
          });
        } else setDisasmSlice(null);
      } else if (a.elf) {
        const text = a.elf.sectionHeaders.find((s) => s.name === ".text");
        const sec = text ?? a.elf.sectionHeaders.find((s) => !s.isNobits && s.size > 0n);
        const machine = a.elf.header.machine;
        const arch = machine === 0x3e ? "x64" : machine === 0x03 ? "x86" : null;
        if (sec && arch && !sec.isNobits) {
          const start = Number(sec.offset);
          const size = Number(sec.size);
          setDisasmSlice({
            arch,
            base: Number(sec.addr),
            bytes: loaded.bytes.subarray(start, Math.min(start + size, start + 65536)),
            label: `${sec.name} @ ${loaded.file.name}`,
          });
        } else setDisasmSlice(null);
      } else {
        setDisasmSlice(null);
      }
    } finally {
      setLoadBusy(false);
    }
  }, []);

  const clearFile = () => {
    setData(null);
    setFileName(null);
    setHashes(null);
    setAnalysis(null);
    setDisasmSlice(null);
    setWarnedLarge(false);
    setLoadError(null);
    setJumpOffset(undefined);
    setHexFocus(null);
  };

  const allIssues = analysis?.issues ?? [];

  return (
    <div className="relative min-h-screen">
      <Background />
      <header className="mx-auto max-w-[var(--page-max-width,1200px)] px-6 pt-10 pb-6 flex items-center justify-between">
        <span className="font-aeonikpro text-body font-medium text-frost-glow">
          Hexora
        </span>
        <a
          href="https://github.com/tikipiya/hexora"
          className="rounded-[var(--radius-buttons)] px-4 py-2 text-body-sm text-frost-glow hairline-inset hover:bg-[rgba(186,214,247,0.06)]"
        >
          GitHub
        </a>
      </header>

      <main className="mx-auto max-w-[var(--page-max-width,1200px)] px-6 pb-24">
        <section className="text-center mb-16">
          <Eyebrow>Binary analysis</Eyebrow>
          <h1 className="gradient-display font-aeonikpro text-[clamp(2.5rem,8vw,4.5rem)] font-medium leading-tight mb-4">
            Hexora
          </h1>
          <p className="text-moon-mist text-body max-w-[640px] mx-auto">
            CTF 向けバイナリ解析 — ブラウザ内パース + 必要時のみ Workers（ディスアセンブリ / API 検証）。
          </p>
        </section>

        {!data && (
          <>
            {loadError && (
              <p className="text-center text-ember-glow text-body-sm mb-4">{loadError}</p>
            )}
            <FileDropzone onLoaded={onLoaded} onError={setLoadError} />
          </>
        )}

        {data && fileName && analysis && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <FileMeta
                name={fileName}
                size={data.length}
                warnedLarge={warnedLarge}
                formatLabel={formatLabel}
              />
              <button
                type="button"
                disabled={loadBusy}
                className="rounded-[var(--radius-buttons)] px-4 py-2 text-body-sm bg-void-violet text-pure-white font-medium disabled:opacity-50"
                onClick={clearFile}
              >
                別のファイル
              </button>
            </div>

            <HashPanel hashes={hashes} loading={!hashes && loadBusy} />
            <AnalysisWarnings issues={allIssues} />

            <nav className="flex flex-wrap gap-2">
              {(
                [
                  ["overview", "Overview"],
                  ["structure", "Structure"],
                  ["hex", "Hex"],
                  ["strings", "Strings"],
                  ["disasm", "Disasm"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`rounded-[var(--radius-buttons)] px-4 py-2 text-body-sm font-medium hairline-inset ${
                    tab === id
                      ? "bg-[rgba(186,214,247,0.12)] text-pure-white"
                      : "text-frost-glow bg-[rgba(186,214,247,0.04)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>

            {tab === "overview" && (
              <div className="grid gap-6 lg:grid-cols-2">
                <AddressConverter analysis={analysis} onJump={jumpTo} />
                <EntropyMap data={data} onSelect={jumpTo} />
              </div>
            )}

            {tab === "structure" && (
              <BinaryStructureView analysis={analysis} onSelectOffset={jumpTo} />
            )}

            {tab === "hex" && (
              <HexViewer
                data={data}
                highlightOffset={jumpOffset}
                focusRange={hexFocus ?? undefined}
                regions={hexRegions}
                analysis={analysis}
                onJump={(o) => setJumpOffset(o)}
              />
            )}

            {tab === "strings" && (
              <StringsPanel
                strings={strings}
                scanning={scanning}
                truncated={truncated}
                scanProgress={scanProgress}
                usedWorker={usedWorker}
                minLength={stringMinLen}
                onMinLengthChange={setStringMinLen}
                dedupe={stringDedupe}
                onDedupeChange={setStringDedupe}
                onSelect={(o, len) => {
                  setJumpOffset(o);
                  setHexFocus({ start: o, end: o + Math.max(0, len - 1) });
                  setTab("hex");
                }}
              />
            )}

            {tab === "disasm" && disasmSlice && (
              <DisasmPanel
                arch={disasmSlice.arch}
                baseAddress={disasmSlice.base}
                bytes={disasmSlice.bytes}
                label={disasmSlice.label}
              />
            )}

            {tab === "disasm" && !disasmSlice && (
              <DisasmPanel arch={null} baseAddress={0} bytes={new Uint8Array()} label="" />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
