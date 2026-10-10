import type { DisasmRequest, DisasmResponse } from "../../shared/src/index.ts";
import {
  DISASM_DEFAULT_MAX_INSTRUCTIONS,
  DISASM_MAX_BYTES,
  disassembleBytes,
} from "../../shared/src/index.ts";

interface PagesContext {
  request: Request;
  env: { MAX_DISASM_BYTES?: string };
}

export const onRequestPost = async (context: PagesContext): Promise<Response> => {
  try {
    const body = (await context.request.json()) as DisasmRequest;
    const maxBytes = Number(context.env.MAX_DISASM_BYTES ?? DISASM_MAX_BYTES);
    const bytes = base64ToUint8(body.bytes);
    if (bytes.length > maxBytes) {
      return json({ error: `Payload exceeds ${maxBytes} bytes` }, 413);
    }
    if (body.arch !== "x86" && body.arch !== "x64") {
      return json({ error: "Unsupported architecture" }, 400);
    }

    const maxInsn = body.maxInstructions ?? DISASM_DEFAULT_MAX_INSTRUCTIONS;
    const response: DisasmResponse = disassembleBytes(
      body.arch,
      body.address,
      bytes,
      maxInsn,
    );
    return json(response);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Disasm error";
    return json({ error: message }, 500);
  }
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}
