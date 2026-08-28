import { useMemo } from 'react';
import type { LinkGraph } from '../lib/graph';
import type { Note } from '../types';

interface BacklinksPanelProps {
  noteId: string;
  notes: Note[];
  graph: LinkGraph;
  onSelect: (id: string) => void;
}

export function BacklinksPanel({ noteId, notes, graph, onSelect }: BacklinksPanelProps) {
  const byId = useMemo(() => new Map(notes.map((n) => [n.id, n] as const)), [notes]);
  const backlinkIds = graph.incoming.get(noteId) ?? [];
  const unresolved = graph.unresolved.get(noteId) ?? [];

  return (
    <div className="panel backlinks-panel">
      <h3>Backlinks</h3>
      {backlinkIds.length === 0 ? (
        <p className="empty-hint">No notes link here yet.</p>
      ) : (
        <ul>
          {backlinkIds.map((id) => {
            const note = byId.get(id);
            if (!note) return null;
            return (
              <li key={id}>
                <button type="button" onClick={() => onSelect(id)}>
                  {note.title}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {unresolved.length > 0 && (
        <p className="empty-hint">
          Links to notes that don't exist yet: {unresolved.join(', ')}
        </p>
      )}
    </div>
  );
}
