import type { Arch, DisasmInstruction, DisasmResponse } from "./types.ts";
import { DISASM_DEFAULT_MAX_INSTRUCTIONS } from "./types.ts";

export function disassembleBytes(
  arch: Arch,
  address: number,
  bytes: Uint8Array,
  maxInstructions = DISASM_DEFAULT_MAX_INSTRUCTIONS,
): DisasmResponse {
  const instructions: DisasmInstruction[] = [];
  let ip = 0;
  while (ip < bytes.length && instructions.length < maxInstructions) {
    const decoded = decodeOne(arch, bytes, ip);
    if (!decoded) break;
    instructions.push({
      address: address + ip,
      size: decoded.size,
      mnemonic: decoded.mnemonic,
      operands: decoded.operands,
      bytes: hexSlice(bytes, ip, decoded.size),
    });
    ip += decoded.size;
  }
  return { instructions, truncated: ip < bytes.length };
}

interface DecodedInsn {
  size: number;
  mnemonic: string;
  operands: string;
}

function decodeOne(arch: Arch, bytes: Uint8Array, ip: number): DecodedInsn | null {
  if (arch === "wasm") return null;
  if (ip >= bytes.length) return null;
  const b0 = bytes[ip];

  if (b0 === 0x90) return { size: 1, mnemonic: "nop", operands: "" };
  if (b0 === 0xc3) return { size: 1, mnemonic: "ret", operands: "" };
  if (b0 === 0xcc) return { size: 1, mnemonic: "int3", operands: "" };

  if (b0 === 0xe8 && ip + 5 <= bytes.length) {
    const rel = readI32(bytes, ip + 1);
    return { size: 5, mnemonic: "call", operands: formatRel(rel) };
  }
  if (b0 === 0xe9 && ip + 5 <= bytes.length) {
    const rel = readI32(bytes, ip + 1);
    return { size: 5, mnemonic: "jmp", operands: formatRel(rel) };
  }

  if (arch === "x64" && b0 === 0x48 && ip + 1 < bytes.length) {
    const b1 = bytes[ip + 1];
    if (b1 === 0x89 && ip + 3 <= bytes.length) {
      const modrm = bytes[ip + 2];
      const reg = (modrm >> 3) & 7;
      const rm = modrm & 7;
      return {
        size: 3,
        mnemonic: "mov",
        operands: `${rm64(rm)}, ${rm64(reg)}`,
      };
    }
    if (b1 === 0x8b && ip + 3 <= bytes.length) {
      const modrm = bytes[ip + 2];
      const reg = (modrm >> 3) & 7;
      const rm = modrm & 7;
      return {
        size: 3,
        mnemonic: "mov",
        operands: `${rm64(reg)}, ${rm64(rm)}`,
      };
    }
  }

  if (b0 === 0x55) return { size: 1, mnemonic: "push", operands: "rbp" };
  if (b0 === 0x5d) return { size: 1, mnemonic: "pop", operands: "rbp" };

  if (b0 === 0xff && ip + 2 <= bytes.length) {
    const modrm = bytes[ip + 1];
    const reg = (modrm >> 3) & 7;
    if (reg === 6) return { size: 2, mnemonic: "push", operands: modRmOperand(modrm) };
    if (reg === 4) return { size: 2, mnemonic: "jmp", operands: modRmOperand(modrm) };
  }

  return { size: 1, mnemonic: "db", operands: `0x${b0.toString(16)}` };
}

function rm64(i: number): string {
  const regs = ["rax", "rcx", "rdx", "rbx", "rsp", "rbp", "rsi", "rdi"];
  return regs[i] ?? `r${i}`;
}

function modRmOperand(modrm: number): string {
  const rm = modrm & 7;
  return `[${rm64(rm)}]`;
}

function readI32(bytes: Uint8Array, offset: number): number {
  const v =
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24);
  return v | 0;
}

function formatRel(rel: number): string {
  const sign = rel >= 0 ? "+" : "";
  return `${sign}0x${rel.toString(16)}`;
}

function hexSlice(bytes: Uint8Array, start: number, len: number): string {
  return [...bytes.subarray(start, start + len)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");
}
