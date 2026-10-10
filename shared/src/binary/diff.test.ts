import { describe, expect, it } from "vitest";
import { compareBinary } from "./diff.ts";

describe("compareBinary", () => {
  it("finds a single-byte diff region", () => {
    const a = new Uint8Array([1, 2, 3]);
    const b = new Uint8Array([1, 9, 3]);
    const s = compareBinary(a, b);
    expect(s.sameBytes).toBe(2);
    expect(s.diffRegions).toHaveLength(1);
    expect(s.diffRegions[0]!.start).toBe(1);
  });
});
