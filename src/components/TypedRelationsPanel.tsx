import type { TypedBacklink } from '../lib/relations';
import type { Note } from '../types';

interface TypedRelationsPanelProps {
  noteId: string;
  notes: Note[];
  relationBacklinks: Map<string, TypedBacklink[]>;
  onSelect: (id: string) => void;
}

export function TypedRelationsPanel({ noteId, notes, relationBacklinks, onSelect }: TypedRelationsPanelProps) {
  const links = relationBacklinks.get(noteId) ?? [];
  if (links.length === 0) return null;

  const byId = new Map(notes.map((n) => [n.id, n] as const));
  const grouped = new Map<string, string[]>();
  for (const link of links) {
    grouped.set(link.property, [...(grouped.get(link.property) ?? []), link.sourceId]);
  }

  return (
    <div className="panel typed-relations-panel">
      <h3>Typed relations</h3>
      {Array.from(grouped.entries()).map(([property, sourceIds]) => (
        <div key={property} className="typed-relation-group">
          <span className="typed-relation-property">{property}</span>
          <ul>
            {sourceIds.map((id) => {
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
        </div>
      ))}
    </div>
  );
}
