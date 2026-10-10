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

export function useTransformScan(data: Uint8Array | null) {
  const [result, setResult] = useState<TransformScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<{ phase: string; percent: number } | null>(
    null,
  );
  const [usedWorker, setUsedWorker] = useState(false);

  useEffect(() => {
    if (!data) {
      setResult(null);
      setProgress(null);
      return;
    }

    let cancelled = false;
    setScanning(true);
    setResult(null);

    const runLocal = () => {
      const singleXor = analyzeSingleByteXor(data);
      const repeatXor = analyzeRepeatingXor(data);
      const encodings = scanEncodings(data);
      const compression = scanCompression(data);
      const carved = carveFiles(data, 500, (s, t) => {
        if (!cancelled) {
          setProgress({
            phase: "carving",
            percent: Math.round((s / t) * 100),
          });
        }
      });
      return { singleXor, repeatXor, encodings, compression, carved };
    };

    const run = async () => {
      if (data.length >= WORKER_THRESHOLD) {
        setUsedWorker(true);
        const id = Date.now();
        const worker = new Worker(
          new URL("../workers/transform.worker.ts", import.meta.url),
          { type: "module" },
        );
        const copy = data.slice().buffer;
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
                setResult({
                  singleXor: msg.singleXor,
                  repeatXor: msg.repeatXor,
                  encodings: msg.encodings,
                  compression: msg.compression,
                  carved: msg.carved,
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
  }, [data]);

  return { result, scanning, progress, usedWorker };
}
