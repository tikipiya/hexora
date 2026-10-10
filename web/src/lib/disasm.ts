import type { Arch, DisasmResponse } from "@hexora/shared";
import { disassembleBytes } from "@hexora/shared";

/** 小さなバッファはブラウザ内、大きいものは Worker API */
const CLIENT_MAX = 4096;

export async function disassemble(
  arch: Arch,
  address: number,
  bytes: Uint8Array,
): Promise<DisasmResponse> {
  if (bytes.length <= CLIENT_MAX) {
    return disassembleBytes(arch, address, bytes);
  }
  return disassembleRemote(arch, address, bytes);
}

async function disassembleRemote(
  arch: Arch,
  address: number,
  bytes: Uint8Array,
): Promise<DisasmResponse> {
  const body = {
    arch,
    address,
    bytes: uint8ToBase64(bytes),
  };
  const res = await fetch("/api/disasm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Disasm failed (${res.status})`);
  }
  return (await res.json()) as DisasmResponse;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
