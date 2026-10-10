import { useCallback, useMemo, useState } from "react";
import type { Arch } from "@hexora/shared";
import { Background } from "./components/Background";
import { DisasmPanel } from "./components/DisasmPanel";
import { EntropyMap } from "./components/EntropyMap";
import { Eyebrow } from "./components/Eyebrow";
import { FileDropzone, FileMeta } from "./components/FileDropzone";
import { HashPanel } from "./components/HashPanel";
import { HexViewer } from "./components/HexViewer";
import { StringsPanel } from "./components/StringsPanel";
import { StructurePanel } from "./components/StructurePanel";
import { useExtractedStrings } from "./hooks/useExtractedStrings";
import { detectBinary } from "./lib/detect";
import { elfSectionBytes } from "./lib/elf";
import type { LoadedFile } from "./lib/fileLoad";
import { regionsFromElf, regionsFromPe } from "./lib/hexRegions";
import { hashFile, type FileHashes } from "./lib/hash";
import { DEFAULT_STRING_OPTIONS } from "./lib/strings";
import { peSectionBytes } from "./lib/pe";

type Tab = "overview" | "hex" | "strings" | "disasm";

export function App() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [data, setData] = useState<Uint8Array | null>(null);
  const [warnedLarge, setWarnedLarge] = useState(false);
  const [hashes, setHashes] = useState<FileHashes | null>(null);
  const [hashBusy, setHashBusy] = useState(false);
  const [hashProgress, setHashProgress] = useState<{
    label: string;
    percent: number;
  } | null>(null);
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

  const { strings, scanning, truncated } = useExtractedStrings(data, stringOptions);

  const detected = useMemo(
    () => (data ? detectBinary(data.buffer as ArrayBuffer) : null),
    [data],
  );

  const hexRegions = useMemo(() => {
    if (detected?.pe) return regionsFromPe(detected.pe);
    if (detected?.elf) return regionsFromElf(detected.elf);
    return [];
  }, [detected]);

  const formatLabel = useMemo(() => {
    if (!detected) return "Raw";
    if (detected.format === "pe") return "PE";
    if (detected.format === "elf") return `ELF${detected.elf?.klass ?? ""}`;
    return "Unknown";
  }, [detected]);

  const onLoaded = useCallback(async (loaded: LoadedFile) => {
    setLoadError(null);
    setLoadBusy(true);
    setFileName(loaded.file.name);
    setData(loaded.bytes);
    setWarnedLarge(loaded.warnedLarge);
    setTab("overview");
    setJumpOffset(undefined);
    setHexFocus(null);
    setHashes(null);
    setHashBusy(true);
    setHashProgress({ label: "ハッシュ", percent: 0 });

    try {
      const h = await hashFile(loaded.buffer, (label, percent) => {
        setHashProgress({ label, percent });
      });
      setHashes(h);

      const d = detectBinary(loaded.buffer);
      if (d.pe) {
        const text = d.pe.sections.find((s) =>
          s.name.toLowerCase().includes(".text"),
        );
        const sec = text ?? d.pe.sections[0];
        if (sec && d.pe.summary["Disasm arch"]) {
          const arch = d.pe.summary["Disasm arch"] as Arch;
          const bytes = peSectionBytes(loaded.buffer, sec);
          setDisasmSlice({
            arch,
            base: d.pe.imageBase + sec.virtualAddress,
            bytes: bytes.subarray(0, Math.min(bytes.length, 65536)),
            label: `${sec.name} @ ${loaded.file.name}`,
          });
        } else setDisasmSlice(null);
      } else if (d.elf) {
        const text = d.elf.sections.find((s) => s.name === ".text");
        const sec = text ?? d.elf.sections.find((s) => s.size > 0);
        if (sec && d.elf.summary["Disasm arch"]) {
          const arch = d.elf.summary["Disasm arch"] as Arch;
          const bytes = elfSectionBytes(loaded.buffer, sec);
          setDisasmSlice({
            arch,
            base: sec.address,
            bytes: bytes.subarray(0, Math.min(bytes.length, 65536)),
            label: `${sec.name} @ ${loaded.file.name}`,
          });
        } else setDisasmSlice(null);
      } else {
        setDisasmSlice(null);
      }
    } finally {
      setHashBusy(false);
      setHashProgress(null);
      setLoadBusy(false);
    }
  }, []);

  const clearFile = () => {
    setData(null);
    setFileName(null);
    setHashes(null);
    setDisasmSlice(null);
    setWarnedLarge(false);
    setLoadError(null);
    setJumpOffset(undefined);
    setHexFocus(null);
  };

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
            PE / ELF の構造、ヘックス、ストリング、エントロピー、ハッシュをブラウザで解析。
            大きなコードセクションのディスアセンブリは Cloudflare Workers で実行します。
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

        {data && fileName && (
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

            <HashPanel hashes={hashes} loading={hashBusy} progress={hashProgress} />

            <nav className="flex flex-wrap gap-2">
              {(
                [
                  ["overview", "Overview"],
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
                <StructurePanel
                  pe={detected?.pe ?? null}
                  elf={detected?.elf ?? null}
                  onSectionSelect={(o) => {
                    setJumpOffset(o);
                    setHexFocus(null);
                    setTab("hex");
                  }}
                />
                <EntropyMap
                  data={data}
                  onSelect={(o) => {
                    setJumpOffset(o);
                    setHexFocus(null);
                    setTab("hex");
                  }}
                />
              </div>
            )}

            {tab === "hex" && (
              <HexViewer
                data={data}
                highlightOffset={jumpOffset}
                focusRange={hexFocus ?? undefined}
                regions={hexRegions}
                onJump={(o) => setJumpOffset(o)}
              />
            )}

            {tab === "strings" && (
              <StringsPanel
                strings={strings}
                scanning={scanning}
                truncated={truncated}
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
