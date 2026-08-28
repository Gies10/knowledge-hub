import { useCallback, useEffect, useMemo, useState } from 'react';
import { deleteNoteById, getAllNotes, putNote } from '../lib/db';
import { buildLinkGraph } from '../lib/graph';
import { buildSearchIndex } from '../lib/search';
import { extractTags } from '../lib/tags';
import type { Note } from '../types';

function makeId(): string {
  return crypto.randomUUID();
}

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getAllNotes().then((raw) => {
      if (cancelled) return;
      // Notes saved before properties existed won't have the field.
      const loadedNotes = raw.map((n) => ({ ...n, properties: n.properties ?? {} }));
      setNotes(loadedNotes);
      setLoaded(true);
      if (loadedNotes.length > 0) {
        const mostRecent = [...loadedNotes].sort((a, b) => b.updatedAt - a.updatedAt)[0];
        setSelectedId(mostRecent.id);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const graph = useMemo(() => buildLinkGraph(notes), [notes]);
  const searchIndex = useMemo(() => buildSearchIndex(notes), [notes]);

  const tagsByNote = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const note of notes) map.set(note.id, extractTags(note.content));
    return map;
  }, [notes]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const tags of tagsByNote.values()) {
      for (const tag of tags) set.add(tag);
    }
    return Array.from(set).sort();
  }, [tagsByNote]);

  const createNote = useCallback(async (title: string, content = ''): Promise<Note> => {
    const now = Date.now();
    const note: Note = {
      id: makeId(),
      title: title.trim() || 'Untitled',
      content,
      properties: {},
      createdAt: now,
      updatedAt: now,
    };
    await putNote(note);
    setNotes((prev) => [...prev, note]);
    setSelectedId(note.id);
    return note;
  }, []);

  const updateNote = useCallback(
    (id: string, patch: Partial<Pick<Note, 'title' | 'content' | 'properties'>>) => {
      const current = notes.find((n) => n.id === id);
      if (!current) return;
      const updated: Note = { ...current, ...patch, updatedAt: Date.now() };
      void putNote(updated);
      setNotes((prev) => prev.map((n) => (n.id === id ? updated : n)));
    },
    [notes],
  );

  const removeNote = useCallback(
    async (id: string) => {
      await deleteNoteById(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      setSelectedId((current) => (current === id ? null : current));
    },
    [],
  );

  /** Adopt a note that came from a sync pull - upserts local storage + state directly. */
  const applyRemoteNote = useCallback(async (note: Note) => {
    await putNote(note);
    setNotes((prev) => {
      const idx = prev.findIndex((n) => n.id === note.id);
      if (idx === -1) return [...prev, note];
      const next = [...prev];
      next[idx] = note;
      return next;
    });
  }, []);

  const findOrCreateByTitle = useCallback(
    async (title: string): Promise<Note> => {
      const normalized = title.trim().toLowerCase();
      const existing = notes.find((n) => n.title.trim().toLowerCase() === normalized);
      if (existing) return existing;
      return createNote(title);
    },
    [notes, createNote],
  );

  return {
    notes,
    loaded,
    selectedId,
    setSelectedId,
    graph,
    searchIndex,
    tagsByNote,
    allTags,
    createNote,
    updateNote,
    removeNote,
    findOrCreateByTitle,
    applyRemoteNote,
  };
}
