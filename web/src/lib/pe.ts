import { formatHex, readCString } from "./format";

export interface PeSection {
  name: string;
  virtualAddress: number;
  virtualSize: number;
  rawOffset: number;
  rawSize: number;
  characteristics: number;
}

export interface PeAnalysis {
  kind: "pe";
  machine: string;
  is64: boolean;
  imageBase: number;
  entryPoint: number;
  sections: PeSection[];
  characteristics: number;
  subsystem: string;
  timeDateStamp: number;
  summary: Record<string, string>;
}

const MACHINE: Record<number, string> = {
  0x014c: "x86",
  0x8664: "x64",
  0x01c0: "ARM",
  0xaa64: "ARM64",
};

const SUBSYSTEM: Record<number, string> = {
  1: "Native",
  2: "Windows GUI",
  3: "Windows CUI",
  9: "Windows CE GUI",
  10: "EFI Application",
};

export function parsePe(buffer: ArrayBuffer): PeAnalysis | null {
  const view = new DataView(buffer);
  if (buffer.byteLength < 64) return null;
  if (view.getUint16(0, true) !== 0x5a4d) return null;

  const peOffset = view.getUint32(0x3c, true);
  if (peOffset + 24 > buffer.byteLength) return null;
  if (view.getUint32(peOffset, true) !== 0x00004550) return null;

  const machine = view.getUint16(peOffset + 4, true);
  const numberOfSections = view.getUint16(peOffset + 6, true);
  const timeDateStamp = view.getUint32(peOffset + 8, true);
  const sizeOfOptionalHeader = view.getUint16(peOffset + 20, true);
  const characteristics = view.getUint16(peOffset + 22, true);

  const optionalHeaderOffset = peOffset + 24;
  const magic = view.getUint16(optionalHeaderOffset, true);
  const is64 = magic === 0x20b;
  const is32 = magic === 0x10b;
  if (!is32 && !is64) return null;

  const entryPoint = view.getUint32(optionalHeaderOffset + 16, true);
  const imageBase = is64
    ? Number(view.getBigUint64(optionalHeaderOffset + 24, true))
    : view.getUint32(optionalHeaderOffset + 28, true);
  const subsystem = view.getUint16(optionalHeaderOffset + (is64 ? 68 : 68), true);

  const sectionTableOffset = optionalHeaderOffset + sizeOfOptionalHeader;
  const sections: PeSection[] = [];

  for (let i = 0; i < numberOfSections; i++) {
    const off = sectionTableOffset + i * 40;
    if (off + 40 > buffer.byteLength) break;
    const name = readCString(view, off, 8).replace(/\0/g, "");
    sections.push({
      name,
      virtualSize: view.getUint32(off + 8, true),
      virtualAddress: view.getUint32(off + 12, true),
      rawSize: view.getUint32(off + 16, true),
      rawOffset: view.getUint32(off + 20, true),
      characteristics: view.getUint32(off + 36, true),
    });
  }

  const arch = MACHINE[machine] ?? `0x${machine.toString(16)}`;
  const disasmArch = machine === 0x8664 ? "x64" : machine === 0x014c ? "x86" : null;

  return {
    kind: "pe",
    machine: arch,
    is64,
    imageBase,
    entryPoint,
    sections,
    characteristics,
    subsystem: SUBSYSTEM[subsystem] ?? String(subsystem),
    timeDateStamp,
    summary: {
      Format: "PE",
      Architecture: arch,
      "Image base": formatHex(imageBase, is64 ? 16 : 8),
      "Entry point": formatHex(imageBase + entryPoint, is64 ? 16 : 8),
      Subsystem: SUBSYSTEM[subsystem] ?? String(subsystem),
      Sections: String(sections.length),
      ...(disasmArch ? { "Disasm arch": disasmArch } : {}),
    },
  };
}

export function peSectionBytes(
  buffer: ArrayBuffer,
  section: PeSection,
): Uint8Array {
  const data = new Uint8Array(buffer);
  const end = Math.min(section.rawOffset + section.rawSize, data.length);
  return data.subarray(section.rawOffset, end);
}
