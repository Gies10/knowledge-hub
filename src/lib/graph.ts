import type { Note } from '../types';
import { extractLinks, normalizeTitle } from './wikilinks';

export interface LinkGraph {
  /** noteId -> ids of notes it links to */
  outgoing: Map<string, string[]>;
  /** noteId -> ids of notes that link to it (backlinks) */
  incoming: Map<string, string[]>;
  /** noteId -> link targets typed in its content that don't match any note yet */
  unresolved: Map<string, string[]>;
}

export function buildLinkGraph(notes: Note[]): LinkGraph {
  const idByTitle = new Map<string, string>();
  for (const note of notes) {
    idByTitle.set(normalizeTitle(note.title), note.id);
  }

  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  const unresolved = new Map<string, string[]>();

  for (const note of notes) {
    incoming.set(note.id, []);
  }

  for (const note of notes) {
    const out: string[] = [];
    const missing: string[] = [];
    const seenTargets = new Set<string>();

    for (const link of extractLinks(note.content)) {
      const targetId = idByTitle.get(normalizeTitle(link.target));
      if (!targetId) {
        missing.push(link.target);
        continue;
      }
      if (targetId === note.id || seenTargets.has(targetId)) continue;
      seenTargets.add(targetId);
      out.push(targetId);
      incoming.get(targetId)?.push(note.id);
    }

    outgoing.set(note.id, out);
    if (missing.length > 0) unresolved.set(note.id, missing);
  }

  return { outgoing, incoming, unresolved };
}
