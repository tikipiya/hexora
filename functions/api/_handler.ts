import {
  allowedCorsOrigin,
  errorResponse,
  jsonResponse,
  maxAnalyzeBytes,
  parseBase64Payload,
  parseElf,
  parsePe,
  buildElfAddressSpace,
  elfFileToVa,
  elfVaToFile,
  buildPeAddressSpace,
  peRvaToFile,
  peFileToRva,
  peVaToRva,
  peRvaToVa,
  analyzeSingleByteXor,
  analyzeRepeatingXor,
  scanEncodings,
  scanCompression,
  carveFiles,
} from "../../shared/src/index.ts";

type Env = { MAX_ANALYZE_BYTES?: string; ALLOWED_ORIGIN?: string };

export function handleOptions(request: Request, env: Env): Response {
  const cors = allowedCorsOrigin(request, env);
  return jsonResponse({ ok: true }, 204, cors);
}

export async function handleAnalyzeElf(request: Request, env: Env): Promise<Response> {
  const cors = allowedCorsOrigin(request, env);
  if (request.method === "OPTIONS") return handleOptions(request, env);
  if (request.method !== "POST") return errorResponse(405, "Method not allowed", cors);
  const ct = request.headers.get("Content-Type") ?? "";
  if (!ct.includes("application/json")) {
    return errorResponse(415, "Content-Type must be application/json", cors);
  }
  let body: { bytes?: string; mode?: string };
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "Invalid JSON", cors);
  }
  if (!body.bytes) return errorResponse(400, "Missing bytes (base64)", cors);
  const max = maxAnalyzeBytes(env);
  const decoded = parseBase64Payload(body.bytes, max);
  if (!decoded.ok) return errorResponse(decoded.status, decoded.error, cors);
  const mode = body.mode === "strict" ? "strict" : "lenient";
  try {
    const result = parseElf(decoded.bytes, mode);
    return jsonResponse({ ok: true, format: "elf", result }, 200, cors);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ELF parse failed";
    return errorResponse(422, msg, cors);
  }
}

export async function handleAnalyzePe(request: Request, env: Env): Promise<Response> {
  const cors = allowedCorsOrigin(request, env);
  if (request.method === "OPTIONS") return handleOptions(request, env);
  if (request.method !== "POST") return errorResponse(405, "Method not allowed", cors);
  const ct = request.headers.get("Content-Type") ?? "";
  if (!ct.includes("application/json")) {
    return errorResponse(415, "Content-Type must be application/json", cors);
  }
  let body: { bytes?: string; mode?: string };
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "Invalid JSON", cors);
  }
  if (!body.bytes) return errorResponse(400, "Missing bytes (base64)", cors);
  const max = maxAnalyzeBytes(env);
  const decoded = parseBase64Payload(body.bytes, max);
  if (!decoded.ok) return errorResponse(decoded.status, decoded.error, cors);
  const mode = body.mode === "strict" ? "strict" : "lenient";
  try {
    const result = parsePe(decoded.bytes, mode);
    return jsonResponse({ ok: true, format: "pe", result }, 200, cors);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "PE parse failed";
    return errorResponse(422, msg, cors);
  }
}

export async function handleAddressElf(request: Request, env: Env): Promise<Response> {
  const cors = allowedCorsOrigin(request, env);
  if (request.method === "OPTIONS") return handleOptions(request, env);
  if (request.method !== "POST") return errorResponse(405, "Method not allowed", cors);
  let body: { bytes?: string; fileOffset?: number; vaddr?: string };
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "Invalid JSON", cors);
  }
  if (!body.bytes) return errorResponse(400, "Missing bytes", cors);
  const decoded = parseBase64Payload(body.bytes, maxAnalyzeBytes(env));
  if (!decoded.ok) return errorResponse(decoded.status, decoded.error, cors);
  let parsed;
  try {
    parsed = parseElf(decoded.bytes, "lenient");
  } catch (e) {
    return errorResponse(422, e instanceof Error ? e.message : "parse failed", cors);
  }
  const space = buildElfAddressSpace(
    parsed.programHeaders,
    parsed.sectionHeaders,
    parsed.issues,
  );
  let result;
  if (body.fileOffset !== undefined) {
    result = elfFileToVa(space, body.fileOffset);
  } else if (body.vaddr !== undefined) {
    result = elfVaToFile(space, BigInt(body.vaddr));
  } else {
    return errorResponse(400, "Provide fileOffset or vaddr", cors);
  }
  return jsonResponse({ ok: true, result }, 200, cors);
}

export async function handleAddressPe(request: Request, env: Env): Promise<Response> {
  const cors = allowedCorsOrigin(request, env);
  if (request.method === "OPTIONS") return handleOptions(request, env);
  if (request.method !== "POST") return errorResponse(405, "Method not allowed", cors);
  let body: {
    bytes?: string;
    fileOffset?: number;
    rva?: number;
    va?: string;
  };
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "Invalid JSON", cors);
  }
  if (!body.bytes) return errorResponse(400, "Missing bytes", cors);
  const decoded = parseBase64Payload(body.bytes, maxAnalyzeBytes(env));
  if (!decoded.ok) return errorResponse(decoded.status, decoded.error, cors);
  let parsed;
  try {
    parsed = parsePe(decoded.bytes, "lenient");
  } catch (e) {
    return errorResponse(422, e instanceof Error ? e.message : "parse failed", cors);
  }
  const space = buildPeAddressSpace(
    parsed.imageBase,
    parsed.sections,
    parsed.sizeOfHeaders,
    parsed.issues,
  );
  let result;
  if (body.fileOffset !== undefined) {
    result = peFileToRva(space, body.fileOffset);
  } else if (body.rva !== undefined) {
    result = peRvaToFile(space, body.rva);
  } else if (body.va !== undefined) {
    const rva = peVaToRva(space, BigInt(body.va));
    if (rva === null) return errorResponse(400, "VA below image base", cors);
    result = peRvaToFile(space, rva);
    result.va = body.va;
  } else {
    return errorResponse(400, "Provide fileOffset, rva, or va", cors);
  }
  return jsonResponse({ ok: true, result, rvaToVa: body.rva !== undefined ? peRvaToVa(space, body.rva).toString() : undefined }, 200, cors);
}

export async function handleTransformScan(request: Request, env: Env): Promise<Response> {
  const cors = allowedCorsOrigin(request, env);
  if (request.method === "OPTIONS") return handleOptions(request, env);
  if (request.method !== "POST") return errorResponse(405, "Method not allowed", cors);
  let body: {
    bytes?: string;
    xor?: boolean;
    encoding?: boolean;
    compression?: boolean;
    carving?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "Invalid JSON", cors);
  }
  if (!body.bytes) return errorResponse(400, "Missing bytes (base64)", cors);
  const decoded = parseBase64Payload(body.bytes, maxAnalyzeBytes(env));
  if (!decoded.ok) return errorResponse(decoded.status, decoded.error, cors);
  const data = decoded.bytes;
  const opt = {
    xor: body.xor !== false,
    encoding: body.encoding !== false,
    compression: body.compression !== false,
    carving: body.carving !== false,
  };
  const singleXor = opt.xor ? analyzeSingleByteXor(data) : [];
  const repeatXor = opt.xor ? analyzeRepeatingXor(data) : [];
  const encodings = opt.encoding
    ? scanEncodings(data).map((e) => ({
        ...e,
        decodedBytes: undefined,
      }))
    : [];
  const compression = opt.compression ? scanCompression(data) : [];
  const carved = opt.carving ? carveFiles(data, 300) : [];
  return jsonResponse(
    {
      ok: true,
      singleXor,
      repeatXor,
      encodings,
      compression,
      carved,
    },
    200,
    cors,
  );
}
