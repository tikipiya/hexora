import { useCallback, useMemo, useState } from "react";
import type { Arch } from "@hexora/shared";
import { Background } from "./components/Background";
import { DisasmPanel } from "./components/DisasmPanel";
import { EntropyMap } from "./components/EntropyMap";
import { Eyebrow } from "./components/Eyebrow";
import { FileDropzone, FileMeta } from "./components/FileDropzone";
import { HexViewer } from "./components/HexViewer";
import { StringsPanel } from "./components/StringsPanel";
import { StructurePanel } from "./components/StructurePanel";
import { detectBinary } from "./lib/detect";
import { elfSectionBytes } from "./lib/elf";
import { extractStrings } from "./lib/strings";
import { hashFile, type FileHashes } from "./lib/hash";
import { peSectionBytes } from "./lib/pe";

type Tab = "overview" | "hex" | "strings" | "disasm";

export function App() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [data, setData] = useState<Uint8Array | null>(null);
  const [hashes, setHashes] = useState<FileHashes | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [jumpOffset, setJumpOffset] = useState<number | undefined>();
  const [disasmSlice, setDisasmSlice] = useState<{
    arch: Arch;
    base: number;
    bytes: Uint8Array;
    label: string;
  } | null>(null);

  const detected = useMemo(
    () => (data ? detectBinary(data.buffer as ArrayBuffer) : null),
    [data],
  );

  const strings = useMemo(() => (data ? extractStrings(data) : []), [data]);

  const onFile = useCallback(async (file: File, buffer: ArrayBuffer) => {
    setBusy(true);
    try {
      const u8 = new Uint8Array(buffer);
      setFileName(file.name);
      setData(u8);
      setTab("overview");
      setJumpOffset(undefined);
      const h = await hashFile(buffer);
      setHashes(h);

      const d = detectBinary(buffer);
      if (d.pe) {
        const text = d.pe.sections.find((s) =>
          s.name.toLowerCase().includes(".text"),
        );
        const sec = text ?? d.pe.sections[0];
        if (sec && d.pe.summary["Disasm arch"]) {
          const arch = d.pe.summary["Disasm arch"] as Arch;
          const bytes = peSectionBytes(buffer, sec);
          setDisasmSlice({
            arch,
            base: d.pe.imageBase + sec.virtualAddress,
            bytes: bytes.subarray(0, Math.min(bytes.length, 65536)),
            label: `${sec.name} @ ${file.name}`,
          });
        } else setDisasmSlice(null);
      } else if (d.elf) {
        const text = d.elf.sections.find((s) => s.name === ".text");
        const sec = text ?? d.elf.sections.find((s) => s.size > 0);
        if (sec && d.elf.summary["Disasm arch"]) {
          const arch = d.elf.summary["Disasm arch"] as Arch;
          const bytes = elfSectionBytes(buffer, sec);
          setDisasmSlice({
            arch,
            base: sec.address,
            bytes: bytes.subarray(0, Math.min(bytes.length, 65536)),
            label: `${sec.name} @ ${file.name}`,
          });
        } else setDisasmSlice(null);
      } else {
        setDisasmSlice(null);
      }
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <div className="relative min-h-screen">
      <Background />
      <header className="mx-auto max-w-[var(--page-max-width,1200px)] px-6 pt-10 pb-6 flex items-center justify-between">
        <span className="font-aeonikpro text-body font-medium text-frost-glow">
          Hexora
        </span>
        <a
          href="https://github.com"
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

        {!data && <FileDropzone onFile={onFile} busy={busy} />}

        {data && fileName && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <FileMeta name={fileName} size={data.length} />
              <button
                type="button"
                className="rounded-[var(--radius-buttons)] px-4 py-2 text-body-sm bg-void-violet text-pure-white font-medium"
                onClick={() => {
                  setData(null);
                  setFileName(null);
                  setHashes(null);
                  setDisasmSlice(null);
                }}
              >
                別のファイル
              </button>
            </div>

            {hashes && (
              <div className="glass-card hairline-inset p-4 text-body-sm space-y-2">
                <h3 className="font-aeonikpro text-heading-sm text-ice-highlight">
                  Hashes
                </h3>
                <p className="font-dotdigital text-caption break-all text-moon-mist">
                  SHA-256: {hashes.sha256}
                </p>
                <p className="font-dotdigital text-caption break-all text-fog-veil">
                  SHA-1: {hashes.sha1}
                </p>
              </div>
            )}

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
                  onSectionSelect={setJumpOffset}
                />
                <EntropyMap data={data} onSelect={(o) => setJumpOffset(o)} />
              </div>
            )}

            {tab === "hex" && (
              <HexViewer
                data={data}
                highlightOffset={jumpOffset}
                onJump={setJumpOffset}
              />
            )}

            {tab === "strings" && (
              <StringsPanel
                strings={strings}
                onSelect={(o) => {
                  setJumpOffset(o);
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
