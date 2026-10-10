export type Arch = "x86" | "x64" | "arm64";

export interface DisasmRequest {
  arch: Arch;
  address: number;
  bytes: string;
  maxInstructions?: number;
}

export interface DisasmInstruction {
  address: number;
  size: number;
  mnemonic: string;
  operands: string;
  bytes: string;
}

export interface DisasmResponse {
  instructions: DisasmInstruction[];
  truncated: boolean;
}

export const DISASM_MAX_BYTES = 65536;
export const DISASM_DEFAULT_MAX_INSTRUCTIONS = 512;
