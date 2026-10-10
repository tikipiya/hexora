import type { ParseMode } from "../binary/errors.ts";
import { BinaryParseError } from "../binary/errors.ts";
import { BinaryReader } from "../binary/reader.ts";
import type {
  WasmCodeBody,
  WasmExport,
  WasmImport,
  WasmParseResult,
  WasmSection,
} from "./types.ts";

const SEC: Record<number, string> = {
  0: "custom",
  1: "type",
  2: "import",
  3: "function",
  4: "table",
  5: "memory",
  6: "global",
  7: "export",
  8: "start",
  9: "element",
  10: "code",
  11: "data",
  12: "datacount",
};

export function parseWasm(
  buffer: ArrayBuffer | Uint8Array,
  mode: ParseMode = "lenient",
): WasmParseResult {
  const issues: WasmParseResult["issues"] = [];
  const push = (issue: WasmParseResult["issues"][0]) => {
    if (mode === "strict" && issue.severity === "error") {
      throw new BinaryParseError(issue.message, issue.code);
    }
    issues.push(issue);
  };

  const r = new BinaryReader(buffer, "le");
  if (!r.matchAt(0, [0x00, 0x61, 0x73, 0x6d])) {
    throw new BinaryParseError("Not a WebAssembly module", "not_wasm");
  }
  const version = r.readU32(4);
  if (version !== 1) {
    push({ severity: "warning", code: "wasm_ver", message: `Unexpected wasm version ${version}` });
  }

  const sections: WasmSection[] = [];
  const imports: WasmImport[] = [];
  const exports: WasmExport[] = [];
  const codeBodies: WasmCodeBody[] = [];
  let typeCount = 0;
  let functionCount = 0;
  let importFunctionCount = 0;
  let pos = 8;

  while (pos < r.length) {
    const id = r.readU8(pos);
    const size = readU32Leb(r, pos + 1);
    const payloadOff = size.offset;
    const secSize = size.value;
    const name = SEC[id] ?? `sec_${id}`;
    sections.push({
      id,
      name: id === 0 ? readCustomName(r, payloadOff) || "custom" : name,
      fileOffset: pos,
      size: secSize + (payloadOff - pos),
    });

    if (id === 1) typeCount = readU32Leb(r, payloadOff).value;
    if (id === 2) {
      importFunctionCount = parseImportSection(r, payloadOff, secSize, imports);
    }
    if (id === 3) functionCount = readU32Leb(r, payloadOff).value;
    if (id === 7) parseExportSection(r, payloadOff, secSize, exports);
    if (id === 10) {
      parseCodeSection(r, payloadOff, secSize, importFunctionCount, codeBodies);
    }

    pos = payloadOff + secSize;
  }

  return {
    ok: !issues.some((i) => i.severity === "error"),
    version,
    sections,
    imports,
    exports,
    typeCount,
    functionCount,
    importFunctionCount,
    codeBodies,
    issues,
  };
}

function readCustomName(r: BinaryReader, off: number): string {
  const n = readU32Leb(r, off);
  if (n.value === 0 || n.offset + n.value > r.length) return "";
  return new TextDecoder().decode(r.buffer.subarray(n.offset, n.offset + n.value));
}

function readU32Leb(r: BinaryReader, off: number): { value: number; offset: number } {
  let result = 0;
  let shift = 0;
  let i = off;
  while (i < r.length) {
    const b = r.readU8(i++);
    result |= (b & 0x7f) << shift;
    if ((b & 0x80) === 0) return { value: result >>> 0, offset: i };
    shift += 7;
    if (shift > 35) break;
  }
  return { value: 0, offset: i };
}

function readName(r: BinaryReader, off: number): { name: string; offset: number } {
  const len = readU32Leb(r, off);
  const start = len.offset;
  const name = new TextDecoder().decode(
    r.buffer.subarray(start, start + len.value),
  );
  return { name, offset: start + len.value };
}

function parseImportSection(
  r: BinaryReader,
  off: number,
  size: number,
  out: WasmImport[],
): number {
  const end = off + size;
  const count = readU32Leb(r, off);
  let p = count.offset;
  let fnImports = 0;
  while (p < end && out.length < 500) {
    const mod = readName(r, p);
    p = mod.offset;
    const nm = readName(r, p);
    p = nm.offset;
    const kind = r.readU8(p++);
    const kindName =
      kind === 0 ? "function" : kind === 1 ? "table" : kind === 2 ? "memory" : "global";
    if (kind === 0) {
      const ti = readU32Leb(r, p);
      p = ti.offset;
      fnImports++;
      out.push({
        module: mod.name,
        name: nm.name,
        kind: "function",
        typeIndex: ti.value,
      });
    } else {
      p = skipImportKind(r, p, kind);
      out.push({ module: mod.name, name: nm.name, kind: kindName as WasmImport["kind"] });
    }
  }
  return fnImports;
}

function skipImportKind(r: BinaryReader, p: number, kind: number): number {
  if (kind === 1) return p + 1 + 1; // table type simplified
  if (kind === 2) return p + 1; // memory limits simplified
  if (kind === 3) return p + 2; // global type
  return p;
}

function parseExportSection(
  r: BinaryReader,
  off: number,
  size: number,
  out: WasmExport[],
): void {
  const end = off + size;
  const count = readU32Leb(r, off);
  let p = count.offset;
  while (p < end && out.length < 500) {
    const nm = readName(r, p);
    p = nm.offset;
    const kind = r.readU8(p++);
    const idx = readU32Leb(r, p);
    p = idx.offset;
    const kindName =
      kind === 0 ? "function" : kind === 1 ? "table" : kind === 2 ? "memory" : "global";
    out.push({ name: nm.name, kind: kindName as WasmExport["kind"], index: idx.value });
  }
}

function parseCodeSection(
  r: BinaryReader,
  off: number,
  size: number,
  importFunctionCount: number,
  out: WasmCodeBody[],
): void {
  const end = off + size;
  const count = readU32Leb(r, off);
  let p = count.offset;
  let codeIndex = 0;
  while (p < end && out.length < 10_000) {
    const bodySize = readU32Leb(r, p);
    const bodyStart = bodySize.offset;
    out.push({
      codeIndex,
      moduleFunctionIndex: importFunctionCount + codeIndex,
      fileOffset: bodyStart,
      size: bodySize.value,
    });
    codeIndex++;
    p = bodyStart + bodySize.value;
  }
}
