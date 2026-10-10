import { describe, expect, it } from "vitest";
import { carveFiles } from "./carving.ts";

describe("carveFiles", () => {
  it("detects PNG signature and IEND length", () => {
    const sig = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00,
    ]);
    const iend = new Uint8Array([
      0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);
    const data = new Uint8Array(sig.length + iend.length);
    data.set(sig, 0);
    data.set(iend, sig.length);
    const carved = carveFiles(data, 50);
    const png = carved.find((c) => c.id === "png");
    expect(png).toBeDefined();
    expect(png!.length).toBe(data.length);
  });

  it("finds MZ at offset", () => {
    const data = new Uint8Array(64);
    data[10] = 0x4d;
    data[11] = 0x5a;
    const carved = carveFiles(data, 50);
    expect(carved.some((c) => c.id === "pe")).toBe(true);
  });
});
