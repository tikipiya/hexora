/// <reference types="vite/client" />

declare module "compressjs" {
  const compressjs: {
    Bzip2: {
      decompressFile(data: Uint8Array): number[];
    };
  };
  export default compressjs;
}

declare module "@kreijstal/capstone-wasm/capstone.mjs" {
  export default function createCapstone(
    moduleArg?: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
}
