import { describe, expect, it } from "vitest";
import { parseBase64Payload } from "./limits.ts";

describe("parseBase64Payload", () => {
  it("rejects oversize", () => {
    const r = parseBase64Payload("AAAA", 2);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(413);
  });

  it("decodes valid payload", () => {
    const r = parseBase64Payload(btoa("hi"), 100);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.bytes.length).toBe(2);
  });
});
