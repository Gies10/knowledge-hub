import { marked } from 'marked';
import DOMPurify from 'dompurify';

const WIKILINK_RE = /\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]/g;

export const WIKILINK_ATTR = 'data-wikilink';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Rewrites [[Title]] / [[Title|Alias]] into `<a data-wikilink="Title">` tags,
 * then renders the rest of the markdown and sanitizes the result. Consumers
 * should intercept clicks on `a[data-wikilink]` to navigate in-app rather
 * than following `href`.
 */
export function renderMarkdown(content: string): string {
  const withWikiLinks = content.replace(WIKILINK_RE, (_full, target: string, alias?: string) => {
    const label = escapeHtml((alias ?? target).trim());
    const targetAttr = escapeHtml(target.trim());
    return `<a href="#" class="wikilink" ${WIKILINK_ATTR}="${targetAttr}">${label}</a>`;
  });
  const html = marked.parse(withWikiLinks, { async: false, breaks: true }) as string;
  return DOMPurify.sanitize(html, { ADD_ATTR: [WIKILINK_ATTR] });
}
