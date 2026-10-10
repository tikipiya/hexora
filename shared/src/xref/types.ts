export type XrefKind =
  | "call"
  | "jump"
  | "data"
  | "reloc"
  | "import"
  | "export"
  | "symbol"
  | "wasm";

export interface XrefEdge {
  kind: XrefKind;
  fromOffset: number;
  toOffset: number | null;
  toVa?: string;
  label?: string;
}

export interface XrefSite {
  offset: number;
  kind: XrefKind;
  label?: string;
  peerOffset: number | null;
  peerVa?: string;
}

export interface XrefDatabase {
  edges: XrefEdge[];
  incoming: Map<number, XrefSite[]>;
  outgoing: Map<number, XrefSite[]>;
}
