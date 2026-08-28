import { dump, load } from 'js-yaml';
import type { Note, PropertyValue } from '../types';

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const WIKILINK_VALUE_RE = /^\[\[(.+)\]\]$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const RESERVED_KEYS = new Set(['id', 'title', 'createdAt', 'updatedAt']);

function flattenProperty(value: PropertyValue): unknown {
  switch (value.type) {
    case 'relation':
      return value.value.map((title) => `[[${title}]]`);
    case 'text':
    case 'number':
    case 'checkbox':
    case 'date':
      return value.value;
  }
}

function inferProperty(value: unknown): PropertyValue | null {
  if (Array.isArray(value)) {
    if (value.length > 0 && value.every((v) => typeof v === 'string' && WIKILINK_VALUE_RE.test(v))) {
      return { type: 'relation', value: value.map((v: string) => v.match(WIKILINK_VALUE_RE)![1]) };
    }
    // Unrecognized list shape (not all wikilinks) - preserve as best we can.
    if (value.every((v) => typeof v === 'string')) {
      return { type: 'text', value: (value as string[]).join(', ') };
    }
    return null;
  }
  if (typeof value === 'boolean') return { type: 'checkbox', value };
  if (typeof value === 'number') return { type: 'number', value };
  if (typeof value === 'string') {
    return DATE_RE.test(value) ? { type: 'date', value } : { type: 'text', value };
  }
  return null;
}

/** Render a note as a real markdown file: YAML frontmatter + body. */
export function serializeNote(note: Note): string {
  const frontmatter: Record<string, unknown> = {
    id: note.id,
    title: note.title,
    createdAt: new Date(note.createdAt).toISOString(),
    updatedAt: new Date(note.updatedAt).toISOString(),
  };
  for (const [name, value] of Object.entries(note.properties)) {
    frontmatter[name] = flattenProperty(value);
  }
  const yamlText = dump(frontmatter, { lineWidth: -1, noRefs: true });
  const body = note.content.endsWith('\n') ? note.content : `${note.content}\n`;
  return `---\n${yamlText}---\n\n${body}`;
}

export interface ParsedNoteFile {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  properties: Record<string, PropertyValue>;
  content: string;
}

/** Parse a markdown file (frontmatter + body) back into note fields. */
export function parseNoteFile(raw: string, fallbackId: string, fallbackTitle: string): ParsedNoteFile {
  const match = raw.match(FRONTMATTER_RE);
  const content = match ? raw.slice(match[0].length) : raw;

  let front: Record<string, unknown> = {};
  if (match) {
    const loaded = load(match[1]);
    if (loaded && typeof loaded === 'object' && !Array.isArray(loaded)) {
      front = loaded as Record<string, unknown>;
    }
  }

  const properties: Record<string, PropertyValue> = {};
  for (const [key, value] of Object.entries(front)) {
    if (RESERVED_KEYS.has(key)) continue;
    const inferred = inferProperty(value);
    if (inferred) properties[key] = inferred;
  }

  const parsedCreatedAt = typeof front.createdAt === 'string' ? Date.parse(front.createdAt) : NaN;
  const parsedUpdatedAt = typeof front.updatedAt === 'string' ? Date.parse(front.updatedAt) : NaN;

  return {
    id: typeof front.id === 'string' ? front.id : fallbackId,
    title: typeof front.title === 'string' ? front.title : fallbackTitle,
    createdAt: Number.isFinite(parsedCreatedAt) ? parsedCreatedAt : Date.now(),
    updatedAt: Number.isFinite(parsedUpdatedAt) ? parsedUpdatedAt : Date.now(),
    properties,
    content: content.replace(/\n$/, ''),
  };
}
