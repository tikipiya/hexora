export type {
  Arch,
  DisasmRequest,
  DisasmInstruction,
  DisasmResponse,
  DisasmTargetKind,
} from "./types.ts";
export {
  DISASM_MAX_BYTES,
  DISASM_DEFAULT_MAX_INSTRUCTIONS,
} from "./types.ts";
export { disassembleBytes } from "./disasm-engine.ts";

export * from "./binary/errors.ts";
export { BinaryReader, safeAdd } from "./binary/reader.ts";
export { detectBinaryKind } from "./binary/format.ts";
export { jsonSafe, hexAddr } from "./binary/serialize.ts";
export { compareBinary, type DiffRegion, type DiffSummary } from "./binary/diff.ts";

export { parseElf } from "./elf/parse.ts";
export type { ElfParseResult } from "./elf/types.ts";
export {
  buildElfAddressSpace,
  elfFileToVa,
  elfVaToFile,
} from "./elf/address.ts";
export type { ElfAddressResult, ElfAddressSpace } from "./elf/address.ts";

export { parsePe } from "./pe/parse.ts";
export { parseMachO } from "./macho/parse.ts";
export type { MachOParseResult, MachOSegment } from "./macho/types.ts";
export type { PeParseResult } from "./pe/types.ts";
export {
  buildPeAddressSpace,
  peRvaToFile,
  peFileToRva,
  peVaToRva,
  peRvaToVa,
} from "./pe/address.ts";
export type { PeAddressResult, PeAddressSpace } from "./pe/address.ts";

export { maxAnalyzeBytes, parseBase64Payload } from "./api/limits.ts";
export {
  jsonResponse,
  errorResponse,
  allowedCorsOrigin,
} from "./api/http.ts";

export * from "./transform/index.ts";

export { parseWasm } from "./wasm/index.ts";
export type {
  WasmCodeBody,
  WasmExport,
  WasmImport,
  WasmParseResult,
  WasmSection,
} from "./wasm/index.ts";

export * from "./xref/index.ts";

export * from "./cfg/index.ts";
