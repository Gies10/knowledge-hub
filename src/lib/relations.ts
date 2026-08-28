import { normalizeTitle } from './wikilinks';
import type { Note, PropertyType } from '../types';

export interface TypedBacklink {
  sourceId: string;
  property: string;
}

/** Reverse index: noteId -> every {sourceId, property} whose relation property points at it. */
export function buildRelationBacklinks(notes: Note[]): Map<string, TypedBacklink[]> {
  const idByTitle = new Map<string, string>();
  for (const note of notes) idByTitle.set(normalizeTitle(note.title), note.id);

  const backlinks = new Map<string, TypedBacklink[]>();
  for (const note of notes) backlinks.set(note.id, []);

  for (const note of notes) {
    for (const [propName, propValue] of Object.entries(note.properties)) {
      if (propValue.type !== 'relation') continue;
      for (const targetTitle of propValue.value) {
        const targetId = idByTitle.get(normalizeTitle(targetTitle));
        if (!targetId || targetId === note.id) continue;
        backlinks.get(targetId)?.push({ sourceId: note.id, property: propName });
      }
    }
  }
  return backlinks;
}

/** Every property name used anywhere in the vault, mapped to its (first-seen) type. */
export function getAllPropertyNames(notes: Note[]): Map<string, PropertyType> {
  const map = new Map<string, PropertyType>();
  for (const note of notes) {
    for (const [name, value] of Object.entries(note.properties)) {
      if (!map.has(name)) map.set(name, value.type);
    }
  }
  return map;
}

export const HIERARCHY_PROPERTY = 'parent';

export function getParentTitles(note: Note, propertyName: string = HIERARCHY_PROPERTY): string[] {
  const prop = note.properties[propertyName];
  if (!prop || prop.type !== 'relation') return [];
  return prop.value;
}

/** noteId -> ids of notes whose `propertyName` relation names it (e.g. children via "parent"). */
export function buildChildrenIndex(
  notes: Note[],
  propertyName: string = HIERARCHY_PROPERTY,
): Map<string, string[]> {
  const idByTitle = new Map<string, string>();
  for (const note of notes) idByTitle.set(normalizeTitle(note.title), note.id);

  const children = new Map<string, string[]>();
  for (const note of notes) children.set(note.id, []);

  for (const note of notes) {
    for (const parentTitle of getParentTitles(note, propertyName)) {
      const parentId = idByTitle.get(normalizeTitle(parentTitle));
      if (!parentId || parentId === note.id) continue;
      children.get(parentId)?.push(note.id);
    }
  }
  return children;
}

/**
 * Root-level notes for the hierarchy tree: notes with no parent set, *and*
 * notes whose parent title doesn't resolve to an existing note (otherwise a
 * typo'd or since-deleted parent would make a note vanish from the tree
 * entirely instead of just floating to the top).
 */
export function getRootNoteIds(notes: Note[], propertyName: string = HIERARCHY_PROPERTY): string[] {
  const idByTitle = new Map<string, string>();
  for (const note of notes) idByTitle.set(normalizeTitle(note.title), note.id);

  return notes
    .filter((n) => {
      const parents = getParentTitles(n, propertyName);
      if (parents.length === 0) return true;
      return !parents.some((title) => idByTitle.has(normalizeTitle(title)));
    })
    .map((n) => n.id);
}
