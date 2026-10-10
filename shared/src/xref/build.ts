import type { DisasmInstruction } from "../types.ts";
import type { ElfParseResult } from "../elf/types.ts";
import type { PeParseResult } from "../pe/types.ts";
import type { WasmParseResult } from "../wasm/types.ts";
import { parseOperandAddresses } from "./operands.ts";
import type { XrefDatabase, XrefEdge, XrefKind, XrefSite } from "./types.ts";

export interface VaToFileResolver {
  (va: number): number | null;
}

function indexEdges(edges: XrefEdge[]): XrefDatabase {
  const incoming = new Map<number, XrefSite[]>();
  const outgoing = new Map<number, XrefSite[]>();

  for (const e of edges) {
    const outSite: XrefSite = {
      offset: e.fromOffset,
      kind: e.kind,
      label: e.label,
      peerOffset: e.toOffset,
      peerVa: e.toVa,
    };
    const inSite: XrefSite = {
      offset: e.toOffset ?? -1,
      kind: e.kind,
      label: e.label,
      peerOffset: e.fromOffset,
    };
    if (e.toOffset !== null) {
      const arrIn = incoming.get(e.toOffset) ?? [];
      arrIn.push(inSite);
      incoming.set(e.toOffset, arrIn);
    }
    const arrOut = outgoing.get(e.fromOffset) ?? [];
    arrOut.push(outSite);
    outgoing.set(e.fromOffset, arrOut);
  }

  return { edges, incoming, outgoing };
}

export function buildXrefsFromDisasm(
  instructions: DisasmInstruction[],
  sliceFileOffset: number,
  sliceBaseVa: number,
  resolveVa: VaToFileResolver,
  insnFlags?: { address: number; call: boolean; jump: boolean }[],
): XrefEdge[] {
  const edges: XrefEdge[] = [];
  for (const insn of instructions) {
    const fromOff =
      sliceFileOffset + Math.max(0, insn.address - sliceBaseVa);
    const flagRow = insnFlags?.find((f) => f.address === insn.address);
    const kinds: XrefKind[] = [];
    if (flagRow?.call) kinds.push("call");
    else if (flagRow?.jump) kinds.push("jump");
    else kinds.push("data");

    const targets =
      insn.targets?.map((t) => t.address) ??
      parseOperandAddresses(insn.operands, "x64");

    for (let i = 0; i < targets.length; i++) {
      const va = targets[i]!;
      const toOff = resolveVa(va);
      const kind = insn.targets?.[i]?.kind ?? kinds[0] ?? "data";
      edges.push({
        kind,
        fromOffset: fromOff,
        toOffset: toOff,
        toVa: toOff === null ? `0x${va.toString(16)}` : undefined,
      });
    }
  }
  return edges;
}

export function buildXrefsFromPeFixed(
  pe: PeParseResult,
  resolveRva: (rva: number) => number | null,
): XrefEdge[] {
  const edges: XrefEdge[] = [];
  for (const imp of pe.imports) {
    for (const fn of imp.functions) {
      edges.push({
        kind: "import",
        fromOffset: resolveRva(fn.iatRva) ?? 0,
        toOffset: null,
        label: `${imp.dll}!${fn.name ?? `#${fn.ordinal}`}`,
      });
    }
  }
  for (const ex of pe.exports) {
    const off = resolveRva(ex.rva);
    if (off !== null) {
      edges.push({
        kind: "export",
        fromOffset: off,
        toOffset: off,
        label: ex.name ?? `ord${ex.ordinal}`,
      });
    }
  }
  for (const b of pe.relocBlocks) {
    edges.push({
      kind: "reloc",
      fromOffset: b.fileOffset,
      toOffset: null,
      label: `block @ 0x${b.pageRva.toString(16)}`,
    });
  }
  return edges;
}

export function buildXrefsFromElf(
  elf: ElfParseResult,
  resolveVa: (va: bigint) => number | null,
): XrefEdge[] {
  const edges: XrefEdge[] = [];
  for (const sym of elf.symbols) {
    if (sym.value === 0n) continue;
    const off = resolveVa(sym.value);
    edges.push({
      kind: "symbol",
      fromOffset: off ?? 0,
      toOffset: off,
      label: sym.name,
    });
  }
  for (const rel of elf.relocations.slice(0, 5000)) {
    const off = resolveVa(rel.offset);
    if (off !== null) {
      edges.push({
        kind: "reloc",
        fromOffset: off,
        toOffset: null,
        label: `sym ${rel.sym} type ${rel.type}`,
      });
    }
  }
  return edges;
}

export function buildXrefsFromWasm(wasm: WasmParseResult): XrefEdge[] {
  const edges: XrefEdge[] = [];
  for (const ex of wasm.exports) {
    const body = wasm.codeBodies.find(
      (c) => c.moduleFunctionIndex === ex.index,
    );
    if (body && ex.kind === "function") {
      edges.push({
        kind: "wasm",
        fromOffset: body.fileOffset,
        toOffset: body.fileOffset,
        label: `export ${ex.name}`,
      });
    }
  }
  for (const im of wasm.imports) {
    edges.push({
      kind: "import",
      fromOffset: 0,
      toOffset: null,
      label: `${im.module}.${im.name}`,
    });
  }
  return edges;
}

export function mergeXrefDatabase(parts: XrefEdge[][]): XrefDatabase {
  const edges = parts.flat();
  return indexEdges(edges);
}

export function sitesAt(db: XrefDatabase, offset: number): {
  incoming: XrefSite[];
  outgoing: XrefSite[];
} {
  return {
    incoming: db.incoming.get(offset) ?? [],
    outgoing: db.outgoing.get(offset) ?? [],
  };
}
