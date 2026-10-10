import { useEffect, useState } from "react";
import {
  DEFAULT_STRING_OPTIONS,
  extractStrings,
  STRINGS_WORKER_THRESHOLD,
  type ExtractedString,
  type StringExtractOptions,
} from "../lib/strings";
import { scanStringsInWorker } from "../lib/stringsWorkerClient";

export function useExtractedStrings(
  data: Uint8Array | null,
  options: StringExtractOptions = DEFAULT_STRING_OPTIONS,
) {
  const [strings, setStrings] = useState<ExtractedString[]>([]);
  const [scanning, setScanning] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [scanProgress, setScanProgress] = useState<{ scanned: number; total: number } | null>(
    null,
  );
  const [usedWorker, setUsedWorker] = useState(false);

  useEffect(() => {
    if (!data) {
      setStrings([]);
      setTruncated(false);
      setScanProgress(null);
      setUsedWorker(false);
      return;
    }

    let cancelled = false;
    setScanning(true);
    setStrings([]);
    setScanProgress({ scanned: 0, total: data.length });

    const run = async () => {
      const onPartial = (p: { scanned: number; total: number; strings: ExtractedString[] }) => {
        if (cancelled) return;
        setScanProgress({ scanned: p.scanned, total: p.total });
        setStrings(p.strings);
      };

      try {
        if (data.length >= STRINGS_WORKER_THRESHOLD) {
          setUsedWorker(true);
          const copy = data.slice().buffer;
          const result = await scanStringsInWorker(copy, options, onPartial);
          if (cancelled) return;
          setStrings(result.strings);
          setTruncated(result.truncated);
        } else {
          setUsedWorker(false);
          await new Promise<void>((r) => requestAnimationFrame(() => r()));
          const result = extractStrings(data, options, (p) => onPartial(p));
          if (cancelled) return;
          setStrings(result.strings);
          setTruncated(result.truncated);
        }
      } finally {
        if (!cancelled) {
          setScanning(false);
          setScanProgress(null);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [data, options.minLength, options.maxResults, options.dedupe, options.encodings.join(",")]);

  return { strings, scanning, truncated, scanProgress, usedWorker };
}
