import MiniSearch from 'minisearch';
import type { Note } from '../types';

export function buildSearchIndex(notes: Note[]): MiniSearch<Note> {
  const index = new MiniSearch<Note>({
    idField: 'id',
    fields: ['title', 'content'],
    storeFields: ['title'],
    searchOptions: {
      prefix: true,
      fuzzy: 0.2,
      boost: { title: 2 },
    },
  });
  index.addAll(notes);
  return index;
}
