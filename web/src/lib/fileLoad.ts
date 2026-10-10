export class FileLoadError extends Error {
  constructor(
    readonly code: "empty" | "too_large" | "read_failed" | "aborted",
    message: string,
  ) {
    super(message);
    this.name = "FileLoadError";
  }
}

/** 警告を出すサイズ（この超は読み込み可） */
export const FILE_SIZE_SOFT_WARN = 32 * 1024 * 1024;
/** 読み込み拒否する上限 */
export const FILE_SIZE_HARD_MAX = 256 * 1024 * 1024;

export interface LoadProgress {
  loaded: number;
  total: number;
  phase: "read" | "ready";
  percent: number;
}

export interface LoadedFile {
  file: File;
  buffer: ArrayBuffer;
  bytes: Uint8Array;
  warnedLarge: boolean;
}

export function validateFile(file: File): { ok: true } | { ok: false; error: FileLoadError } {
  if (file.size === 0) {
    return {
      ok: false,
      error: new FileLoadError("empty", "ファイルが空です。"),
    };
  }
  if (file.size > FILE_SIZE_HARD_MAX) {
    return {
      ok: false,
      error: new FileLoadError(
        "too_large",
        `ファイルが大きすぎます（上限 ${formatLimit(FILE_SIZE_HARD_MAX)}）。`,
      ),
    };
  }
  return { ok: true };
}

export async function loadFile(
  file: File,
  onProgress?: (p: LoadProgress) => void,
  signal?: AbortSignal,
): Promise<LoadedFile> {
  const check = validateFile(file);
  if (!check.ok) throw check.error;

  const warnedLarge = file.size >= FILE_SIZE_SOFT_WARN;
  const total = file.size;

  if (file.size <= 2 * 1024 * 1024) {
    onProgress?.({
      loaded: 0,
      total,
      phase: "read",
      percent: 0,
    });
    if (signal?.aborted) throw new FileLoadError("aborted", "読み込みを中止しました。");
    const buffer = await file.arrayBuffer();
    onProgress?.({
      loaded: total,
      total,
      phase: "ready",
      percent: 100,
    });
    return {
      file,
      buffer,
      bytes: new Uint8Array(buffer),
      warnedLarge,
    };
  }

  const reader = file.stream().getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  try {
    while (true) {
      if (signal?.aborted) {
        await reader.cancel();
        throw new FileLoadError("aborted", "読み込みを中止しました。");
      }
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.byteLength;
      onProgress?.({
        loaded,
        total,
        phase: "read",
        percent: total ? Math.min(99, Math.round((loaded / total) * 100)) : 0,
      });
    }
  } catch (e) {
    if (e instanceof FileLoadError) throw e;
    throw new FileLoadError("read_failed", "ファイルの読み込みに失敗しました。");
  }

  const bytes = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  onProgress?.({
    loaded: total,
    total,
    phase: "ready",
    percent: 100,
  });

  return {
    file,
    buffer: bytes.buffer,
    bytes,
    warnedLarge,
  };
}

function formatLimit(n: number): string {
  if (n >= 1024 * 1024) return `${n / (1024 * 1024)} MiB`;
  return `${n / 1024} KiB`;
}
