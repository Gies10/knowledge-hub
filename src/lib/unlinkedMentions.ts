import { extractLinks } from './wikilinks';
import type { Note } from '../types';

export interface UnlinkedMentionGroup {
  noteId: string;
  count: number;
  snippet: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Character ranges already covered by an existing [[wikilink]]. */
function linkedRanges(content: string): Array<[number, number]> {
  return extractLinks(content).map((link) => [link.index, link.index + link.raw.length] as [number, number]);
}

function overlapsAny(index: number, length: number, ranges: Array<[number, number]>): boolean {
  return ranges.some(([start, end]) => index < end && index + length > start);
}

/** Start indices of plain-text, not-yet-linked occurrences of `title` inside `content`. */
export function findUnlinkedOccurrences(content: string, title: string): number[] {
  const trimmed = title.trim();
  if (!trimmed) return [];
  const ranges = linkedRanges(content);
  const re = new RegExp(`\\b${escapeRegExp(trimmed)}\\b`, 'gi');
  const hits: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    if (!overlapsAny(m.index, m[0].length, ranges)) hits.push(m.index);
  }
  return hits;
}

function snippetAround(content: string, index: number, length: number, radius = 30): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(content.length, index + length + radius);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < content.length ? '…' : '';
  return `${prefix}${content.slice(start, end).replace(/\s+/g, ' ').trim()}${suffix}`;
}

/** For `target`, find every other note that mentions its title without linking to it. */
export function findUnlinkedMentions(target: Note, notes: Note[]): UnlinkedMentionGroup[] {
  const groups: UnlinkedMentionGroup[] = [];
  for (const note of notes) {
    if (note.id === target.id) continue;
    const hits = findUnlinkedOccurrences(note.content, target.title);
    if (hits.length === 0) continue;
    groups.push({
      noteId: note.id,
      count: hits.length,
      snippet: snippetAround(note.content, hits[0], target.title.trim().length),
    });
  }
  return groups;
}

/** Rewrite every unlinked occurrence of `title` in `content` into a [[wikilink]]. */
export function linkAllOccurrences(content: string, title: string): string {
  const trimmed = title.trim();
  const hits = findUnlinkedOccurrences(content, title);
  if (hits.length === 0) return content;
  let result = content;
  for (let i = hits.length - 1; i >= 0; i--) {
    const index = hits[i];
    result = `${result.slice(0, index)}[[${trimmed}]]${result.slice(index + trimmed.length)}`;
  }
  return result;
}
