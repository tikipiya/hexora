import type {
  StringExtractOptions,
  StringExtractResult,
  ExtractedString,
} from "./strings";
import type {
  StringsWorkerRequest,
  StringsWorkerResponse,
} from "../workers/strings.worker";

let worker: Worker | null = null;
let nextId = 1;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(
      new URL("../workers/strings.worker.ts", import.meta.url),
      { type: "module" },
    );
  }
  return worker;
}

export function scanStringsInWorker(
  buffer: ArrayBuffer,
  options: StringExtractOptions,
  onProgress?: (p: {
    scanned: number;
    total: number;
    strings: ExtractedString[];
  }) => void,
): Promise<StringExtractResult> {
  const id = nextId++;
  const w = getWorker();

  return new Promise((resolve, reject) => {
    const handler = (ev: MessageEvent<StringsWorkerResponse>) => {
      const msg = ev.data;
      if (msg.id !== id) return;
      if (msg.type === "progress") {
        onProgress?.({
          scanned: msg.scanned,
          total: msg.total,
          strings: msg.strings,
        });
      } else if (msg.type === "done") {
        w.removeEventListener("message", handler);
        resolve(msg.result);
      } else if (msg.type === "error") {
        w.removeEventListener("message", handler);
        reject(new Error(msg.message));
      }
    };
    w.addEventListener("message", handler);
    const req: StringsWorkerRequest = { id, buffer, options };
    w.postMessage(req);
  });
}

export function terminateStringsWorker(): void {
  worker?.terminate();
  worker = null;
}
