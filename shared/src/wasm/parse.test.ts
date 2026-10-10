import { describe, expect, it } from "vitest";
import { parseWasm } from "./parse.ts";

const ADD_WASM = Uint8Array.from(
  "0061736d010000000105016000017f030201000707010361646400000a09010700412a410a6a0b".match(
    /../g,
  )!.map((h) => Number.parseInt(h, 16)),
);

describe("parseWasm", () => {
  it("parses minimal module with export and code", () => {
    const w = parseWasm(ADD_WASM);
    expect(w.version).toBe(1);
    expect(w.exports.map((e) => e.name)).toEqual(["add"]);
    expect(w.codeBodies.length).toBe(1);
    expect(w.codeBodies[0]!.moduleFunctionIndex).toBe(0);
    expect(w.codeBodies[0]!.size).toBeGreaterThan(0);
  });
});
