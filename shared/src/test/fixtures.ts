/** 最小の PE32+ ヘッダ + 1 セクション（テスト用） */
export function minimalPe64(): Uint8Array {
  const size = 0x400;
  const buf = new Uint8Array(size);
  const view = new DataView(buf.buffer);
  view.setUint16(0, 0x5a4d, true);
  view.setUint32(0x3c, 0x80, true);
  view.setUint32(0x80, 0x00004550, true);
  const coff = 0x84;
  view.setUint16(coff, 0x8664, true);
  view.setUint16(coff + 2, 1, true);
  view.setUint16(coff + 16, 0xf0, true);
  const opt = coff + 20;
  view.setUint16(opt, 0x20b, true);
  view.setUint32(opt + 16, 0x1000, true);
  view.setBigUint64(opt + 24, BigInt(0x140000000), true);
  view.setUint32(opt + 56, 0x3000, true);
  view.setUint32(opt + 60, 0x200, true);
  const sec = opt + 0xf0;
  buf.set([0x2e, 0x74, 0x65, 0x78, 0x74, 0, 0, 0], sec);
  view.setUint32(sec + 8, 0x200, true);
  view.setUint32(sec + 12, 0x1000, true);
  view.setUint32(sec + 16, 0x200, true);
  view.setUint32(sec + 20, 0x200, true);
  view.setUint32(sec + 36, 0x60000020, true);
  buf[0x200] = 0x90;
  buf[0x201] = 0xc3;
  return buf;
}

/** 最小 ELF64 LE 実行可能風（1 PT_LOAD + 2 sections） */
export function minimalElf64(): Uint8Array {
  const size = 0x300;
  const buf = new Uint8Array(size);
  const view = new DataView(buf.buffer);
  buf.set([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1, 0]);
  view.setUint16(16, 2, true);
  view.setUint16(18, 0x3e, true);
  view.setBigUint64(24, BigInt(0x400000), true);
  view.setBigUint64(32, BigInt(0x40), true);
  view.setBigUint64(40, BigInt(0x180), true);
  view.setUint16(52, 64, true);
  view.setUint16(54, 56, true);
  view.setUint16(56, 1, true);
  view.setUint16(58, 64, true);
  view.setUint16(60, 3, true);
  view.setUint16(62, 2, true);
  const ph = 0x40;
  view.setUint32(ph, 1, true);
  view.setUint32(ph + 4, 5, true);
  view.setBigUint64(ph + 8, BigInt(0x100), true);
  view.setBigUint64(ph + 16, BigInt(0x400000), true);
  view.setBigUint64(ph + 24, BigInt(0x400000), true);
  view.setBigUint64(ph + 32, BigInt(0x100), true);
  view.setBigUint64(ph + 40, BigInt(0x200), true);
  view.setBigUint64(ph + 48, BigInt(0x1000), true);
  const sh = 0x180;
  const entsize = 64;
  for (let i = 0; i < 3; i++) {
    const off = sh + i * entsize;
    view.setUint32(off + 4, i === 0 ? 0 : i === 1 ? 1 : 3, true);
    if (i === 1) {
      view.setBigUint64(off + 16, BigInt(0x400000), true);
      view.setBigUint64(off + 24, BigInt(0x100), true);
      view.setBigUint64(off + 32, BigInt(0x100), true);
    }
    if (i === 2) {
      view.setBigUint64(off + 24, BigInt(0x80), true);
      view.setBigUint64(off + 32, BigInt(0x20), true);
    }
  }
  buf.set([0x2e, 0x74, 0x65, 0x78, 0x74, 0], 0x80);
  buf[0x100] = 0x7f;
  buf[0x101] = 0x45;
  return buf;
}
