import {
  analyzeRepeatingXor,
  analyzeSingleByteXor,
  carveFiles,
  scanCompression,
  scanEncodings,
} from "@hexora/shared";

export type TransformWorkerRequest = {
  id: number;
  buffer: ArrayBuffer;
  options?: {
    xor?: boolean;
    encoding?: boolean;
    compression?: boolean;
    carving?: boolean;
  };
};

export type TransformWorkerResponse =
  | { id: number; type: "progress"; phase: string; scanned: number; total: number }
  | {
      id: number;
      type: "done";
      singleXor: ReturnType<typeof analyzeSingleByteXor>;
      repeatXor: ReturnType<typeof analyzeRepeatingXor>;
      encodings: ReturnType<typeof scanEncodings>;
      compression: ReturnType<typeof scanCompression>;
      carved: ReturnType<typeof carveFiles>;
    }
  | { id: number; type: "error"; message: string };

self.onmessage = (ev: MessageEvent<TransformWorkerRequest>) => {
  const { id, buffer, options } = ev.data;
  const data = new Uint8Array(buffer);
  const opt = {
    xor: true,
    encoding: true,
    compression: true,
    carving: true,
    ...options,
  };

  try {
    const post = (phase: string, scanned: number, total: number) => {
      const msg: TransformWorkerResponse = {
        id,
        type: "progress",
        phase,
        scanned,
        total,
      };
      self.postMessage(msg);
    };

    post("xor", 0, data.length);
    const singleXor = opt.xor ? analyzeSingleByteXor(data) : [];
    const repeatXor = opt.xor ? analyzeRepeatingXor(data) : [];

    post("encoding", data.length >> 2, data.length);
    const encodings = opt.encoding ? scanEncodings(data) : [];

    post("compression", data.length >> 1, data.length);
    const compression = opt.compression ? scanCompression(data) : [];

    post("carving", 0, data.length);
    const carved = opt.carving
      ? carveFiles(data, 500, (s, t) => post("carving", s, t))
      : [];

    const done: TransformWorkerResponse = {
      id,
      type: "done",
      singleXor,
      repeatXor,
      encodings,
      compression,
      carved,
    };
    self.postMessage(done);
  } catch (e) {
    self.postMessage({
      id,
      type: "error",
      message: e instanceof Error ? e.message : "Transform scan failed",
    });
  }
};
