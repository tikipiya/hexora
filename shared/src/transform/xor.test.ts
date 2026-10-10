import { describe, expect, it } from "vitest";
import { analyzeSingleByteXor, xorWithKey } from "./xor.ts";

describe("xorWithKey", () => {
  it("round-trips single-byte key", () => {
    const plain = new TextEncoder().encode("Hello flag{test}");
    const key = new Uint8Array([0x42]);
    const enc = xorWithKey(plain, key);
    const dec = xorWithKey(enc, key);
    expect(new TextDecoder().decode(dec)).toBe("Hello flag{test}");
  });
});

describe("analyzeSingleByteXor", () => {
  it("ranks correct key highly for XOR-obfuscated ASCII", () => {
    const plain = new TextEncoder().encode(
      "The quick brown fox jumps over the lazy dog. flag{xor_key_0x55}",
    );
    const key = 0x55;
    const enc = xorWithKey(plain, new Uint8Array([key]));
    const hits = analyzeSingleByteXor(enc, 4096, 8);
    expect(hits[0]?.key[0]).toBe(key);
    expect(hits[0]!.printableRatio).toBeGreaterThan(0.85);
  });
});
