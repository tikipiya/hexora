import { handleOptions, handleTransformScan } from "../_handler.ts";

interface Ctx {
  request: Request;
  env: { MAX_ANALYZE_BYTES?: string; ALLOWED_ORIGIN?: string };
}

export const onRequestPost = (ctx: Ctx) => handleTransformScan(ctx.request, ctx.env);
export const onRequestOptions = (ctx: Ctx) => handleOptions(ctx.request, ctx.env);
