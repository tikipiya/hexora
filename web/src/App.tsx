import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildCfgFromDisasm } from "@hexora/shared";
import { Background } from "./components/Background";
import { AddressConverter } from "./components/AddressConverter";
import { AnalysisWarnings } from "./components/AnalysisWarnings";
import { BinaryStructureView } from "./components/BinaryStructureView";
import { CfgPanel } from "./components/CfgPanel";
import { DisasmPanel } from "./components/DisasmPanel";
import { DisasmTargetPicker } from "./components/DisasmTargetPicker";
import { EntropyMap } from "./components/EntropyMap";
import { Eyebrow } from "./components/Eyebrow";
import { FileDropzone, FileMeta } from "./components/FileDropzone";
import { FileTabs } from "./components/FileTabs";
import { HashPanel } from "./components/HashPanel";
import { HexViewer } from "./components/HexViewer";
import { StringsPanel } from "./components/StringsPanel";
import { TransformPanel, type TransformScopeMode } from "./components/TransformPanel";
import { WorkspacePanel } from "./components/WorkspacePanel";
import { useExtractedStrings } from "./hooks/useExtractedStrings";
import { useTransformScan } from "./hooks/useTransformScan";
import { useWorkspace } from "./hooks/useWorkspace";
import { useXrefDatabase } from "./hooks/useXrefDatabase";
import type { LoadedFile } from "./lib/fileLoad";
import { loadFile } from "./lib/fileLoad";
import { regionsFromAnalysis } from "./lib/memoryMap";
import { DEFAULT_STRING_OPTIONS } from "./lib/strings";
import { DiffPanel } from "./components/DiffPanel";
import { copyText } from "./lib/clipboard";
import { parseUrlHash, writeUrlHash, type ShareableTab } from "./lib/urlState";
import { WasmWatPanel } from "./components/WasmWatPanel";
import { base64ToUint8, uint8ToBase64 } from "./lib/base64";

type Tab = ShareableTab;

export function App() {
  const ws = useWorkspace();
  const active = ws.active;
  const data = active?.data ?? null;
  const fileName = active?.fileName ?? null;
  const analysis = active?.analysis ?? null;
  const hashes = active?.hashes ?? null;
  const warnedLarge = active?.warnedLarge ?? false;
  const ui = active?.ui;

  const [loadBusy, setLoadBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const addFileRef = useRef<HTMLInputElement>(null);

  const tab = ui?.tab ?? "overview";
  const setTab = (t: Tab) => ws.updateActiveUi({ tab: t });
  const jumpOffset = ui?.jumpOffset;
  const setJumpOffset = (o: number | undefined) => ws.updateActiveUi({ jumpOffset: o });
  const hexFocus = ui?.hexFocus ?? null;
  const setHexFocus = (r: { start: number; end: number } | null) =>
    ws.updateActiveUi({ hexFocus: r });
  const hexSelection = ui?.hexSelection ?? null;
  const setHexSelection = (r: { start: number; end: number } | null) =>
    ws.updateActiveUi({ hexSelection: r });
  const disasmSlice = ui?.disasmSlice ?? null;
  const setDisasmSlice = (s: typeof disasmSlice) => ws.updateActiveUi({ disasmSlice: s });
  const disasmJumpOffset = ui?.disasmJumpOffset;
  const setDisasmJumpOffset = (o: number | undefined) =>
    ws.updateActiveUi({ disasmJumpOffset: o });
  const disasmInstructions = ui?.disasmInstructions ?? [];
  const setDisasmInstructions = (items: typeof disasmInstructions) =>
    ws.updateActiveUi({ disasmInstructions: items });
  const stringMinLen = ui?.stringMinLen ?? DEFAULT_STRING_OPTIONS.minLength;
  const setStringMinLen = (n: number) => ws.updateActiveUi({ stringMinLen: n });
  const stringDedupe = ui?.stringDedupe ?? DEFAULT_STRING_OPTIONS.dedupe;
  const setStringDedupe = (d: boolean) => ws.updateActiveUi({ stringDedupe: d });
  const transformScope = ui?.transformScope ?? "full";
  const setTransformScope = (m: TransformScopeMode) =>
    ws.updateActiveUi({ transformScope: m });
  const diffOverlay = ui?.diffOverlay ?? false;
  const diffPeerId = ui?.diffPeerId ?? null;

  const diffPeer = useMemo(() => {
    if (diffPeerId) {
      return ws.sessions.find((s) => s.id === diffPeerId)?.data ?? null;
    }
    if (ui?.diffPeerBase64) {
      return base64ToUint8(ui.diffPeerBase64);
    }
    return null;
  }, [diffPeerId, ui?.diffPeerBase64, ws.sessions]);

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

  const transformRange = useMemo(() => {
    if (transformScope === "selection" && hexSelection) return hexSelection;
    return null;
  }, [transformScope, hexSelection]);

  const transformWorkData = useMemo(() => {
    if (!data) return null;
    if (transformRange) {
      return data.subarray(transformRange.start, transformRange.end + 1);
    }
    return data;
  }, [data, transformRange]);

  const {
    result: transformResult,
    scanning: transformScanning,
    progress: transformProgress,
    usedWorker: transformUsedWorker,
  } = useTransformScan(data, transformRange);

  const hexRegions = useMemo(
    () => (analysis ? regionsFromAnalysis(analysis) : []),
    [analysis],
  );

  const disasmXref = useMemo(() => {
    if (!disasmSlice || disasmInstructions.length === 0) return null;
    return {
      instructions: disasmInstructions,
      fileOffset: disasmSlice.fileOffset,
      baseAddress: disasmSlice.base,
      arch: disasmSlice.arch,
    };
  }, [disasmSlice, disasmInstructions]);

  const xrefDatabase = useXrefDatabase(analysis, data, disasmXref);

  const cfgGraph = useMemo(() => {
    if (!disasmSlice || disasmInstructions.length === 0) return null;
    return buildCfgFromDisasm(
      disasmInstructions,
      disasmSlice.fileOffset,
      disasmSlice.base,
      disasmSlice.arch,
    );
  }, [disasmSlice, disasmInstructions]);

  const formatLabel = useMemo(() => {
    if (!analysis) return "Raw";
    if (analysis.kind === "pe") return analysis.pe?.isPe32Plus ? "PE32+" : "PE32";
    if (analysis.kind === "elf") return `ELF${analysis.elf?.header.class ?? ""}`;
    if (analysis.kind === "macho") return `Mach-O ${analysis.macho?.cpuName ?? ""}`;
    if (analysis.kind === "wasm") return "WebAssembly";
    return "Unknown";
  }, [analysis]);

  useEffect(() => {
    if (!data) return;
    writeUrlHash({ tab, off: jumpOffset });
  }, [tab, jumpOffset, data]);

  const jumpTo = (offset: number, length?: number) => {
    setJumpOffset(offset);
    if (length !== undefined) {
      setHexFocus({ start: offset, end: offset + Math.max(0, length - 1) });
    } else {
      setHexFocus(null);
    }
    setTab("hex");
  };

  const onLoaded = useCallback(
    async (loaded: LoadedFile) => {
      setLoadError(null);
      setLoadBusy(true);
      const hash = parseUrlHash(window.location.hash);
      try {
        await ws.openLoaded(loaded, {
          tab: hash.tab ?? "overview",
          jumpOffset: hash.off,
          hexFocus: null,
        });
      } finally {
        setLoadBusy(false);
      }
    },
    [ws],
  );

  const onAddFile = async (file: File) => {
    setLoadBusy(true);
    try {
      const loaded = await loadFile(file);
      await ws.openLoaded(loaded, { tab: "overview" });
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoadBusy(false);
    }
  };

  const ingestBytes = useCallback(
    async (bytes: Uint8Array, name: string) => {
      setLoadBusy(true);
      try {
        await ws.openBytes(name, bytes);
      } finally {
        setLoadBusy(false);
      }
    },
    [ws],
  );

  const allIssues = analysis?.issues ?? [];

  const diffOpenFiles = ws.sessions
    .filter((s) => s.id !== active?.id)
    .map((s) => ({ id: s.id, name: s.fileName, data: s.data }));

  return (
    <div className="relative min-h-screen">
      <Background />
      <header className="mx-auto max-w-[var(--page-max-width,1200px)] px-6 pt-10 pb-6 flex items-center justify-between">
        <span className="font-aeonikpro text-body font-medium text-frost-glow">
          Hexora
        </span>
        <div className="flex gap-2">
          {data && (
            <button
              type="button"
              className="rounded-[var(--radius-buttons)] px-4 py-2 text-body-sm text-frost-glow hairline-inset hover:bg-[rgba(186,214,247,0.06)]"
              onClick={() => {
                writeUrlHash({ tab, off: jumpOffset });
                void copyText(window.location.href);
              }}
            >
              リンクをコピー
            </button>
          )}
          <a
            href="https://github.com/tikipiya/hexora"
            className="rounded-[var(--radius-buttons)] px-4 py-2 text-body-sm text-frost-glow hairline-inset hover:bg-[rgba(186,214,247,0.06)]"
          >
            GitHub
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-[var(--page-max-width,1200px)] px-6 pb-24">
        <section className="text-center mb-16">
          <Eyebrow>Binary analysis</Eyebrow>
          <h1 className="gradient-display font-aeonikpro text-[clamp(2.5rem,8vw,4.5rem)] font-medium leading-tight mb-4">
            Hexora
          </h1>
          <p className="text-moon-mist text-body max-w-[640px] mx-auto">
            CTF 向けバイナリ解析 — マルチファイル・CFG・セッション保存対応。
          </p>
        </section>

        {ws.sessions.length === 0 && (
          <>
            {loadError && (
              <p className="text-center text-ember-glow text-body-sm mb-4">{loadError}</p>
            )}
            <FileDropzone onLoaded={onLoaded} onError={setLoadError} />
          </>
        )}

        {active && data && fileName && analysis && (
          <div className="space-y-6">
            <FileTabs
              sessions={ws.sessions}
              activeId={ws.activeId}
              onSelect={ws.setActiveId}
              onClose={ws.closeSession}
              onAdd={() => addFileRef.current?.click()}
            />
            <input
              ref={addFileRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onAddFile(f);
              }}
            />

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
                onClick={() => ws.clearAll()}
              >
                ワークスペースを閉じる
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
                  ["cfg", "CFG"],
                  ["transform", "Transform"],
                  ["diff", "Diff"],
                  ["workspace", "Workspace"],
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
              <BinaryStructureView
                analysis={analysis}
                onSelectOffset={jumpTo}
                onDisasmAt={(offset) => {
                  setDisasmJumpOffset(offset);
                  setTab("disasm");
                }}
              />
            )}

            {tab === "hex" && (
              <HexViewer
                data={data}
                highlightOffset={jumpOffset}
                focusRange={hexFocus ?? undefined}
                regions={hexRegions}
                analysis={analysis}
                xrefDatabase={xrefDatabase}
                onJump={(o) => jumpTo(o)}
                onSelectionRangeChange={setHexSelection}
                diffPeer={diffOverlay ? diffPeer : null}
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

            {tab === "disasm" && (
              <div className="space-y-4">
                {analysis?.kind === "wasm" && data && <WasmWatPanel data={data} />}
                <DisasmTargetPicker
                  fileKey={`${active.id}:${fileName}`}
                  data={data}
                  analysis={analysis}
                  value={disasmSlice}
                  onChange={setDisasmSlice}
                  jumpFileOffset={disasmJumpOffset}
                />
                {disasmSlice ? (
                  <DisasmPanel
                    arch={disasmSlice.arch}
                    baseAddress={disasmSlice.base}
                    bytes={disasmSlice.bytes}
                    label={disasmSlice.label}
                    onJump={(o) => jumpTo(o)}
                    onInstructions={setDisasmInstructions}
                  />
                ) : (
                  <DisasmPanel
                    arch={null}
                    baseAddress={0}
                    bytes={new Uint8Array()}
                    label=""
                  />
                )}
              </div>
            )}

            {tab === "cfg" && (
              <CfgPanel
                graph={cfgGraph}
                label={disasmSlice?.label ?? "—"}
                onSelectOffset={(o) => jumpTo(o)}
              />
            )}

            {tab === "diff" && fileName && (
              <DiffPanel
                primary={data}
                primaryName={fileName}
                onJump={jumpTo}
                overlayEnabled={diffOverlay}
                onOverlayChange={(on) => {
                  ws.updateActiveUi({ diffOverlay: on });
                }}
                onExternalPeer={(bytes, name) => {
                  const max = 4 * 1024 * 1024;
                  ws.updateActiveUi({
                    diffPeerId: null,
                    diffPeerName: name,
                    diffPeerBase64: bytes.length <= max ? uint8ToBase64(bytes) : null,
                  });
                }}
                openFiles={diffOpenFiles}
                selectedOpenId={diffPeerId}
                onSelectOpenFile={(id) => {
                  ws.updateActiveUi({
                    diffPeerId: id,
                    diffPeerBase64: null,
                    diffPeerName: null,
                  });
                }}
              />
            )}

            {tab === "transform" && transformWorkData && (
              <TransformPanel
                data={data}
                workData={transformWorkData}
                scopeMode={transformScope}
                onScopeModeChange={setTransformScope}
                hexSelection={hexSelection}
                result={transformResult}
                scanning={transformScanning}
                progress={transformProgress}
                usedWorker={transformUsedWorker}
                onJump={jumpTo}
                onReanalyze={(bytes, suggested) =>
                  void ingestBytes(bytes, `${suggested}.bin`)
                }
              />
            )}

            {tab === "workspace" && (
              <WorkspacePanel
                sessions={ws.sessions}
                active={active}
                storageBusy={ws.storageBusy}
                onSaveActive={() => void ws.saveActive()}
                onSaveAll={() => void ws.saveAll()}
                onRestore={(id) => void ws.restoreFromDb(id)}
                onDeleteStored={(id) => void ws.removeFromDb(id)}
                listStored={ws.listDb}
                onImportSessions={ws.importSessions}
                onNotesChange={(notes) => ws.updateActiveUi({ notes })}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
