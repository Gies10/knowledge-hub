import { useMemo, useState } from 'react';
import { buildChildrenIndex, getAllPropertyNames, getRootNoteIds } from '../lib/relations';
import type { Note, PropertyType } from '../types';
import { RelationPicker } from './RelationPicker';

interface QueryViewProps {
  notes: Note[];
  onOpenNote: (id: string) => void;
  getTitles: () => string[];
}

type Tab = 'hierarchy' | 'query';

export function QueryView({ notes, onOpenNote, getTitles }: QueryViewProps) {
  const [tab, setTab] = useState<Tab>('hierarchy');

  return (
    <div className="query-view">
      <div className="query-tabs">
        <button
          type="button"
          className={tab === 'hierarchy' ? 'mode-button active' : 'mode-button'}
          onClick={() => setTab('hierarchy')}
        >
          Hierarchy
        </button>
        <button
          type="button"
          className={tab === 'query' ? 'mode-button active' : 'mode-button'}
          onClick={() => setTab('query')}
        >
          Query builder
        </button>
      </div>
      <div className="query-content">
        {tab === 'hierarchy' ? (
          <HierarchyTree notes={notes} onOpenNote={onOpenNote} />
        ) : (
          <QueryBuilder notes={notes} onOpenNote={onOpenNote} getTitles={getTitles} />
        )}
      </div>
    </div>
  );
}

function HierarchyTree({ notes, onOpenNote }: { notes: Note[]; onOpenNote: (id: string) => void }) {
  const childrenIndex = useMemo(() => buildChildrenIndex(notes), [notes]);
  const roots = useMemo(() => getRootNoteIds(notes), [notes]);
  const byId = useMemo(() => new Map(notes.map((n) => [n.id, n] as const)), [notes]);

  if (notes.length === 0) {
    return <p className="empty-hint">No notes yet.</p>;
  }

  return (
    <>
      <p className="query-hint">
        Built from each note's <code>parent</code> relation property. Add one in a note's Properties panel to place
        it under another note.
      </p>
      <ul className="hierarchy-tree">
        {roots.map((id) => (
          <HierarchyNode
            key={id}
            noteId={id}
            byId={byId}
            childrenIndex={childrenIndex}
            onOpenNote={onOpenNote}
            ancestors={new Set()}
          />
        ))}
      </ul>
    </>
  );
}

function HierarchyNode({
  noteId,
  byId,
  childrenIndex,
  onOpenNote,
  ancestors,
}: {
  noteId: string;
  byId: Map<string, Note>;
  childrenIndex: Map<string, string[]>;
  onOpenNote: (id: string) => void;
  ancestors: Set<string>;
}) {
  const [expanded, setExpanded] = useState(true);
  const note = byId.get(noteId);
  const childIds = (childrenIndex.get(noteId) ?? []).filter((id) => !ancestors.has(id));
  if (!note) return null;

  const nextAncestors = new Set(ancestors);
  nextAncestors.add(noteId);

  return (
    <li className="hierarchy-node">
      <div className="hierarchy-node-row">
        {childIds.length > 0 ? (
          <button
            type="button"
            className="hierarchy-toggle"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? '▾' : '▸'}
          </button>
        ) : (
          <span className="hierarchy-toggle-spacer" />
        )}
        <button type="button" className="hierarchy-node-title" onClick={() => onOpenNote(noteId)}>
          {note.title}
        </button>
      </div>
      {expanded && childIds.length > 0 && (
        <ul>
          {childIds.map((id) => (
            <HierarchyNode
              key={id}
              noteId={id}
              byId={byId}
              childrenIndex={childrenIndex}
              onOpenNote={onOpenNote}
              ancestors={nextAncestors}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

type Operator = 'equals' | 'contains' | 'gt' | 'lt' | 'checked' | 'unchecked' | 'before' | 'after' | 'includes';

function operatorsFor(type: PropertyType): { value: Operator; label: string }[] {
  switch (type) {
    case 'text':
      return [
        { value: 'equals', label: 'is' },
        { value: 'contains', label: 'contains' },
      ];
    case 'number':
      return [
        { value: 'equals', label: '=' },
        { value: 'gt', label: '>' },
        { value: 'lt', label: '<' },
      ];
    case 'checkbox':
      return [
        { value: 'checked', label: 'is checked' },
        { value: 'unchecked', label: 'is unchecked' },
      ];
    case 'date':
      return [
        { value: 'equals', label: 'is' },
        { value: 'before', label: 'before' },
        { value: 'after', label: 'after' },
      ];
    case 'relation':
      return [{ value: 'includes', label: 'includes note' }];
  }
}

function QueryBuilder({
  notes,
  onOpenNote,
  getTitles,
}: {
  notes: Note[];
  onOpenNote: (id: string) => void;
  getTitles: () => string[];
}) {
  const propertyMap = useMemo(() => getAllPropertyNames(notes), [notes]);
  const propertyNames = useMemo(() => Array.from(propertyMap.keys()).sort(), [propertyMap]);

  const [propertyName, setPropertyName] = useState('');
  const [operator, setOperator] = useState<Operator | ''>('');
  const [textValue, setTextValue] = useState('');
  const [numberValue, setNumberValue] = useState(0);
  const [dateValue, setDateValue] = useState('');
  const [relationValue, setRelationValue] = useState<string[]>([]);

  const currentType = propertyName ? propertyMap.get(propertyName) : undefined;
  const ops = currentType ? operatorsFor(currentType) : [];

  function handlePropertyChange(name: string) {
    setPropertyName(name);
    const type = propertyMap.get(name);
    setOperator(type ? operatorsFor(type)[0].value : '');
    setTextValue('');
    setNumberValue(0);
    setDateValue('');
    setRelationValue([]);
  }

  const results = useMemo(() => {
    if (!propertyName || !operator) return [];
    return notes.filter((note) => {
      const prop = note.properties[propertyName];
      if (!prop) return false;
      switch (operator) {
        case 'equals':
          if (prop.type === 'text') return prop.value.toLowerCase() === textValue.trim().toLowerCase();
          if (prop.type === 'number') return prop.value === numberValue;
          if (prop.type === 'date') return prop.value === dateValue;
          return false;
        case 'contains':
          return prop.type === 'text' && prop.value.toLowerCase().includes(textValue.trim().toLowerCase());
        case 'gt':
          return prop.type === 'number' && prop.value > numberValue;
        case 'lt':
          return prop.type === 'number' && prop.value < numberValue;
        case 'checked':
          return prop.type === 'checkbox' && prop.value === true;
        case 'unchecked':
          return prop.type === 'checkbox' && prop.value === false;
        case 'before':
          return prop.type === 'date' && !!prop.value && !!dateValue && prop.value < dateValue;
        case 'after':
          return prop.type === 'date' && !!prop.value && !!dateValue && prop.value > dateValue;
        case 'includes':
          return (
            prop.type === 'relation' && relationValue.length > 0 && relationValue.every((v) => prop.value.includes(v))
          );
        default:
          return false;
      }
    });
  }, [notes, propertyName, operator, textValue, numberValue, dateValue, relationValue]);

  if (propertyNames.length === 0) {
    return (
      <p className="empty-hint">
        No properties defined yet. Add one from a note's Properties panel, then come back here to query by it.
      </p>
    );
  }

  return (
    <div className="query-builder">
      <div className="query-builder-row">
        <select value={propertyName} onChange={(e) => handlePropertyChange(e.target.value)}>
          <option value="" disabled>
            Choose a property…
          </option>
          {propertyNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        {currentType && (
          <select value={operator} onChange={(e) => setOperator(e.target.value as Operator)}>
            {ops.map((op) => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>
        )}

        {currentType === 'text' && (
          <input value={textValue} onChange={(e) => setTextValue(e.target.value)} placeholder="Value…" />
        )}
        {currentType === 'number' && (
          <input type="number" value={numberValue} onChange={(e) => setNumberValue(Number(e.target.value))} />
        )}
        {currentType === 'date' && <input type="date" value={dateValue} onChange={(e) => setDateValue(e.target.value)} />}
        {currentType === 'relation' && (
          <RelationPicker values={relationValue} onChange={setRelationValue} getTitles={getTitles} placeholder="Pick a note…" />
        )}
      </div>

      <ul className="query-results">
        {results.length === 0 ? (
          <li className="empty-hint">No matching notes.</li>
        ) : (
          results.map((note) => (
            <li key={note.id}>
              <button type="button" onClick={() => onOpenNote(note.id)}>
                {note.title}
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
