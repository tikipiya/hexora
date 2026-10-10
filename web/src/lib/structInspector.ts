import type { BinaryAnalysis } from "./binaryAnalysis";
import { resolvePointerForUi } from "./memoryMap";
import { elfFileToVa, peFileToRva } from "@hexora/shared";

export interface InspectedField {
  id: string;
  label: string;
  offset: number;
  size: number;
  rawHex: string;
  display: string;
  followFileOffset?: number;
  followVa?: number;
}

export interface InspectContext {
  data: Uint8Array;
  offset: number;
  analysis: BinaryAnalysis | null;
}

export function inspectAt(ctx: InspectContext): InspectedField[] {
  const { data, offset, analysis } = ctx;
  const map = analysis;
  const le =
    analysis?.pe?.isPe32Plus !== undefined
      ? true
      : analysis?.elf?.header.endian === "BE"
        ? false
        : true;
  const is64 = analysis?.pe?.isPe32Plus ?? analysis?.elf?.header.class === 64;
  if (offset < 0 || offset >= data.length) return [];

  const view = new DataView(
    data.buffer,
    data.byteOffset,
    data.byteLength,
  );
  const fields: InspectedField[] = [];

  const push = (field: InspectedField) => fields.push(field);

  if (offset + 1 <= data.length) {
    const u8 = view.getUint8(offset);
    push({
      id: "u8",
      label: "uint8",
      offset,
      size: 1,
      rawHex: hexBytes(data, offset, 1),
      display: String(u8),
    });
    push({
      id: "i8",
      label: "int8",
      offset,
      size: 1,
      rawHex: hexBytes(data, offset, 1),
      display: String(view.getInt8(offset)),
    });
  }

  if (offset + 2 <= data.length) {
    push({
      id: "u16",
      label: "uint16",
      offset,
      size: 2,
      rawHex: hexBytes(data, offset, 2),
      display: `0x${view.getUint16(offset, le).toString(16)} (${view.getUint16(offset, le)})`,
    });
  }

  if (offset + 4 <= data.length) {
    const u32 = view.getUint32(offset, le);
    const i32 = view.getInt32(offset, le);
    const f32 = view.getFloat32(offset, le);
    push({
      id: "u32",
      label: "uint32",
      offset,
      size: 4,
      rawHex: hexBytes(data, offset, 4),
      display: `0x${u32.toString(16)} (${u32})`,
    });
    push({
      id: "i32",
      label: "int32",
      offset,
      size: 4,
      rawHex: hexBytes(data, offset, 4),
      display: String(i32),
    });
    push({
      id: "f32",
      label: "float32",
      offset,
      size: 4,
      rawHex: hexBytes(data, offset, 4),
      display: Number.isFinite(f32) ? f32.toPrecision(7) : String(f32),
    });

    if (map && !is64) {
      appendPointer(push, map, offset, u32, 4, data);
    }
  }

  if (offset + 8 <= data.length) {
    const lo = view.getUint32(offset, le);
    const hi = view.getUint32(offset + 4, le);
    const u64 = is64
      ? readU64(view, offset, le)
      : (BigInt(hi) << 32n) | BigInt(lo);
    const f64 = view.getFloat64(offset, le);
    push({
      id: "u64",
      label: "uint64",
      offset,
      size: 8,
      rawHex: hexBytes(data, offset, 8),
      display: `0x${u64.toString(16)}`,
    });
    push({
      id: "f64",
      label: "float64",
      offset,
      size: 8,
      rawHex: hexBytes(data, offset, 8),
      display: Number.isFinite(f64) ? String(f64) : String(f64),
    });

    if (is64) {
      const va = Number(u64 & 0xffff_ffff_ffff_ffffn);
      appendPointer(push, map, offset, va, 8, data);
    }
  }

  const cstr = readCStringAt(data, offset, 128);
  if (cstr && cstr.value.length >= 2) {
    push({
      id: "cstr",
      label: "char[]",
      offset,
      size: cstr.length,
      rawHex: hexBytes(data, offset, Math.min(cstr.length, 16)) + (cstr.length > 16 ? "…" : ""),
      display: JSON.stringify(cstr.value),
    });
  }

  if (analysis?.elfSpace) {
    const res = elfFileToVa(analysis.elfSpace, offset);
    if (res.vaddr) {
      push({
        id: "fileoff",
        label: "file → VA",
        offset,
        size: 0,
        rawHex: "",
        display: res.vaddr,
      });
    }
  }
  if (analysis?.peSpace) {
    const res = peFileToRva(analysis.peSpace, offset);
    if (res.rva !== undefined) {
      push({
        id: "fileoff",
        label: "file → RVA / VA",
        offset,
        size: 0,
        rawHex: "",
        display: `RVA 0x${res.rva.toString(16)} · VA ${res.va ?? "—"}`,
      });
    }
  }

  return fields;
}

function appendPointer(
  push: (f: InspectedField) => void,
  analysis: BinaryAnalysis,
  offset: number,
  raw: number,
  size: number,
  data: Uint8Array,
) {
  const resolved = resolvePointerForUi(analysis, raw);
  push({
    id: `ptr${size}`,
    label: `ptr${size * 8}`,
    offset,
    size,
    rawHex: hexBytes(data, offset, size),
    display: resolved
      ? `0x${raw.toString(16)} → ${resolved.label} → file 0x${resolved.fileOffset!.toString(16)}`
      : `0x${raw.toString(16)} (unmapped)`,
    followFileOffset: resolved?.fileOffset,
    followVa: raw,
  });
}

function readU64(view: DataView, offset: number, le: boolean): bigint {
  const a = view.getUint32(offset, le);
  const b = view.getUint32(offset + 4, le);
  return le
    ? (BigInt(b) << 32n) | BigInt(a)
    : (BigInt(a) << 32n) | BigInt(b);
}

function hexBytes(data: Uint8Array, offset: number, len: number): string {
  return [...data.subarray(offset, offset + len)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");
}

function readCStringAt(
  data: Uint8Array,
  offset: number,
  max: number,
): { value: string; length: number } | null {
  if (data[offset] < 0x20 || data[offset] > 0x7e) return null;
  const bytes: number[] = [];
  for (let i = 0; i < max && offset + i < data.length; i++) {
    const b = data[offset + i];
    if (b === 0) {
      return {
        value: new TextDecoder("ascii").decode(new Uint8Array(bytes)),
        length: bytes.length + 1,
      };
    }
    if (b < 0x20 || b > 0x7e) return null;
    bytes.push(b);
  }
  return null;
}

/** 選択範囲をリトルエンディアン構造体として並べて解釈 */
export function inspectStructBlock(
  data: Uint8Array,
  start: number,
  end: number,
  analysis: BinaryAnalysis | null,
  stride = 8,
): InspectedField[] {
  const out: InspectedField[] = [];
  let off = start;
  let idx = 0;
  while (off + stride <= end + 1 && off < data.length) {
    const fields = inspectAt({ data, offset: off, analysis });
    const head = fields.find((f) => f.id === (stride === 8 ? "u64" : "u32"));
    if (head) {
      out.push({
        ...head,
        label: `[${idx}] ${head.label}`,
      });
    }
    off += stride;
    idx++;
    if (idx > 64) break;
  }
  return out;
}
