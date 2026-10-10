import type { BinaryReader } from "../binary/reader.ts";
import type { ElfSectionHeader, ElfVersionInfo } from "./types.ts";

export function parseElfVersions(
  r: BinaryReader,
  sectionHeaders: ElfSectionHeader[],
  dynstrOff: number,
  klass: 32 | 64,
): ElfVersionInfo {
  const verneedSh = sectionHeaders.find((s) => s.type === 0x6fffffff);
  const versymSh = sectionHeaders.find((s) => s.type === 0x6ffffffe);
  const verneed: ElfVerneedEntry[] = [];
  const versym: number[] = [];
  const indexToName = new Map<number, string>();

  const readStr = (off: number) => {
    try {
      return r.readCStringAt(dynstrOff + off, 256);
    } catch {
      return "";
    }
  };

  if (verneedSh) {
    let off = Number(verneedSh.offset);
    const end = off + Number(verneedSh.size);
    while (off + 16 <= end && off < r.length) {
      const vn_version = r.readU16(off);
      const vn_cnt = r.readU16(off + 2);
      const vn_file = r.readU32(off + 4);
      const vn_aux = r.readU32(off + 8);
      const vn_next = r.readU32(off + 12);
      const entry: ElfVerneedEntry = {
        file: readStr(vn_file),
        versions: [],
      };
      let auxOff = off + vn_aux;
      for (let i = 0; i < vn_cnt && auxOff + 16 <= r.length; i++) {
        const vna_hash = r.readU32(auxOff);
        const vna_flags = r.readU16(auxOff + 4);
        const vna_other = r.readU16(auxOff + 6);
        const vna_name = r.readU32(auxOff + 8);
        const vna_next = r.readU32(auxOff + 12);
        const name = readStr(vna_name);
        entry.versions.push({
          name,
          hash: vna_hash,
          flags: vna_flags,
          index: vna_other,
        });
        if (vna_other > 0) indexToName.set(vna_other, name);
        auxOff += vna_next || 16;
        if (vna_next === 0) break;
      }
      verneed.push(entry);
      if (vn_next === 0) break;
      off += vn_next;
    }
  }

  if (versymSh) {
    const count = Number(versymSh.size) / 2;
    const base = Number(versymSh.offset);
    for (let i = 0; i < count && base + i * 2 + 2 <= r.length; i++) {
      versym.push(r.readU16(base + i * 2));
    }
  }

  indexToName.set(0, "local");
  indexToName.set(1, "global");

  return { verneed, versym, indexToName };
}

export function symbolVersionName(
  info: ElfVersionInfo | null,
  symbolIndex: number,
): string | undefined {
  if (!info || symbolIndex >= info.versym.length) return undefined;
  const idx = info.versym[symbolIndex] & 0x7fff;
  return info.indexToName.get(idx);
}
