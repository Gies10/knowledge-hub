import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Note } from '../types';

interface HubDB extends DBSchema {
  notes: {
    key: string;
    value: Note;
    indexes: { 'by-updatedAt': number };
  };
}

const DB_NAME = 'knowledge-hub';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<HubDB>> | null = null;

function getDB(): Promise<IDBPDatabase<HubDB>> {
  if (!dbPromise) {
    dbPromise = openDB<HubDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore('notes', { keyPath: 'id' });
        store.createIndex('by-updatedAt', 'updatedAt');
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
