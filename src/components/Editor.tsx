import { autocompletion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import { markdown } from '@codemirror/lang-markdown';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { useEffect, useRef } from 'react';

const WIKILINK_AT_CURSOR_RE = /\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]/g;

interface EditorProps {
  noteId: string;
  content: string;
  onChange: (content: string) => void;
  onNavigate: (title: string) => void;
  getTitles: () => string[];
}

function wikilinkCompletionSource(
  getTitles: () => string[],
): (context: CompletionContext) => CompletionResult | null {
  return (context) => {
    const match = context.matchBefore(/\[\[([^[\]]*)$/);
    if (!match) return null;
    const query = match.text.slice(2).toLowerCase();
    const titles = getTitles();
    const options = titles
      .filter((title) => title.toLowerCase().includes(query))
      .slice(0, 20)
      .map((title) => ({ label: title, apply: `${title}]]` }));
    if (options.length === 0) return null;
    return { from: match.from + 2, options, filter: false };
  };
}

export function Editor({ noteId, content, onChange, onNavigate, getTitles }: EditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onNavigateRef = useRef(onNavigate);
  const getTitlesRef = useRef(getTitles);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  useEffect(() => {
    onNavigateRef.current = onNavigate;
  }, [onNavigate]);
  useEffect(() => {
    getTitlesRef.current = getTitles;
  }, [getTitles]);

  // (Re)create the editor whenever we switch notes. Intentionally excludes
  // `content` from the dependency array: after creation, content updates are
  // pushed in via the effect below instead of tearing the view down.
  useEffect(() => {
    if (!hostRef.current) return;

    const state = EditorState.create({
      doc: content,
      extensions: [
        basicSetup,
        EditorView.lineWrapping,
        markdown(),
        autocompletion({ override: [wikilinkCompletionSource(() => getTitlesRef.current())] }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
        EditorView.domEventHandlers({
          click(event, view) {
            if (!(event.metaKey || event.ctrlKey)) return false;
            const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
            if (pos == null) return false;
            const line = view.state.doc.lineAt(pos);
            const relative = pos - line.from;
            WIKILINK_AT_CURSOR_RE.lastIndex = 0;
            let m: RegExpExecArray | null;
            while ((m = WIKILINK_AT_CURSOR_RE.exec(line.text))) {
              const start = m.index;
              const end = start + m[0].length;
              if (relative >= start && relative <= end) {
                onNavigateRef.current(m[1].trim());
                return true;
              }
            }
            return false;
          },
        }),
      ],
    });

    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  // Keep the editor in sync if `content` changes from outside (e.g. the
  // title/content were reloaded). Skipped when it already matches, so this
  // never fights the user's own typing or moves the cursor mid-edit.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== content) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: content } });
    }
  }, [content]);

  return <div className="editor-host" ref={hostRef} />;
}
