import type { Arch } from "@hexora/shared";
import type { BinaryAnalysis } from "./binaryAnalysis";

export const DEFAULT_DISASM_BYTES = 65536;
export const MAX_DISASM_BYTES = 512 * 1024;

export interface DisasmTarget {
  id: string;
  label: string;
  fileOffset: number;
  maxSize: number;
  baseAddress: number;
  arch: Arch;
  executable?: boolean;
}

export function archFromAnalysis(analysis: BinaryAnalysis): Arch | null {
  if (analysis.pe) {
    const m = analysis.pe.coff.machine;
    if (m === 0x8664) return "x64";
    if (m === 0x014c) return "x86";
    if (m === 0xaa64) return "arm64";
    return null;
  }
  if (analysis.elf) {
    const m = analysis.elf.header.machine;
    if (m === 0x3e) return "x64";
    if (m === 0x03) return "x86";
    if (m === 0xb7) return "arm64";
    return null;
  }
  if (analysis.macho) {
    const n = analysis.macho.cpuName;
    if (n.includes("ARM64")) return "arm64";
    if (n.includes("x86_64")) return "x64";
    if (n === "x86") return "x86";
  }
  return null;
}

export function unsupportedMachineLabel(analysis: BinaryAnalysis): string | null {
  if (analysis.pe) {
    const name = analysis.pe.coff.machineName;
    if (archFromAnalysis(analysis)) return null;
    return name || `0x${analysis.pe.coff.machine.toString(16)}`;
  }
  if (analysis.elf) {
    if (archFromAnalysis(analysis)) return null;
    return analysis.elf.header.machineName;
  }
  return null;
}

export function listDisasmTargets(
  analysis: BinaryAnalysis,
  fileSize: number,
): DisasmTarget[] {
  const arch = archFromAnalysis(analysis);
  if (!arch) return [];

  const targets: DisasmTarget[] = [];

  if (analysis.pe) {
    const pe = analysis.pe;
    for (const s of pe.sections) {
      if (s.sizeOfRawData === 0 || s.pointerToRawData >= fileSize) continue;
      const raw = Math.min(s.sizeOfRawData, fileSize - s.pointerToRawData);
      targets.push({
        id: `pe-sec-${s.virtualAddress}`,
        label: `Section ${s.name.trim()}`,
        fileOffset: s.pointerToRawData,
        maxSize: raw,
        baseAddress: Number(pe.imageBase + BigInt(s.virtualAddress)),
        arch,
        executable: s.permissions.includes("X"),
      });
    }
    if (pe.entryPointRva) {
      const entryFile = pe.sections.find(
        (s) =>
          pe.entryPointRva >= s.virtualAddress &&
          pe.entryPointRva < s.virtualAddress + Math.max(s.virtualSize, s.sizeOfRawData),
      );
      const off = entryFile?.pointerToRawData ?? 0;
      const rel = entryFile
        ? pe.entryPointRva - entryFile.virtualAddress
        : pe.entryPointRva;
      targets.push({
        id: "pe-entry",
        label: `Entry @ RVA 0x${pe.entryPointRva.toString(16)}`,
        fileOffset: Math.min(fileSize - 1, off + rel),
        maxSize: Math.min(DEFAULT_DISASM_BYTES, fileSize),
        baseAddress: Number(pe.imageBase + BigInt(pe.entryPointRva)),
        arch,
        executable: true,
      });
    }
  }

  if (analysis.macho) {
    const m = analysis.macho;
    for (const s of m.segments) {
      const off = Number(s.fileoff);
      const size = Number(s.filesize);
      if (size === 0 || off >= fileSize) continue;
      targets.push({
        id: `macho-${s.name}`,
        label: `Segment ${s.name}`,
        fileOffset: off,
        maxSize: Math.min(size, fileSize - off),
        baseAddress: Number(s.vmaddr),
        arch,
        executable: s.initprot.includes("X"),
      });
    }
  }

  if (analysis.elf) {
    const elf = analysis.elf;
    const SHF_EXEC = 4n;
    for (const s of elf.sectionHeaders) {
      if (s.isNobits || s.size === 0n) continue;
      const off = Number(s.offset);
      if (off >= fileSize) continue;
      const raw = Math.min(Number(s.size), fileSize - off);
      targets.push({
        id: `elf-sec-${s.index}`,
        label: `Section ${s.name}`,
        fileOffset: off,
        maxSize: raw,
        baseAddress: Number(s.addr),
        arch,
        executable: (s.flags & SHF_EXEC) !== 0n,
      });
    }
    if (elf.header.entry !== 0n) {
      targets.push({
        id: "elf-entry",
        label: `Entry @ 0x${elf.header.entry.toString(16)}`,
        fileOffset: 0,
        maxSize: Math.min(DEFAULT_DISASM_BYTES, fileSize),
        baseAddress: Number(elf.header.entry),
        arch,
        executable: true,
      });
    }
  }

  targets.push({
    id: "raw-file",
    label: "File start (raw)",
    fileOffset: 0,
    maxSize: fileSize,
    baseAddress: 0,
    arch,
  });

  const seen = new Set<string>();
  return targets.filter((t) => {
    const k = `${t.fileOffset}:${t.baseAddress}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function sliceForDisasm(
  data: Uint8Array,
  target: DisasmTarget,
  byteLimit: number,
): Uint8Array {
  const limit = Math.min(byteLimit, target.maxSize, MAX_DISASM_BYTES);
  const end = Math.min(data.length, target.fileOffset + limit);
  return data.subarray(target.fileOffset, end);
}
