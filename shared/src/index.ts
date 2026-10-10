export type {
  Arch,
  DisasmRequest,
  DisasmInstruction,
  DisasmResponse,
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

export { parseElf } from "./elf/parse.ts";
export type { ElfParseResult } from "./elf/types.ts";
export {
  buildElfAddressSpace,
  elfFileToVa,
  elfVaToFile,
} from "./elf/address.ts";
export type { ElfAddressResult, ElfAddressSpace } from "./elf/address.ts";

export { parsePe } from "./pe/parse.ts";
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
