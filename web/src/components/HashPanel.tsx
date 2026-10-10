import { useState } from "react";
import type { FileHashes, HashAlgorithm } from "../lib/hash";

const LABELS: Record<HashAlgorithm, string> = {
  crc32: "CRC32",
  md5: "MD5",
  sha1: "SHA-1",
  sha256: "SHA-256",
  sha384: "SHA-384",
  sha512: "SHA-512",
};

interface Props {
  hashes: FileHashes | null;
  loading?: boolean;
  progress?: { label: string; percent: number } | null;
}

export function HashPanel({ hashes, loading, progress }: Props) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (algo: string, hex: string) => {
    await navigator.clipboard.writeText(hex);
    setCopied(algo);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="glass-card hairline-inset p-4 text-body-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h3 className="font-aeonikpro text-heading-sm text-ice-highlight">Hashes</h3>
        {hashes && (
          <span className="text-caption text-fog-veil">
            {hashes.elapsedMs} ms
            {hashes.incremental && (
              <span className="ml-2 rounded-[var(--radius-badges)] bg-luminous-fill px-1.5 py-0.5">
                インクリメンタル
              </span>
            )}
          </span>
        )}
      </div>

      {loading && (
        <div className="mb-4">
          <div className="flex justify-between text-caption text-moon-mist mb-1">
            <span>{progress?.label ?? "計算中"}</span>
            <span>{progress?.percent ?? 0}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-[rgba(199,211,234,0.08)] overflow-hidden">
            <div
              className="h-full bg-void-violet transition-all duration-150"
              style={{ width: `${progress?.percent ?? 0}%` }}
            />
          </div>
        </div>
      )}

      {!hashes && !loading && (
        <p className="text-fog-veil text-caption">ファイルを開くとハッシュを計算します。</p>
      )}

      {hashes && (
        <ul className="space-y-3">
          {hashes.results.map((r) => (
            <li key={r.algorithm}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-moon-mist font-medium">{LABELS[r.algorithm]}</span>
                <button
                  type="button"
                  className="text-caption text-frost-glow hairline-inset rounded-[var(--radius-badges)] px-2 py-0.5 hover:bg-[rgba(186,214,247,0.08)]"
                  onClick={() => void copy(r.algorithm, r.hex)}
                >
                  {copied === r.algorithm ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="font-dotdigital text-caption break-all text-frost-glow select-all">
                {r.hex}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
