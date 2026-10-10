import type { ParseIssue } from "../binary/errors.ts";

export interface DosHeader {
  magic: number;
  cblp: number;
  e_lfanew: number;
  stubSize: number;
}

export interface CoffHeader {
  machine: number;
  machineName: string;
  numberOfSections: number;
  timeDateStamp: number;
  pointerToSymbolTable: number;
  numberOfSymbols: number;
  sizeOfOptionalHeader: number;
  characteristics: number;
}

export interface DataDirectoryEntry {
  index: number;
  name: string;
  rva: number;
  size: number;
  fileOffset: number | null;
  valid: boolean;
}

export interface PeSection {
  name: string;
  virtualSize: number;
  virtualAddress: number;
  sizeOfRawData: number;
  pointerToRawData: number;
  characteristics: number;
  permissions: string;
}

export interface PeImportEntry {
  dll: string;
  functions: { name: string | null; ordinal: number | null; iatRva: number }[];
}

export interface PeExportEntry {
  name: string | null;
  ordinal: number;
  rva: number;
}

export interface PeResourceEntry {
  typeId: number;
  typeName: string;
  nameId: number;
  langId: number;
  dataRva: number;
  size: number;
  fileOffset: number | null;
  codepage: number;
}

export interface PeRelocBlock {
  pageRva: number;
  blockSize: number;
  entryCount: number;
  fileOffset: number;
}

export interface PeDebugEntry {
  type: number;
  typeName: string;
  sizeOfData: number;
  rva: number;
  fileOffset: number | null;
  timeDateStamp: number;
}

export interface PeTlsInfo {
  startRva: number;
  endRva: number;
  indexRva: number;
  callbacksRva: number;
  sizeOfZeroFill: number;
  characteristics: number;
}

export interface PeDelayImportDll {
  dll: string;
  attributes: number;
  rva: number;
}

export interface PeParseResult {
  ok: boolean;
  dos: DosHeader;
  coff: CoffHeader;
  isPe32Plus: boolean;
  subsystem: number;
  subsystemName: string;
  imageBase: bigint;
  entryPointRva: number;
  sectionAlignment: number;
  fileAlignment: number;
  sizeOfImage: number;
  sizeOfHeaders: number;
  sections: PeSection[];
  dataDirectories: DataDirectoryEntry[];
  imports: PeImportEntry[];
  exports: PeExportEntry[];
  resources: PeResourceEntry[];
  relocBlocks: PeRelocBlock[];
  debugEntries: PeDebugEntry[];
  tls: PeTlsInfo | null;
  delayImports: PeDelayImportDll[];
  issues: ParseIssue[];
}

export const DATA_DIR_NAMES = [
  "Export",
  "Import",
  "Resource",
  "Exception",
  "Security",
  "BaseReloc",
  "Debug",
  "Architecture",
  "GlobalPtr",
  "TLS",
  "LoadConfig",
  "BoundImport",
  "IAT",
  "DelayImport",
  "CLR",
  "Reserved",
] as const;
