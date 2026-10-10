import { formatHex, readCString } from "./format";

export interface ElfSection {
  name: string;
  type: string;
  flags: number;
  address: number;
  offset: number;
  size: number;
}

export interface ElfAnalysis {
  kind: "elf";
  klass: 32 | 64;
  endian: "LE" | "BE";
  machine: string;
  entry: number;
  sections: ElfSection[];
  summary: Record<string, string>;
}

const ELF_MACHINE: Record<number, string> = {
  0x03: "x86",
  0x3e: "x64",
  0x28: "ARM",
  0xb7: "AArch64",
  0x08: "MIPS",
  0x14: "PowerPC",
  0xf3: "RISC-V",
};

const SHT: Record<number, string> = {
  0: "NULL",
  1: "PROGBITS",
  2: "SYMTAB",
  3: "STRTAB",
  4: "RELA",
  5: "HASH",
  6: "DYNAMIC",
  7: "NOTE",
  8: "NOBITS",
  9: "REL",
  11: "DYNSYM",
};

export function parseElf(buffer: ArrayBuffer): ElfAnalysis | null {
  const view = new DataView(buffer);
  if (buffer.byteLength < 64) return null;
  if (view.getUint8(0) !== 0x7f) return null;
  if (readCString(view, 1, 3) !== "ELF") return null;

  const klass = view.getUint8(4) === 2 ? 64 : 32;
  const endian = view.getUint8(5) === 1 ? "LE" : "BE";
  const le = endian === "LE";

  const read16 = (o: number) => view.getUint16(o, le);
  const read32 = (o: number) => view.getUint32(o, le);
  const read64 = (o: number) => Number(view.getBigUint64(o, le));

  const e_type = read16(16);
  const machine = read16(18);
  const e_entry = klass === 64 ? read64(24) : read32(24);
  const e_shoff = klass === 64 ? read64(40) : read32(32);
  const e_shentsize = read16(klass === 64 ? 58 : 46);
  const e_shnum = read16(klass === 64 ? 60 : 48);
  const e_shstrndx = read16(klass === 64 ? 62 : 50);

  if (e_shoff === 0 || e_shnum === 0) return null;

  const shstrOff = e_shoff + e_shstrndx * e_shentsize;
  const shstrOffset = klass === 64
    ? read64(shstrOff + 24)
    : read32(shstrOff + 16);
  const shstrSize = klass === 64 ? read64(shstrOff + 32) : read32(shstrOff + 20);

  const sections: ElfSection[] = [];
  for (let i = 0; i < e_shnum; i++) {
    const off = e_shoff + i * e_shentsize;
    if (off + e_shentsize > buffer.byteLength) break;
    const sh_name = read32(off);
    const sh_type = read32(off + 4);
    const sh_flags = klass === 64 ? read64(off + 8) : read32(off + 8);
    const sh_addr = klass === 64 ? read64(off + 16) : read32(off + 12);
    const sh_offset = klass === 64 ? read64(off + 24) : read32(off + 16);
    const sh_size = klass === 64 ? read64(off + 32) : read32(off + 20);

    let name = "";
    if (shstrOffset + sh_name < buffer.byteLength) {
      name = readCString(view, shstrOffset + sh_name, 64);
    }

    sections.push({
      name: name || `section_${i}`,
      type: SHT[sh_type] ?? `0x${sh_type.toString(16)}`,
      flags: sh_flags,
      address: sh_addr,
      offset: sh_offset,
      size: sh_size,
    });
  }

  const arch = ELF_MACHINE[machine] ?? `0x${machine.toString(16)}`;
  const typeName =
    e_type === 1 ? "REL" : e_type === 2 ? "EXEC" : e_type === 3 ? "DYN" : String(e_type);

  return {
    kind: "elf",
    klass,
    endian,
    machine: arch,
    entry: e_entry,
    sections,
    summary: {
      Format: `ELF${klass}`,
      Endian: endian,
      Type: typeName,
      Architecture: arch,
      Entry: formatHex(e_entry, klass === 64 ? 16 : 8),
      Sections: String(sections.length),
      ...(machine === 0x3e || machine === 0x03
        ? { "Disasm arch": machine === 0x3e ? "x64" : "x86" }
        : {}),
    },
  };
}

export function elfSectionBytes(
  buffer: ArrayBuffer,
  section: ElfSection,
): Uint8Array {
  const data = new Uint8Array(buffer);
  const end = Math.min(section.offset + section.size, data.length);
  if (section.offset >= data.length) return new Uint8Array();
  return data.subarray(section.offset, end);
}
