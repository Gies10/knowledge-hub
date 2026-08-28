import { useState } from 'react';
import type { Note, PropertyType, PropertyValue } from '../types';
import { RelationPicker } from './RelationPicker';

interface PropertiesPanelProps {
  note: Note;
  onChange: (properties: Record<string, PropertyValue>) => void;
  getTitles: () => string[];
}

const TYPE_LABELS: Record<PropertyType, string> = {
  text: 'Text',
  number: 'Number',
  checkbox: 'Checkbox',
  date: 'Date',
  relation: 'Relation',
};

function defaultValueFor(type: PropertyType): PropertyValue {
  switch (type) {
    case 'text':
      return { type: 'text', value: '' };
    case 'number':
      return { type: 'number', value: 0 };
    case 'checkbox':
      return { type: 'checkbox', value: false };
    case 'date':
      return { type: 'date', value: '' };
    case 'relation':
      return { type: 'relation', value: [] };
  }
}

export function PropertiesPanel({ note, onChange, getTitles }: PropertiesPanelProps) {
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<PropertyType>('relation');
  const entries = Object.entries(note.properties);

  function setProperty(name: string, value: PropertyValue) {
    onChange({ ...note.properties, [name]: value });
  }

  function removeProperty(name: string) {
    const next = { ...note.properties };
    delete next[name];
    onChange(next);
  }

  function addProperty() {
    const name = newName.trim();
    if (!name || note.properties[name]) return;
    onChange({ ...note.properties, [name]: defaultValueFor(newType) });
    setNewName('');
  }

  return (
    <div className="properties-panel">
      {entries.map(([name, value]) => (
        <div key={name} className="property-row">
          <span className="property-name">{name}</span>
          {value.type === 'text' && (
            <input
              className="property-value-input"
              value={value.value}
              onChange={(e) => setProperty(name, { type: 'text', value: e.target.value })}
            />
          )}
          {value.type === 'number' && (
            <input
              className="property-value-input"
              type="number"
              value={value.value}
              onChange={(e) => setProperty(name, { type: 'number', value: Number(e.target.value) })}
            />
          )}
          {value.type === 'checkbox' && (
            <input
              type="checkbox"
              checked={value.value}
              onChange={(e) => setProperty(name, { type: 'checkbox', value: e.target.checked })}
            />
          )}
          {value.type === 'date' && (
            <input
              className="property-value-input"
              type="date"
              value={value.value}
              onChange={(e) => setProperty(name, { type: 'date', value: e.target.value })}
            />
          )}
          {value.type === 'relation' && (
            <RelationPicker
              values={value.value}
              onChange={(vals) => setProperty(name, { type: 'relation', value: vals })}
              getTitles={getTitles}
            />
          )}
          <button type="button" className="property-remove" onClick={() => removeProperty(name)} aria-label={`Remove ${name}`}>
            ×
          </button>
        </div>
      ))}

      <div className="property-add-row">
        <input
          className="property-add-name"
          placeholder="Property name (e.g. parent)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addProperty();
          }}
        />
        <select value={newType} onChange={(e) => setNewType(e.target.value as PropertyType)}>
          {(Object.keys(TYPE_LABELS) as PropertyType[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <button type="button" className="property-add-button" onClick={addProperty} disabled={!newName.trim()}>
          + Add property
        </button>
      </div>
    </div>
  );
}
