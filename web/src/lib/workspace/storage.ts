import type { LoadedFile } from "../fileLoad";
import type { FileSession, FileUiState } from "./types.ts";
import { createSessionFromBytes } from "./session.ts";

const DB_NAME = "hexora-workspace";
const DB_VERSION = 1;
const STORE = "files";

export interface StoredFileRecord {
  id: string;
  fileName: string;
  bytes: ArrayBuffer;
  hashes: LoadedFile["hashes"];
  warnedLarge: boolean;
  ui: FileUiState;
  savedAt: number;
  notes: string;
}

export interface WorkspaceManifest {
  version: 1;
  exportedAt: number;
  files: {
    id: string;
    fileName: string;
    sha256: string;
    size: number;
    ui: FileUiState;
    notes: string;
  }[];
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("IDB open failed"));
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
}

function idbRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IDB request failed"));
  });
}

export async function saveSessionToDb(session: FileSession): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  const record: StoredFileRecord = {
    id: session.id,
    fileName: session.fileName,
    bytes: session.buffer,
    hashes: session.hashes,
    warnedLarge: session.warnedLarge,
    ui: session.ui,
    savedAt: Date.now(),
    notes: session.ui.notes,
  };
  await idbRequest(tx.objectStore(STORE).put(record));
  db.close();
}

export async function listStoredSessions(): Promise<
  { id: string; fileName: string; savedAt: number; size: number; sha256: string }[]
> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const all = await idbRequest(tx.objectStore(STORE).getAll());
  db.close();
  return (all as StoredFileRecord[]).map((r) => ({
    id: r.id,
    fileName: r.fileName,
    savedAt: r.savedAt,
    size: r.bytes.byteLength,
    sha256: r.hashes.sha256,
  }));
}

export async function loadSessionFromDb(id: string): Promise<FileSession> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const rec = (await idbRequest(tx.objectStore(STORE).get(id))) as
    | StoredFileRecord
    | undefined;
  db.close();
  if (!rec) throw new Error("保存されたセッションが見つかりません");
  const bytes = new Uint8Array(rec.bytes);
  const session = await createSessionFromBytes(rec.fileName, bytes, rec.id);
  return {
    ...session,
    hashes: rec.hashes,
    warnedLarge: rec.warnedLarge,
    ui: rec.ui,
    dirty: false,
  };
}

export async function deleteSessionFromDb(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  await idbRequest(tx.objectStore(STORE).delete(id));
  db.close();
}

export function exportWorkspaceManifest(sessions: FileSession[]): WorkspaceManifest {
  return {
    version: 1,
    exportedAt: Date.now(),
    files: sessions.map((s) => ({
      id: s.id,
      fileName: s.fileName,
      sha256: s.hashes.sha256,
      size: s.data.length,
      ui: s.ui,
      notes: s.ui.notes,
    })),
  };
}

export interface FullExportFile {
  fileName: string;
  sha256: string;
  bytesBase64: string;
  ui: FileUiState;
  notes: string;
}

export function exportSessionsWithBytes(
  sessions: FileSession[],
  maxBytesPerFile = 4 * 1024 * 1024,
): { manifest: WorkspaceManifest; files: FullExportFile[] } {
  const manifest = exportWorkspaceManifest(sessions);
  const files: FullExportFile[] = [];
  for (const s of sessions) {
    if (s.data.length > maxBytesPerFile) continue;
    files.push({
      fileName: s.fileName,
      sha256: s.hashes.sha256,
      bytesBase64: uint8ToBase64(s.data),
      ui: s.ui,
      notes: s.ui.notes,
    });
  }
  return { manifest, files };
}

export async function importSessionsFromExport(
  payload: { manifest: WorkspaceManifest; files?: FullExportFile[] },
): Promise<FileSession[]> {
  const byHash = new Map(
    (payload.files ?? []).map((f) => [f.sha256, f] as const),
  );
  const out: FileSession[] = [];
  for (const meta of payload.manifest.files) {
    const embedded = byHash.get(meta.sha256);
    if (!embedded) continue;
    const bytes = base64ToUint8(embedded.bytesBase64);
    const session = await createSessionFromBytes(meta.fileName, bytes);
    out.push({
      ...session,
      ui: meta.ui,
      dirty: true,
    });
  }
  return out;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
