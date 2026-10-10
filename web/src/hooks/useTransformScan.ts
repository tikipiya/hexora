import { useEffect, useState } from "react";
import type {
  CarvedArtifact,
  CompressionHit,
  EncodingHit,
  XorCandidate,
} from "@hexora/shared";
import {
  analyzeRepeatingXor,
  analyzeSingleByteXor,
  carveFiles,
  scanCompression,
  scanEncodings,
  shiftScanResults,
} from "@hexora/shared";
import type { TransformWorkerResponse } from "../workers/transform.worker";

const WORKER_THRESHOLD = 512 * 1024;

export interface TransformScanResult {
  singleXor: XorCandidate[];
  repeatXor: XorCandidate[];
  encodings: EncodingHit[];
  compression: CompressionHit[];
  carved: CarvedArtifact[];
}

export type TransformScanRange = { start: number; end: number } | null;

export function useTransformScan(
  data: Uint8Array | null,
  range: TransformScanRange = null,
) {
  const [result, setResult] = useState<TransformScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<{ phase: string; percent: number } | null>(
    null,
  );
  const [usedWorker, setUsedWorker] = useState(false);
  const scanBase = range ? range.start : 0;

  useEffect(() => {
    if (!data) {
      setResult(null);
      setProgress(null);
      return;
    }

    let cancelled = false;
    setScanning(true);
    setResult(null);

    const base = scanBase;
    const slice =
      range && range.end >= range.start
        ? data.subarray(range.start, range.end + 1)
        : data;

    const runLocal = () => {
      const singleXor = analyzeSingleByteXor(slice);
      const repeatXor = analyzeRepeatingXor(slice);
      const encodings = scanEncodings(slice);
      const compression = scanCompression(slice);
      const carved = carveFiles(slice, 500, (s, t) => {
        if (!cancelled) {
          setProgress({
            phase: "carving",
            percent: Math.round((s / t) * 100),
          });
        }
      });
      const shifted = shiftScanResults(base, encodings, compression, carved);
      return {
        singleXor,
        repeatXor,
        ...shifted,
      };
    };

    const run = async () => {
      if (slice.length >= WORKER_THRESHOLD) {
        setUsedWorker(true);
        const id = Date.now();
        const worker = new Worker(
          new URL("../workers/transform.worker.ts", import.meta.url),
          { type: "module" },
        );
        const copy = slice.slice().buffer;
        await new Promise<void>((resolve, reject) => {
          worker.onmessage = (ev: MessageEvent<TransformWorkerResponse>) => {
            const msg = ev.data;
            if (msg.id !== id) return;
            if (msg.type === "progress") {
              setProgress({
                phase: msg.phase,
                percent: msg.total ? Math.round((msg.scanned / msg.total) * 100) : 0,
              });
            } else if (msg.type === "done") {
              if (!cancelled) {
                const shifted = shiftScanResults(
                  base,
                  msg.encodings,
                  msg.compression,
                  msg.carved,
                );
                setResult({
                  singleXor: msg.singleXor,
                  repeatXor: msg.repeatXor,
                  ...shifted,
                });
              }
              worker.terminate();
              resolve();
            } else if (msg.type === "error") {
              worker.terminate();
              reject(new Error(msg.message));
            }
          };
          worker.postMessage({ id, buffer: copy });
        }).catch(() => {
          if (!cancelled) setResult(runLocal());
        });
      } else {
        setUsedWorker(false);
        await new Promise((r) => requestAnimationFrame(() => r(undefined)));
        if (!cancelled) setResult(runLocal());
      }
      if (!cancelled) {
        setScanning(false);
        setProgress(null);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [data, range?.start, range?.end, scanBase]);

  return { result, scanning, progress, usedWorker, scanBase };
}
