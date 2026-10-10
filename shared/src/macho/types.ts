import type { ParseIssue } from "../binary/errors.ts";

export interface MachOLoadCommand {
  cmd: number;
  cmdName: string;
  cmdsize: number;
  fileOffset: number;
}

export interface MachOSegment {
  name: string;
  vmaddr: bigint;
  vmsize: bigint;
  fileoff: bigint;
  filesize: bigint;
  maxprot: string;
  initprot: string;
}

export interface MachOParseResult {
  ok: boolean;
  magic: string;
  cpuType: number;
  cpuName: string;
  fileType: number;
  fileTypeName: string;
  bits: 32 | 64;
  loadCommands: MachOLoadCommand[];
  segments: MachOSegment[];
  issues: ParseIssue[];
}
