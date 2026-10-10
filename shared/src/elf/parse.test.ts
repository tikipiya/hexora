import { describe, expect, it } from "vitest";
import { parseElf } from "./parse.ts";
import { buildElfAddressSpace, elfVaToFile, elfFileToVa } from "./address.ts";
import { minimalElf64 } from "../test/fixtures.ts";

describe("ELF parser", () => {
  it("parses minimal ELF64", () => {
    const elf = parseElf(minimalElf64());
    expect(elf.header.class).toBe(64);
    expect(elf.programHeaders.some((p) => p.type === 1)).toBe(true);
    expect(elf.sectionHeaders.length).toBeGreaterThan(0);
  });

  it("maps VA to file via PT_LOAD", () => {
    const elf = parseElf(minimalElf64());
    const space = buildElfAddressSpace(elf.programHeaders, elf.sectionHeaders, elf.issues);
    const res = elfVaToFile(space, BigInt(0x400000));
    expect(res.status).toBe("mapped");
    expect(res.fileOffset).toBe(0x100);
  });

  it("detects BSS when memsz > filesz", () => {
    const elf = parseElf(minimalElf64());
    const ph = elf.programHeaders.find((p) => p.type === 1)!;
    ph.memsz = BigInt(0x300);
    ph.filesz = BigInt(0x100);
    const space = buildElfAddressSpace(elf.programHeaders, elf.sectionHeaders, elf.issues);
    const res = elfVaToFile(space, BigInt(0x400000 + 0x180));
    expect(res.status).toBe("bss");
  });
});

describe("ELF malformed", () => {
  it("throws on bad magic", () => {
    expect(() => parseElf(new Uint8Array([0, 1, 2]))).toThrow();
  });
});
