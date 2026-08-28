export interface LinkMatch {
  raw: string;
  target: string;
  alias?: string;
  index: number;
}

// Matches [[Target]] and [[Target|Alias]]. Deliberately excludes `#` so a
// future heading-link syntax ([[Note#Heading]]) can't be misparsed as text.
const WIKILINK_RE = /\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]/g;

export function extractLinks(content: string): LinkMatch[] {
  const links: LinkMatch[] = [];
  let match: RegExpExecArray | null;
  WIKILINK_RE.lastIndex = 0;
  while ((match = WIKILINK_RE.exec(content))) {
    links.push({
      raw: match[0],
      target: match[1].trim(),
      alias: match[2]?.trim(),
      index: match.index,
    });
  }
  return links;
}

export function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}
