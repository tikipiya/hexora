import {
  extractStrings,
  type StringExtractOptions,
  type StringExtractResult,
} from "../lib/strings";

export type StringsWorkerRequest = {
  id: number;
  buffer: ArrayBuffer;
  options: StringExtractOptions;
};

export type StringsWorkerResponse =
  | {
      id: number;
      type: "progress";
      scanned: number;
      total: number;
      strings: import("../lib/strings").ExtractedString[];
    }
  | { id: number; type: "done"; result: StringExtractResult }
  | { id: number; type: "error"; message: string };

self.onmessage = (ev: MessageEvent<StringsWorkerRequest>) => {
  const { id, buffer, options } = ev.data;
  try {
    const data = new Uint8Array(buffer);
    const result = extractStrings(data, options, (p) => {
      const msg: StringsWorkerResponse = {
        id,
        type: "progress",
        scanned: p.scanned,
        total: p.total,
        strings: p.strings,
      };
      self.postMessage(msg);
    });
    const done: StringsWorkerResponse = { id, type: "done", result };
    self.postMessage(done);
  } catch (e) {
    const msg: StringsWorkerResponse = {
      id,
      type: "error",
      message: e instanceof Error ? e.message : "String scan failed",
    };
    self.postMessage(msg);
  }
};
