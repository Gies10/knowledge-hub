import { useCallback, useEffect, useRef, useState } from 'react';
import {
  deleteSyncState,
  getAllSyncState,
  putSyncState,
  type SyncStateEntry,
} from '../lib/db';
import { parseNoteFile, serializeNote } from '../lib/frontmatter';
import {
  deleteFile,
  getFile,
  GitHubApiError,
  listNoteFiles,
  notePath,
  putFile,
  validateAccess,
  type GitHubConfig,
} from '../lib/github';
import type { Note } from '../types';

const CONFIG_STORAGE_KEY = 'khub.github.config';
const PUSH_DEBOUNCE_MS = 2500;

export type SyncStatus = 'disconnected' | 'connecting' | 'idle' | 'syncing' | 'error';

function loadStoredConfig(): GitHubConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.owner === 'string' && typeof parsed.repo === 'string' && typeof parsed.token === 'string') {
      return parsed as GitHubConfig;
    }
  } catch {
    // ignore malformed storage
  }
  return null;
}

async function pushOne(
  cfg: GitHubConfig,
  note: Note,
  raw: string,
  state: SyncStateEntry | undefined,
  applyRemote: (note: Note) => Promise<void>,
) {
  try {
    const result = await putFile(cfg, notePath(note.id), raw, `Update ${note.title}`, state?.sha);
    await putSyncState({ noteId: note.id, sha: result.sha, syncedUpdatedAt: note.updatedAt });
  } catch (err) {
    if (err instanceof GitHubApiError && err.status === 409) {
      const remote = await getFile(cfg, notePath(note.id));
      if (!remote) return;
      const parsed = parseNoteFile(remote.content, note.id, note.title);
      if (parsed.updatedAt > note.updatedAt) {
        await applyRemote({
          ...note,
          title: parsed.title,
          content: parsed.content,
          properties: parsed.properties,
          updatedAt: parsed.updatedAt,
        });
        await putSyncState({ noteId: note.id, sha: remote.sha, syncedUpdatedAt: parsed.updatedAt });
      } else {
        const retry = await putFile(cfg, notePath(note.id), raw, `Update ${note.title}`, remote.sha);
        await putSyncState({ noteId: note.id, sha: retry.sha, syncedUpdatedAt: note.updatedAt });
      }
    } else {
      throw err;
    }
  }
}

interface UseSyncOptions {
  notes: Note[];
  applyRemoteNote: (note: Note) => Promise<void>;
  removeNoteLocally: (id: string) => Promise<void>;
}

export function useSync({ notes, applyRemoteNote, removeNoteLocally }: UseSyncOptions) {
  const [config, setConfig] = useState<GitHubConfig | null>(() => loadStoredConfig());
  const [status, setStatus] = useState<SyncStatus>(config ? 'connecting' : 'disconnected');
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  // Latest notes/config, readable from async code without re-subscribing effects.
  const notesRef = useRef(notes);
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);
  const configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const runningRef = useRef(false);
  const queuedRef = useRef(false);

  const runSync = useCallback(async () => {
    const cfg = configRef.current;
    if (!cfg) return;

    if (runningRef.current) {
      queuedRef.current = true;
      return;
    }
    runningRef.current = true;
    setStatus('syncing');
    setError(null);

    try {
      // --- Pull: fetch anything changed remotely, and reconcile deletions ---
      const remoteFiles = await listNoteFiles(cfg);
      const remoteIds = new Set(remoteFiles.map((f) => f.name.replace(/\.md$/, '')));
      const syncStateList = await getAllSyncState();
      const syncStateById = new Map(syncStateList.map((s) => [s.noteId, s] as const));
      const localById = new Map(notesRef.current.map((n) => [n.id, n] as const));

      for (const file of remoteFiles) {
        const id = file.name.replace(/\.md$/, '');
        const known = syncStateById.get(id);
        if (known && known.sha === file.sha) continue; // unchanged since last sync

        const remote = await getFile(cfg, file.path);
        if (!remote) continue;
        const parsed = parseNoteFile(remote.content, id, 'Untitled');
        const local = localById.get(id);

        if (!local || parsed.updatedAt > local.updatedAt) {
          await applyRemoteNote({
            id,
            title: parsed.title,
            content: parsed.content,
            properties: parsed.properties,
            createdAt: local?.createdAt ?? parsed.createdAt,
            updatedAt: parsed.updatedAt,
          });
          await putSyncState({ noteId: id, sha: remote.sha, syncedUpdatedAt: parsed.updatedAt });
        } else {
          // Local is newer/equal - it'll be pushed below. Just record the sha
          // we now know about so the push uses the right base.
          await putSyncState({ noteId: id, sha: remote.sha, syncedUpdatedAt: known?.syncedUpdatedAt ?? 0 });
        }
      }

      // Reconcile deletions in both directions.
      for (const state of syncStateList) {
        const localExists = localById.has(state.noteId);
        const remoteExists = remoteIds.has(state.noteId);
        if (localExists && !remoteExists) {
          await removeNoteLocally(state.noteId);
          await deleteSyncState(state.noteId);
        } else if (!localExists && remoteExists) {
          // Deleted locally but the remote delete never landed - retry now.
          try {
            await deleteFile(cfg, notePath(state.noteId), state.sha, 'Delete note');
          } catch {
            // will retry again on the next sync
          }
          await deleteSyncState(state.noteId);
        } else if (!localExists && !remoteExists) {
          await deleteSyncState(state.noteId);
        }
      }

      // --- Push: anything local that's newer than what we last synced ---
      const freshSyncState = new Map((await getAllSyncState()).map((s) => [s.noteId, s] as const));
      for (const note of notesRef.current) {
        const state = freshSyncState.get(note.id);
        if (state && state.syncedUpdatedAt >= note.updatedAt) continue;

        const raw = serializeNote(note);
        await pushOne(cfg, note, raw, state, applyRemoteNote);
      }

      setLastSyncedAt(Date.now());
      setStatus('idle');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      runningRef.current = false;
      if (queuedRef.current) {
        queuedRef.current = false;
        void runSync();
      }
    }
  }, [applyRemoteNote, removeNoteLocally]);

  // Debounced push whenever notes change locally.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!config) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void runSync(), PUSH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, config]);

  // Pull whenever the app comes back into the foreground.
  useEffect(() => {
    if (!config) return;
    function handleVisibility() {
      if (document.visibilityState === 'visible') void runSync();
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [config, runSync]);

  // Initial connect/sync on mount if a config was already stored.
  useEffect(() => {
    if (config) void runSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = useCallback(
    async (newConfig: GitHubConfig) => {
      setStatus('connecting');
      setError(null);
      await validateAccess(newConfig);
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(newConfig));
      setConfig(newConfig);
      configRef.current = newConfig;
      await runSync();
    },
    [runSync],
  );

  const disconnect = useCallback(() => {
    localStorage.removeItem(CONFIG_STORAGE_KEY);
    setConfig(null);
    configRef.current = null;
    setStatus('disconnected');
    setError(null);
  }, []);

  const notifyNoteDeleted = useCallback(async (id: string) => {
    const cfg = configRef.current;
    if (!cfg) return;
    const state = (await getAllSyncState()).find((s) => s.noteId === id);
    if (!state) return;
    try {
      await deleteFile(cfg, notePath(id), state.sha, 'Delete note');
    } catch {
      // syncState is left in place; next sync's reconciliation will retry.
      return;
    }
    await deleteSyncState(id);
  }, []);

  return {
    connected: config !== null,
    owner: config?.owner ?? null,
    repo: config?.repo ?? null,
    status,
    error,
    lastSyncedAt,
    connect,
    disconnect,
    syncNow: runSync,
    notifyNoteDeleted,
  };
}
