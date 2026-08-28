import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Note } from '../types';

export interface SyncStateEntry {
  noteId: string;
  /** SHA of the file's contents last time we synced it, for conflict detection. */
  sha: string;
  /** note.updatedAt at the moment it was last successfully synced. */
  syncedUpdatedAt: number;
}

interface HubDB extends DBSchema {
  notes: {
    key: string;
    value: Note;
    indexes: { 'by-updatedAt': number };
  };
  syncState: {
    key: string;
    value: SyncStateEntry;
  };
}

const DB_NAME = 'knowledge-hub';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<HubDB>> | null = null;

function getDB(): Promise<IDBPDatabase<HubDB>> {
  if (!dbPromise) {
    dbPromise = openDB<HubDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('notes')) {
          const store = db.createObjectStore('notes', { keyPath: 'id' });
          store.createIndex('by-updatedAt', 'updatedAt');
        }
        if (!db.objectStoreNames.contains('syncState')) {
          db.createObjectStore('syncState', { keyPath: 'noteId' });
        }
      },
    });
  }
  return dbPromise;
}

export async function getAllNotes(): Promise<Note[]> {
  const db = await getDB();
  return db.getAll('notes');
}

export async function putNote(note: Note): Promise<void> {
  const db = await getDB();
  await db.put('notes', note);
}

export async function deleteNoteById(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('notes', id);
}

export async function getAllSyncState(): Promise<SyncStateEntry[]> {
  const db = await getDB();
  return db.getAll('syncState');
}

export async function putSyncState(entry: SyncStateEntry): Promise<void> {
  const db = await getDB();
  await db.put('syncState', entry);
}

export async function deleteSyncState(noteId: string): Promise<void> {
  const db = await getDB();
  await db.delete('syncState', noteId);
}
