import type { ParseMode } from "../binary/errors.ts";
import { BinaryParseError } from "../binary/errors.ts";
import { BinaryReader } from "../binary/reader.ts";
import type { MachOLoadCommand, MachOParseResult, MachOSegment } from "./types.ts";

const CPU: Record<number, string> = {
  7: "x86",
  0x01000007: "x86_64",
  12: "ARM",
  0x0100000c: "ARM64",
};

const FILETYPE: Record<number, string> = {
  1: "OBJECT",
  2: "EXEC",
  6: "DYLIB",
  8: "BUNDLE",
};

const CMD: Record<number, string> = {
  1: "LC_SEGMENT",
  0x19: "LC_SEGMENT_64",
  5: "LC_UNIXTHREAD",
  0xb: "LC_DYSYMTAB",
  0xc: "LC_LOAD_DYLIB",
  0x1c: "LC_MAIN",
};

export function parseMachO(
  buffer: ArrayBuffer | Uint8Array,
  mode: ParseMode = "lenient",
): MachOParseResult {
  const issues: MachOParseResult["issues"] = [];
  const push = (issue: MachOParseResult["issues"][0]) => {
    if (mode === "strict" && issue.severity === "error") {
      throw new BinaryParseError(issue.message, issue.code);
    }
    issues.push(issue);
  };

  const r = new BinaryReader(buffer, "le");
  const magic = r.readU32(0);
  let bits: 32 | 64 = 32;
  let hdrOff = 0;
  if (magic === 0xfeedfacf) {
    bits = 64;
    hdrOff = 0;
  } else if (magic === 0xfeedface) {
    bits = 32;
  } else {
    throw new BinaryParseError("Not Mach-O", "not_macho");
  }

  const cpuType = r.readU32(4);
  const fileType = r.readU32(12);
  const ncmds = r.readU32(bits === 64 ? 16 : 12);
  const cmdOff = bits === 64 ? 32 : 28;

  const loadCommands: MachOLoadCommand[] = [];
  const segments: MachOSegment[] = [];
  let off = cmdOff;

  for (let i = 0; i < ncmds && off + 8 <= r.length; i++) {
    const cmd = r.readU32(off);
    const cmdsize = r.readU32(off + 4);
    if (cmdsize < 8) {
      push({ severity: "warning", code: "macho_cmd", message: "Invalid load command size" });
      break;
    }
    loadCommands.push({
      cmd,
      cmdName: CMD[cmd] ?? `LC_0x${cmd.toString(16)}`,
      cmdsize,
      fileOffset: off,
    });

    if (cmd === 0x19 && cmdsize >= 72) {
      const name = r.readCStringAt(off + 8, 16);
      const vmaddr = r.readU64(off + 24);
      const vmsize = r.readU64(off + 32);
      const fileoff = r.readU64(off + 40);
      const filesize = r.readU64(off + 48);
      segments.push({
        name,
        vmaddr,
        vmsize,
        fileoff,
        filesize,
        maxprot: prot(r.readU32(off + 56)),
        initprot: prot(r.readU32(off + 60)),
      });
    } else if (cmd === 1 && cmdsize >= 56 && bits === 32) {
      const name = r.readCStringAt(off + 8, 16);
      segments.push({
        name,
        vmaddr: BigInt(r.readU32(off + 24)),
        vmsize: BigInt(r.readU32(off + 28)),
        fileoff: BigInt(r.readU32(off + 32)),
        filesize: BigInt(r.readU32(off + 36)),
        maxprot: prot(r.readU32(off + 40)),
        initprot: prot(r.readU32(off + 44)),
      });
    }

    off += cmdsize;
    if (loadCommands.length > 512) break;
  }

  return {
    ok: !issues.some((i) => i.severity === "error"),
    magic: `0x${magic.toString(16)}`,
    cpuType,
    cpuName: CPU[cpuType] ?? `CPU_0x${cpuType.toString(16)}`,
    fileType,
    fileTypeName: FILETYPE[fileType] ?? String(fileType),
    bits,
    loadCommands,
    segments,
    issues,
  };
}

function prot(v: number): string {
  const p = [];
  if (v & 1) p.push("R");
  if (v & 2) p.push("W");
  if (v & 4) p.push("X");
  return p.join("") || "-";
}
