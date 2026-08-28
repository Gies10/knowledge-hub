// Inline tags, Obsidian-style: a `#` immediately followed by a letter, then
// letters/digits/-/_ or nested with `/` (e.g. #project/knowledge-hub).
// Requires a preceding start-of-string/whitespace/opening-paren so URLs and
// markdown headings ("# Heading") aren't picked up as tags.
const TAG_RE = /(^|[\s(])#([a-zA-Z][\w/-]*)/g;

export function extractTags(content: string): string[] {
  const tags = new Set<string>();
  let match: RegExpExecArray | null;
  TAG_RE.lastIndex = 0;
  while ((match = TAG_RE.exec(content))) {
    tags.add(match[2].toLowerCase());
  }
  return Array.from(tags);
}
