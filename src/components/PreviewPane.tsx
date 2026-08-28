import { useEffect, useMemo, useRef } from 'react';
import { renderMarkdown, WIKILINK_ATTR } from '../lib/markdown';

interface PreviewPaneProps {
  content: string;
  onNavigate: (title: string) => void;
}

export function PreviewPane({ content, onNavigate }: PreviewPaneProps) {
  const html = useMemo(() => renderMarkdown(content), [content]);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const onNavigateRef = useRef(onNavigate);

  useEffect(() => {
    onNavigateRef.current = onNavigate;
  }, [onNavigate]);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    function handleClick(event: MouseEvent) {
      const link = (event.target as HTMLElement).closest(`a[${WIKILINK_ATTR}]`);
      if (!link) return;
      event.preventDefault();
      const title = link.getAttribute(WIKILINK_ATTR);
      if (title) onNavigateRef.current(title);
    }
    el.addEventListener('click', handleClick);
    return () => el.removeEventListener('click', handleClick);
  }, []);

  return <div ref={hostRef} className="preview-pane" dangerouslySetInnerHTML={{ __html: html }} />;
}
