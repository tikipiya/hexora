import type { ParseIssue } from "../binary/errors.ts";

export interface WasmImport {
  module: string;
  name: string;
  kind: "function" | "table" | "memory" | "global";
  typeIndex?: number;
}

export interface WasmExport {
  name: string;
  kind: "function" | "table" | "memory" | "global";
  index: number;
}

export interface WasmCodeBody {
  /** Index within the code section (0 .. functionCount-1). */
  codeIndex: number;
  /** Function index in the module (imports + defined). */
  moduleFunctionIndex: number;
  fileOffset: number;
  size: number;
}

export interface WasmSection {
  id: number;
  name: string;
  fileOffset: number;
  size: number;
}

export interface WasmParseResult {
  ok: boolean;
  version: number;
  sections: WasmSection[];
  imports: WasmImport[];
  exports: WasmExport[];
  typeCount: number;
  functionCount: number;
  importFunctionCount: number;
  codeBodies: WasmCodeBody[];
  issues: ParseIssue[];
}
