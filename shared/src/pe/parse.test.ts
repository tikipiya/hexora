import { describe, expect, it } from "vitest";
import { parsePe } from "./parse.ts";
import { buildPeAddressSpace, peRvaToFile, peFileToRva } from "./address.ts";
import { minimalPe64 } from "../test/fixtures.ts";

describe("PE parser", () => {
  it("parses minimal PE32+", () => {
    const pe = parsePe(minimalPe64());
    expect(pe.coff.machine).toBe(0x8664);
    expect(pe.sections.length).toBe(1);
    expect(pe.sections[0]!.name).toContain("text");
  });

  it("converts RVA to file offset", () => {
    const pe = parsePe(minimalPe64());
    const space = buildPeAddressSpace(pe.imageBase, pe.sections, pe.sizeOfHeaders, pe.issues);
    const res = peRvaToFile(space, 0x1000);
    expect(res.status).toBe("mapped");
    expect(res.fileOffset).toBe(0x200);
  });

  it("rejects empty buffer", () => {
    expect(() => parsePe(new Uint8Array(0))).toThrow();
  });
});

describe("PE address edge cases", () => {
  it("detects uninitialized section tail", () => {
    const pe = parsePe(minimalPe64());
    pe.sections[0]!.virtualSize = 0x400;
    pe.sections[0]!.sizeOfRawData = 0x200;
    const space = buildPeAddressSpace(pe.imageBase, pe.sections, pe.sizeOfHeaders, []);
    const res = peRvaToFile(space, 0x1000 + 0x300);
    expect(res.status).toBe("uninitialized");
  });

  it("header RVA maps to file", () => {
    const pe = parsePe(minimalPe64());
    const space = buildPeAddressSpace(pe.imageBase, pe.sections, pe.sizeOfHeaders, []);
    expect(peRvaToFile(space, 0x80).status).toBe("header");
  });
});
