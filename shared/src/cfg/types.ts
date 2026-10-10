export type CfgEdgeKind = "fallthrough" | "jump" | "call";

export interface CfgBasicBlock {
  id: number;
  startAddress: number;
  endAddress: number;
  startFileOffset: number;
  endFileOffset: number;
  instructionCount: number;
  entryMnemonic: string;
  exitMnemonic: string;
}

export interface CfgEdge {
  from: number;
  to: number;
  kind: CfgEdgeKind;
}

export interface CfgGraph {
  blocks: CfgBasicBlock[];
  edges: CfgEdge[];
  entryBlockId: number;
}
