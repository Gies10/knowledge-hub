import type { Note } from '../types';
import { TagBrowser } from './TagBrowser';

interface SidebarProps {
  open: boolean;
  notes: Note[];
  selectedId: string | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  allTags: string[];
  activeTag: string | null;
  onSelectTag: (tag: string | null) => void;
  onSelectNote: (id: string) => void;
  onCreateNote: () => void;
}

export function Sidebar({
  open,
  notes,
  selectedId,
  searchQuery,
  onSearchChange,
  allTags,
  activeTag,
  onSelectTag,
  onSelectNote,
  onCreateNote,
}: SidebarProps) {
  return (
    <aside className={open ? 'sidebar open' : 'sidebar'}>
      <div className="sidebar-header">
        <input
          type="search"
          placeholder="Search notes…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Search notes"
        />
        <button type="button" className="new-note-button" onClick={onCreateNote}>
          + New
        </button>
      </div>

      <ul className="note-list">
        {notes.map((note) => (
          <li key={note.id}>
            <button
              type="button"
              className={note.id === selectedId ? 'note-list-item active' : 'note-list-item'}
              onClick={() => onSelectNote(note.id)}
            >
              <span className="note-title">{note.title || 'Untitled'}</span>
              <span className="note-date">{new Date(note.updatedAt).toLocaleDateString()}</span>
            </button>
          </li>
        ))}
        {notes.length === 0 && <li className="empty-hint">No notes match.</li>}
      </ul>

      <TagBrowser allTags={allTags} activeTag={activeTag} onSelectTag={onSelectTag} />
    </aside>
  );
}
