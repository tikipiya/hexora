import { BinaryParseError } from "./errors.ts";

export type Endian = "le" | "be";

export class BinaryReader {
  readonly buffer: Uint8Array;
  private view: DataView;
  offset = 0;

  constructor(
    buffer: ArrayBuffer | Uint8Array,
    readonly endian: Endian = "le",
  ) {
    this.buffer =
      buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    this.view = new DataView(
      this.buffer.buffer,
      this.buffer.byteOffset,
      this.buffer.byteLength,
    );
  }

  get length(): number {
    return this.buffer.byteLength;
  }

  get remaining(): number {
    return this.length - this.offset;
  }

  seek(offset: number): void {
    if (offset < 0 || offset > this.length) {
      throw new BinaryParseError("Seek out of range", "seek_oob", offset);
    }
    this.offset = offset;
  }

  fork(at?: number): BinaryReader {
    const r = new BinaryReader(this.buffer, this.endian);
    r.offset = at ?? this.offset;
    return r;
  }

  ensure(count: number, at?: number): void {
    const pos = at ?? this.offset;
    if (pos < 0 || pos + count > this.length) {
      throw new BinaryParseError(
        `Read past end (${pos}+${count} > ${this.length})`,
        "read_oob",
        pos,
      );
    }
  }

  readU8(at?: number): number {
    const pos = at ?? this.offset;
    this.ensure(1, pos);
    const v = this.view.getUint8(pos);
    if (at === undefined) this.offset += 1;
    return v;
  }

  readI8(at?: number): number {
    const pos = at ?? this.offset;
    this.ensure(1, pos);
    const v = this.view.getInt8(pos);
    if (at === undefined) this.offset += 1;
    return v;
  }

  readU16(at?: number): number {
    const pos = at ?? this.offset;
    this.ensure(2, pos);
    const v = this.view.getUint16(pos, this.endian === "le");
    if (at === undefined) this.offset += 2;
    return v;
  }

  readI16(at?: number): number {
    const pos = at ?? this.offset;
    this.ensure(2, pos);
    const v = this.view.getInt16(pos, this.endian === "le");
    if (at === undefined) this.offset += 2;
    return v;
  }

  readU32(at?: number): number {
    const pos = at ?? this.offset;
    this.ensure(4, pos);
    const v = this.view.getUint32(pos, this.endian === "le");
    if (at === undefined) this.offset += 4;
    return v;
  }

  readI32(at?: number): number {
    const pos = at ?? this.offset;
    this.ensure(4, pos);
    const v = this.view.getInt32(pos, this.endian === "le");
    if (at === undefined) this.offset += 4;
    return v;
  }

  readU64(at?: number): bigint {
    const pos = at ?? this.offset;
    this.ensure(8, pos);
    const v = this.view.getBigUint64(pos, this.endian === "le");
    if (at === undefined) this.offset += 8;
    return v;
  }

  readI64(at?: number): bigint {
    const pos = at ?? this.offset;
    this.ensure(8, pos);
    const v = this.view.getBigInt64(pos, this.endian === "le");
    if (at === undefined) this.offset += 8;
    return v;
  }

  readBytes(len: number, at?: number): Uint8Array {
    const pos = at ?? this.offset;
    this.ensure(len, pos);
    const slice = this.buffer.subarray(pos, pos + len);
    if (at === undefined) this.offset += len;
    return slice;
  }

  readCString(at?: number, max = 4096): string {
    let i = at ?? this.offset;
    const start = i;
    while (i < this.length && i - start < max) {
      const b = this.buffer[i];
      if (b === 0) {
        const str = new TextDecoder("latin1", { fatal: false }).decode(
          this.buffer.subarray(start, i),
        );
        if (at === undefined) this.offset = i + 1;
        return str;
      }
      if (b < 0x20) {
        throw new BinaryParseError("Invalid C string byte", "cstring_invalid", i);
      }
      i++;
    }
    throw new BinaryParseError("Unterminated C string", "cstring_unterm", start);
  }

  readCStringAt(offset: number, max = 256): string {
    const r = this.fork(offset);
    return r.readCString();
  }

  /** 文字列テーブル内のオフセットから文字列を読む */
  readStringTable(strtabOffset: number, index: number, max = 1024): string {
    const abs = strtabOffset + index;
    if (abs >= this.length) {
      throw new BinaryParseError("String table index OOB", "strtab_oob", abs);
    }
    return this.readCStringAt(abs, max);
  }

  matchAt(offset: number, bytes: number[]): boolean {
    if (offset + bytes.length > this.length) return false;
    for (let i = 0; i < bytes.length; i++) {
      if (this.buffer[offset + i] !== bytes[i]) return false;
    }
    return true;
  }
}

export function safeAdd(a: number, b: number): number | null {
  const r = a + b;
  if (r < a || r < b || r > Number.MAX_SAFE_INTEGER) return null;
  return r;
}
