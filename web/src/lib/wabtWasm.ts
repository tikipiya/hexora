type WabtModule = Awaited<ReturnType<typeof import("wabt")["default"]>>;

let wabtPromise: Promise<WabtModule> | null = null;

async function loadWabt() {
  if (!wabtPromise) {
    wabtPromise = import("wabt").then((m) => m.default());
  }
  return wabtPromise;
}

export async function wasmToWat(
  bytes: Uint8Array,
  options?: { foldExprs?: boolean },
): Promise<string> {
  const wabt = await loadWabt();
  const mod = wabt.readWasm(bytes, {
    check: false,
    readDebugNames: true,
  });
  try {
    mod.resolveNames();
    mod.generateNames();
    mod.applyNames();
    return mod.toText({ foldExprs: options?.foldExprs ?? true, inlineExport: true });
  } finally {
    mod.destroy();
  }
}
