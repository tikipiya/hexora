import type { Arch, DisasmResponse } from "@hexora/shared";
import { DISASM_DEFAULT_MAX_INSTRUCTIONS } from "@hexora/shared";
import { disassembleWithCapstone } from "./capstoneDisasm";

/** Capstone WASM（x86 / x64 / ARM64） */
export async function disassemble(
  arch: Arch,
  address: number,
  bytes: Uint8Array,
  maxInstructions = DISASM_DEFAULT_MAX_INSTRUCTIONS,
): Promise<DisasmResponse> {
  if (
    arch !== "arm64" &&
    arch !== "wasm" &&
    bytes.length > 256 * 1024
  ) {
    return disassembleRemote(arch, address, bytes, maxInstructions);
  }
  return disassembleWithCapstone(arch, address, bytes, maxInstructions);
}

async function disassembleRemote(
  arch: Arch,
  address: number,
  bytes: Uint8Array,
  maxInstructions: number,
): Promise<DisasmResponse> {
  const body = {
    arch,
    address,
    bytes: uint8ToBase64(bytes),
    maxInstructions,
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
