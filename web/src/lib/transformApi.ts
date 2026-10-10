import type { TransformScanResult } from "../hooks/useTransformScan";
import { maxAnalyzeBytes } from "@hexora/shared";

const API_MAX = maxAnalyzeBytes();

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function fetchTransformScan(
  bytes: Uint8Array,
): Promise<TransformScanResult> {
  if (bytes.length > API_MAX) {
    throw new Error(`API limit ${API_MAX} bytes`);
  }
  const res = await fetch("/api/transform/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bytes: toBase64(bytes) }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Scan failed (${res.status})`);
  }
  const body = await res.json();
  return {
    singleXor: body.singleXor ?? [],
    repeatXor: body.repeatXor ?? [],
    encodings: body.encodings ?? [],
    compression: body.compression ?? [],
    carved: body.carved ?? [],
  };
}
