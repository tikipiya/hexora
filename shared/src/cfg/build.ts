import type { Arch, DisasmInstruction } from "../types.ts";
import type { CfgBasicBlock, CfgEdge, CfgEdgeKind, CfgGraph } from "./types.ts";

const MAX_BLOCKS = 512;

function mnemonicOf(insn: DisasmInstruction): string {
  return insn.mnemonic.toLowerCase();
}

function isUnconditionalTerminator(mnemonic: string, arch: Arch): boolean {
  const m = mnemonic.toLowerCase();
  if (arch === "wasm") {
    return (
      m === "br" ||
      m === "return" ||
      m === "unreachable" ||
      m === "br_table" ||
      m.startsWith("br ") ||
      m === "throw"
    );
  }
  if (m === "ret" || m === "retf" || m === "hlt" || m === "ud2" || m === "int3") {
    return true;
  }
  if (m === "jmp" || m.startsWith("jmp ")) return true;
  if (arch === "arm64" && (m === "b" || m.startsWith("b "))) return true;
  return false;
}

function isCall(mnemonic: string, arch: Arch): boolean {
  const m = mnemonic.toLowerCase();
  if (arch === "wasm") return m === "call" || m.startsWith("call ");
  if (m === "call" || m.startsWith("call ")) return true;
  if (arch === "arm64" && (m === "bl" || m.startsWith("bl "))) return true;
  return false;
}

function branchTargets(insn: DisasmInstruction): number[] {
  if (insn.targets?.length) {
    return insn.targets
      .filter((t) => t.kind === "jump" || t.kind === "call")
      .map((t) => t.address);
  }
  return [];
}

function insnFileOffset(
  insn: DisasmInstruction,
  sliceFileOffset: number,
  sliceBaseVa: number,
): number {
  return sliceFileOffset + Math.max(0, insn.address - sliceBaseVa);
}

export function buildCfgFromDisasm(
  instructions: DisasmInstruction[],
  sliceFileOffset: number,
  sliceBaseVa: number,
  arch: Arch,
): CfgGraph | null {
  if (instructions.length === 0) return null;

  const leaders = new Set<number>();
  leaders.add(instructions[0]!.address);

  for (let i = 0; i < instructions.length; i++) {
    const insn = instructions[i]!;
    const mn = mnemonicOf(insn);
    for (const t of branchTargets(insn)) {
      leaders.add(t);
    }
    if (isUnconditionalTerminator(mn, arch)) {
      const next = instructions[i + 1];
      if (next) leaders.add(next.address);
    }
  }

  const sortedLeaders = [...leaders].sort((a, b) => a - b);
  const addrToLeader = new Map<number, number>();
  for (const a of sortedLeaders) addrToLeader.set(a, a);

  const blocks: CfgBasicBlock[] = [];
  const addressToBlock = new Map<number, number>();

  for (let li = 0; li < sortedLeaders.length && blocks.length < MAX_BLOCKS; li++) {
    const start = sortedLeaders[li]!;
    const startIdx = instructions.findIndex((x) => x.address === start);
    if (startIdx < 0) continue;

    const blockInsns: DisasmInstruction[] = [];
    for (let j = startIdx; j < instructions.length; j++) {
      const cur = instructions[j]!;
      if (j > startIdx && leaders.has(cur.address)) break;
      blockInsns.push(cur);
      const mn = mnemonicOf(cur);
      if (isUnconditionalTerminator(mn, arch)) break;
    }
    if (blockInsns.length === 0) continue;

    const first = blockInsns[0]!;
    const last = blockInsns[blockInsns.length - 1]!;
    const id = blocks.length;
    const block: CfgBasicBlock = {
      id,
      startAddress: first.address,
      endAddress: last.address + last.size,
      startFileOffset: insnFileOffset(first, sliceFileOffset, sliceBaseVa),
      endFileOffset: insnFileOffset(last, sliceFileOffset, sliceBaseVa) + last.size - 1,
      instructionCount: blockInsns.length,
      entryMnemonic: first.mnemonic,
      exitMnemonic: last.mnemonic,
    };
    blocks.push(block);
    for (const ins of blockInsns) {
      addressToBlock.set(ins.address, id);
    }
  }

  if (blocks.length === 0) return null;

  const edges: CfgEdge[] = [];
  const edgeKey = new Set<string>();
  const addEdge = (from: number, to: number, kind: CfgEdgeKind) => {
    if (from < 0 || to < 0 || from >= blocks.length || to >= blocks.length) return;
    const k = `${from}:${to}:${kind}`;
    if (edgeKey.has(k)) return;
    edgeKey.add(k);
    edges.push({ from, to, kind });
  };

  for (let bi = 0; bi < blocks.length; bi++) {
    const block = blocks[bi]!;
    const startIdx = instructions.findIndex((x) => x.address === block.startAddress);
    if (startIdx < 0) continue;
    let endIdx = startIdx;
    while (
      endIdx + 1 < instructions.length &&
      instructions[endIdx + 1]!.address < block.endAddress
    ) {
      endIdx++;
    }
    const last = instructions[endIdx]!;
    const mn = mnemonicOf(last);

    for (const t of branchTargets(last)) {
      const tb = addressToBlock.get(t);
      if (tb !== undefined) {
        addEdge(bi, tb, isCall(mn, arch) ? "call" : "jump");
      }
    }

    if (!isUnconditionalTerminator(mn, arch)) {
      const nextInsn = instructions[endIdx + 1];
      if (nextInsn) {
        const nb = addressToBlock.get(nextInsn.address);
        if (nb !== undefined) addEdge(bi, nb, "fallthrough");
      }
    }
  }

  const entryBlockId = addressToBlock.get(instructions[0]!.address) ?? 0;

  return { blocks, edges, entryBlockId };
}

export function blockAtFileOffset(
  graph: CfgGraph,
  fileOffset: number,
): CfgBasicBlock | null {
  return (
    graph.blocks.find(
      (b) => fileOffset >= b.startFileOffset && fileOffset <= b.endFileOffset,
    ) ?? null
  );
}
