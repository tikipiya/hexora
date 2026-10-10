import { describe, expect, it } from "vitest";
import { scanEncodings, tryDecodeAt } from "./encoding.ts";

describe("scanEncodings", () => {
  it("finds base64 blob", () => {
    const b64 = "SGVsbG8gV29ybGQh";
    const data = new TextEncoder().encode(`prefix ${b64} suffix`);
    const hits = scanEncodings(data);
    const b64Hit = hits.find((h) => h.kind === "base64" || h.kind === "base64url");
    expect(b64Hit).toBeDefined();
    expect(b64Hit!.decodedPreview).toContain("Hello");
  });
});

describe("tryDecodeAt", () => {
  it("decodes hex at offset", () => {
    const hex = "48656c6c6f";
    const data = new TextEncoder().encode(hex);
    const res = tryDecodeAt(data, 0, "hex", hex.length);
    expect(res).not.toBeNull();
    expect(new TextDecoder().decode(res!)).toBe("Hello");
  });
});
