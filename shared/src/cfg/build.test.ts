import { describe, expect, it } from "vitest";
import { buildCfgFromDisasm } from "./build.ts";
import type { DisasmInstruction } from "../types.ts";

function insn(
  address: number,
  mnemonic: string,
  operands = "",
  targets?: DisasmInstruction["targets"],
): DisasmInstruction {
  return {
    address,
    size: 1,
    mnemonic,
    operands,
    bytes: "00",
    targets,
  };
}

describe("buildCfgFromDisasm", () => {
  it("splits on jmp and links fallthrough + jump", () => {
    const insns = [
      insn(0x1000, "nop"),
      insn(0x1001, "jmp", "0x1005", [{ address: 0x1005, kind: "jump" }]),
      insn(0x1002, "nop"),
      insn(0x1003, "nop"),
      insn(0x1005, "ret"),
    ];
    const g = buildCfgFromDisasm(insns, 0x200, 0x1000, "x64");
    expect(g).not.toBeNull();
    expect(g!.blocks.length).toBeGreaterThanOrEqual(2);
    const jmpBlock = g!.blocks.find((b) => b.exitMnemonic === "jmp");
    expect(jmpBlock).toBeDefined();
    const hasJump = g!.edges.some(
      (e) => e.from === jmpBlock!.id && e.kind === "jump",
    );
    expect(hasJump).toBe(true);
  });
});
