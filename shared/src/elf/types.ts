import type { ParseIssue } from "../binary/errors.ts";

export interface ElfHeader {
  class: 32 | 64;
  endian: "LE" | "BE";
  version: number;
  osabi: number;
  abiVersion: number;
  type: number;
  typeName: string;
  machine: number;
  machineName: string;
  entry: bigint;
  phoff: bigint;
  shoff: bigint;
  flags: number;
  ehsize: number;
  phentsize: number;
  phnum: number;
  shentsize: number;
  shnum: number;
  shstrndx: number;
}

export interface ElfProgramHeader {
  type: number;
  typeName: string;
  flags: number;
  offset: bigint;
  vaddr: bigint;
  paddr: bigint;
  filesz: bigint;
  memsz: bigint;
  align: bigint;
}

export interface ElfSectionHeader {
  index: number;
  nameIndex: number;
  name: string;
  type: number;
  typeName: string;
  flags: bigint;
  addr: bigint;
  offset: bigint;
  size: bigint;
  link: number;
  info: number;
  addralign: bigint;
  entsize: bigint;
  /** ファイルにバックされているサイズ（NOBITS は 0） */
  fileBackedSize: bigint;
  isNobits: boolean;
}

export interface ElfSymbol {
  name: string;
  value: bigint;
  size: bigint;
  bind: string;
  type: string;
  shndx: number;
  sectionName?: string;
  fromDynsym: boolean;
  versionName?: string;
}

export interface ElfDynamicEntry {
  tag: number;
  tagName: string;
  value: bigint;
}

export interface ElfRelocation {
  offset: bigint;
  info: bigint;
  sym: number;
  type: number;
  addend?: bigint;
  rela: boolean;
  sectionIndex: number;
}

export interface ElfVerneedEntry {
  file: string;
  versions: { name: string; hash: number; flags: number; index: number }[];
}

export interface ElfVersionInfo {
  verneed: ElfVerneedEntry[];
  versym: number[];
  indexToName: Map<number, string>;
}

export interface ElfParseResult {
  ok: boolean;
  header: ElfHeader;
  programHeaders: ElfProgramHeader[];
  sectionHeaders: ElfSectionHeader[];
  symbols: ElfSymbol[];
  dynamic: ElfDynamicEntry[];
  relocations: ElfRelocation[];
  versions: ElfVersionInfo | null;
  interpreter: string | null;
  gnuHash: { present: boolean; bucket?: number; symoffset?: number } | null;
  issues: ParseIssue[];
}
