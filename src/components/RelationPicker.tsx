import { useState } from 'react';

interface RelationPickerProps {
  values: string[];
  onChange: (values: string[]) => void;
  getTitles: () => string[];
  placeholder?: string;
}

export function RelationPicker({ values, onChange, getTitles, placeholder }: RelationPickerProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const suggestions = query.trim()
    ? getTitles()
        .filter((t) => !values.includes(t) && t.toLowerCase().includes(query.trim().toLowerCase()))
        .slice(0, 8)
    : [];

  function addValue(title: string) {
    if (!values.includes(title)) onChange([...values, title]);
    setQuery('');
    setOpen(false);
  }

  function removeValue(title: string) {
    onChange(values.filter((v) => v !== title));
  }

  return (
    <div className="relation-picker">
      <div className="relation-chips">
        {values.map((title) => (
          <span key={title} className="relation-chip">
            {title}
            <button type="button" onClick={() => removeValue(title)} aria-label={`Remove ${title}`}>
              ×
            </button>
          </span>
        ))}
        <input
          className="relation-picker-input"
          value={query}
          placeholder={placeholder ?? 'Add note…'}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && suggestions.length > 0) {
              e.preventDefault();
              addValue(suggestions[0]);
            }
          }}
        />
      </div>
      {open && suggestions.length > 0 && (
        <ul className="relation-suggestions">
          {suggestions.map((title) => (
            <li key={title}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => addValue(title)}>
                {title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
