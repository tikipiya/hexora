import { describe, expect, it } from "vitest";
import { BinaryReader } from "./reader.ts";
import { BinaryParseError } from "./errors.ts";

describe("BinaryReader", () => {
  it("reads integers with endianness", () => {
    const r = new BinaryReader(new Uint8Array([0x01, 0x00, 0x00, 0x00]));
    expect(r.readU32()).toBe(1);
  });

  it("throws on OOB", () => {
    const r = new BinaryReader(new Uint8Array([1]));
    expect(() => r.readU32()).toThrow(BinaryParseError);
  });

  it("reads C string", () => {
    const r = new BinaryReader(new Uint8Array([0x41, 0x42, 0]));
    expect(r.readCString()).toBe("AB");
  });
});
