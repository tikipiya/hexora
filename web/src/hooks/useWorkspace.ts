import { useCallback, useState } from "react";
import type { LoadedFile } from "../lib/fileLoad";
import {
  createSessionFromBytes,
  createSessionFromLoaded,
  newSessionId,
  patchSessionUi,
} from "../lib/workspace/session";
import type { FileSession, FileUiState } from "../lib/workspace/types";
import {
  deleteSessionFromDb,
  loadSessionFromDb,
  listStoredSessions,
  saveSessionToDb,
} from "../lib/workspace/storage";

export function useWorkspace() {
  const [sessions, setSessions] = useState<FileSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [storageBusy, setStorageBusy] = useState(false);

  const active =
    sessions.find((s) => s.id === activeId) ?? sessions[0] ?? null;

  const upsertSession = useCallback((session: FileSession) => {
    setSessions((prev) => {
      const i = prev.findIndex((s) => s.id === session.id);
      if (i < 0) return [...prev, session];
      const next = [...prev];
      next[i] = session;
      return next;
    });
  }, []);

  const openLoaded = useCallback(
    async (loaded: LoadedFile, uiPatch?: Partial<FileUiState>, activate = true) => {
      let session = await createSessionFromLoaded(loaded);
      if (uiPatch) session = patchSessionUi(session, uiPatch);
      setSessions((prev) => [...prev, session]);
      if (activate) setActiveId(session.id);
      return session;
    },
    [],
  );

  const openBytes = useCallback(
    async (fileName: string, bytes: Uint8Array, activate = true) => {
      const session = await createSessionFromBytes(fileName, bytes);
      setSessions((prev) => [...prev, session]);
      if (activate) setActiveId(session.id);
      return session;
    },
    [],
  );

  const closeSession = useCallback(
    (id: string) => {
      setSessions((prev) => {
        const next = prev.filter((s) => s.id !== id);
        setActiveId((cur) => {
          if (cur !== id) return cur;
          return next[0]?.id ?? null;
        });
        return next;
      });
    },
    [],
  );

  const updateActiveUi = useCallback(
    (patch: Partial<FileUiState>) => {
      setSessions((prev) => {
        const id = activeId ?? prev[0]?.id;
        if (!id) return prev;
        const s = prev.find((x) => x.id === id);
        if (!s) return prev;
        const next = patchSessionUi(s, patch);
        return prev.map((x) => (x.id === id ? next : x));
      });
    },
    [activeId],
  );

  const updateSessionUi = useCallback(
    (id: string, patch: Partial<FileUiState>) => {
      const s = sessions.find((x) => x.id === id);
      if (!s) return;
      upsertSession(patchSessionUi(s, patch));
    },
    [sessions, upsertSession],
  );

  const replaceActiveSession = useCallback(
    (session: FileSession) => {
      upsertSession(session);
      setActiveId(session.id);
    },
    [upsertSession],
  );

  const saveActive = useCallback(async () => {
    if (!active) return;
    setStorageBusy(true);
    try {
      await saveSessionToDb(active);
      upsertSession({ ...active, dirty: false });
    } finally {
      setStorageBusy(false);
    }
  }, [active, upsertSession]);

  const saveAll = useCallback(async () => {
    setStorageBusy(true);
    try {
      for (const s of sessions) {
        await saveSessionToDb(s);
      }
      setSessions((prev) => prev.map((s) => ({ ...s, dirty: false })));
    } finally {
      setStorageBusy(false);
    }
  }, [sessions]);

  const restoreFromDb = useCallback(async (id: string) => {
    setStorageBusy(true);
    try {
      const session = await loadSessionFromDb(id);
      setSessions((prev) => {
        const i = prev.findIndex((s) => s.id === id);
        if (i >= 0) {
          const next = [...prev];
          next[i] = session;
          return next;
        }
        return [...prev, session];
      });
      setActiveId(session.id);
    } finally {
      setStorageBusy(false);
    }
  }, []);

  const removeFromDb = useCallback(async (id: string) => {
    setStorageBusy(true);
    try {
      await deleteSessionFromDb(id);
    } finally {
      setStorageBusy(false);
    }
  }, []);

  const listDb = useCallback(() => listStoredSessions(), []);

  const importSessions = useCallback((imported: FileSession[]) => {
    setSessions((prev) => {
      const ids = new Set(prev.map((s) => s.id));
      const merged = [...prev];
      for (const s of imported) {
        if (!ids.has(s.id)) merged.push(s);
      }
      return merged;
    });
    if (imported[0]) setActiveId(imported[0].id);
  }, []);

  const clearAll = useCallback(() => {
    setSessions([]);
    setActiveId(null);
  }, []);

  return {
    sessions,
    active,
    activeId: active?.id ?? null,
    setActiveId,
    openLoaded,
    openBytes,
    closeSession,
    updateActiveUi,
    updateSessionUi,
    replaceActiveSession,
    saveActive,
    saveAll,
    restoreFromDb,
    removeFromDb,
    listDb,
    importSessions,
    clearAll,
    storageBusy,
    newSessionId,
  };
}
