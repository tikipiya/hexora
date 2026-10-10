import { analyzeBinary } from "../binaryAnalysis";
import { hashFile } from "../hash";
import type { LoadedFile } from "../fileLoad";
import { FILE_SIZE_SOFT_WARN } from "../fileLoad";
import { defaultFileUi, type FileSession } from "./types.ts";

export function newSessionId(): string {
  return crypto.randomUUID();
}

export async function createSessionFromLoaded(
  loaded: LoadedFile,
  id = newSessionId(),
): Promise<FileSession> {
  const analysis = analyzeBinary(loaded.buffer, "lenient");
  return {
    id,
    fileName: loaded.file.name,
    data: loaded.bytes,
    buffer: loaded.buffer,
    analysis,
    hashes: loaded.hashes,
    warnedLarge: loaded.warnedLarge,
    ui: defaultFileUi(),
    dirty: true,
  };
}

export async function createSessionFromBytes(
  fileName: string,
  bytes: Uint8Array,
  id = newSessionId(),
): Promise<FileSession> {
  const copy = bytes.slice();
  const buffer = copy.buffer.slice(
    copy.byteOffset,
    copy.byteOffset + copy.byteLength,
  );
  const hashes = await hashFile(buffer);
  const analysis = analyzeBinary(buffer, "lenient");
  return {
    id,
    fileName,
    data: copy,
    buffer,
    analysis,
    hashes,
    warnedLarge: bytes.length >= FILE_SIZE_SOFT_WARN,
    ui: defaultFileUi(),
    dirty: true,
  };
}

export function patchSessionUi(
  session: FileSession,
  patch: Partial<FileSession["ui"]>,
): FileSession {
  return {
    ...session,
    dirty: true,
    ui: { ...session.ui, ...patch },
  };
}
