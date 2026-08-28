import { useMemo } from 'react';
import { findUnlinkedMentions } from '../lib/unlinkedMentions';
import type { Note } from '../types';

interface UnlinkedMentionsPanelProps {
  note: Note;
  notes: Note[];
  onSelect: (id: string) => void;
  onLinkAll: (sourceId: string) => void;
}

export function UnlinkedMentionsPanel({ note, notes, onSelect, onLinkAll }: UnlinkedMentionsPanelProps) {
  const mentions = useMemo(() => findUnlinkedMentions(note, notes), [note, notes]);
  if (mentions.length === 0) return null;

  const byId = new Map(notes.map((n) => [n.id, n] as const));

  return (
    <div className="panel unlinked-mentions-panel">
      <h3>Unlinked mentions</h3>
      <ul>
        {mentions.map((mention) => {
          const source = byId.get(mention.noteId);
          if (!source) return null;
          return (
            <li key={mention.noteId}>
              <div className="unlinked-mention-row">
                <button type="button" className="unlinked-mention-title" onClick={() => onSelect(mention.noteId)}>
                  {source.title}
                </button>
                <button type="button" className="unlinked-mention-link" onClick={() => onLinkAll(mention.noteId)}>
                  Link{mention.count > 1 ? ` all (${mention.count})` : ''}
                </button>
              </div>
              <p className="unlinked-mention-snippet">{mention.snippet}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
