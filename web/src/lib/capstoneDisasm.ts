import type {
  Arch,
  DisasmInstruction,
  DisasmResponse,
  DisasmTargetKind,
} from "@hexora/shared";
import {
  DISASM_DEFAULT_MAX_INSTRUCTIONS,
  parseOperandAddresses,
} from "@hexora/shared";

type CapstoneModule = Awaited<
  ReturnType<typeof import("@kreijstal/capstone-wasm/capstone.mjs").default>
>;

let capstonePromise: Promise<CapstoneModule> | null = null;

function loadCapstone(): Promise<CapstoneModule> {
  if (!capstonePromise) {
    capstonePromise = import("@kreijstal/capstone-wasm/capstone.mjs").then((m) =>
      m.default(),
    );
  }
  return capstonePromise;
}

function getConst(M: CapstoneModule, name: string): number {
  const len = M.lengthBytesUTF8(name) + 1;
  const p = M._malloc(len);
  M.stringToUTF8(name, p, len);
  const v = Number(M._csw_const(p));
  M._free(p);
  if (v < 0) throw new Error(`Unknown capstone constant ${name}`);
  return v;
}

function archToCapstone(arch: Arch): { archId: string; modeId: string } {
  switch (arch) {
    case "x86":
      return { archId: "CS_ARCH_X86", modeId: "CS_MODE_32" };
    case "x64":
      return { archId: "CS_ARCH_X86", modeId: "CS_MODE_64" };
    case "arm64":
      return { archId: "CS_ARCH_AARCH64", modeId: "CS_MODE_LITTLE_ENDIAN" };
    case "wasm":
      return { archId: "CS_ARCH_WASM", modeId: "CS_MODE_LITTLE_ENDIAN" };
    default:
      return { archId: "CS_ARCH_X86", modeId: "CS_MODE_64" };
  }
}

function insnControlKind(mnemonic: string, arch: Arch): DisasmTargetKind | null {
  const m = mnemonic.toLowerCase();
  if (arch === "wasm") {
    if (m === "call" || m.startsWith("call_")) return "call";
    if (m.startsWith("br") || m === "return" || m === "throw") return "jump";
    return null;
  }
  if (m === "call" || m.startsWith("bl")) return "call";
  if (m.startsWith("j") || m === "ret" || m.startsWith("b.")) return "jump";
  return null;
}

function withJumpTargets(insn: DisasmInstruction, arch: Arch): DisasmInstruction {
  const ctrl = insnControlKind(insn.mnemonic, arch);
  const addrs = parseOperandAddresses(insn.operands, arch);
  if (!ctrl && addrs.length === 0) return insn;
  const kind = ctrl ?? "data";
  const targets = addrs.map((address) => ({ address, kind }));
  return targets.length ? { ...insn, targets } : insn;
}

function parseRecord(
  M: CapstoneModule,
  out: number,
  offset: number,
  code: Uint8Array,
  imageBase: number,
): { insn: DisasmInstruction; next: number } {
  const r = out + offset;
  const addrLo = M.HEAPU32[r >> 2];
  const addrHi = M.HEAPU32[(r >> 2) + 1];
  const address = Number((BigInt(addrHi) << 32n) | BigInt(addrLo));
  const size = M.HEAPU8[r + 8] | (M.HEAPU8[r + 9] << 8);
  const ml = M.HEAPU8[r + 11];
  const ol = M.HEAPU8[r + 12];
  const mnemonic = M.UTF8ToString(r + 13, ml, true);
  const operands = M.UTF8ToString(r + 13 + ml, ol, true);
  const rel = address - imageBase;
  const slice = code.subarray(Math.max(0, rel), Math.max(0, rel) + size);
  const bytesHex = [...slice]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");
  return {
    insn: {
      address,
      size,
      mnemonic,
      operands,
      bytes: bytesHex,
    },
    next: offset + 13 + ml + ol,
  };
}

export async function disassembleWithCapstone(
  arch: Arch,
  address: number,
  bytes: Uint8Array,
  maxInstructions = DISASM_DEFAULT_MAX_INSTRUCTIONS,
): Promise<DisasmResponse> {
  const M = await loadCapstone();
  const { archId, modeId } = archToCapstone(arch);
  const h = M._csw_open(getConst(M, archId), getConst(M, modeId));
  if (h < 0) {
    throw new Error(M.UTF8ToString(M._csw_strerror(-(h + 1000))));
  }

  const cp = M._malloc(bytes.length);
  M.HEAPU8.set(bytes, cp);
  const outCap = 512 * 1024;
  const out = M._malloc(outCap);
  const res = M._malloc(8);
  const addrLo = address >>> 0;
  const addrHi = Math.floor(address / 0x1_0000_0000);

  const used = M._csw_disasm(
    h,
    cp,
    bytes.length,
    addrLo,
    addrHi,
    maxInstructions,
    arch === "arm64" ? 4 : 1,
    out,
    outCap,
    res,
  );
  const n = M.HEAPU32[res >> 2];
  const consumed = M.HEAPU32[(res >> 2) + 1];

  const instructions: DisasmInstruction[] = [];
  let o = 0;
  for (let i = 0; i < n; i++) {
    const rec = parseRecord(M, out, o, bytes, address);
    instructions.push(withJumpTargets(rec.insn, arch));
    o = rec.next;
  }

  M._free(cp);
  M._free(out);
  M._free(res);
  M._csw_close(h);

  return {
    instructions,
    truncated: consumed < bytes.length,
  };
}
