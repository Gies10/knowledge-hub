import { useCallback, useMemo, useState } from 'react';
import { BacklinksPanel } from './components/BacklinksPanel';
import { Editor } from './components/Editor';
import { PreviewPane } from './components/PreviewPane';
import { Sidebar } from './components/Sidebar';
import { useNotes } from './hooks/useNotes';

type Mode = 'edit' | 'preview';

export default function App() {
  const {
    notes,
    loaded,
    selectedId,
    setSelectedId,
    graph,
    searchIndex,
    tagsByNote,
    allTags,
    createNote,
    updateNote,
    removeNote,
    findOrCreateByTitle,
  } = useNotes();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('edit');

  const selectedNote = useMemo(
    () => notes.find((n) => n.id === selectedId) ?? null,
    [notes, selectedId],
  );

  const searchMatchIds = useMemo(() => {
    if (!searchQuery.trim()) return null;
    return new Set(searchIndex.search(searchQuery).map((r) => String(r.id)));
  }, [searchQuery, searchIndex]);

  const visibleNotes = useMemo(() => {
    let list = notes;
    if (activeTag) {
      list = list.filter((n) => (tagsByNote.get(n.id) ?? []).includes(activeTag));
    }
    if (searchMatchIds) {
      list = list.filter((n) => searchMatchIds.has(n.id));
    }
    return [...list].sort((a, b) => b.updatedAt - a.updatedAt);
  }, [notes, activeTag, searchMatchIds, tagsByNote]);

  const allTitles = useMemo(() => notes.map((n) => n.title), [notes]);
  const getTitles = useCallback(() => allTitles, [allTitles]);

  const handleNavigate = useCallback(
    async (title: string) => {
      const note = await findOrCreateByTitle(title);
      setSelectedId(note.id);
      setSidebarOpen(false);
      setMode('edit');
    },
    [findOrCreateByTitle, setSelectedId],
  );

  const handleSelectNote = useCallback(
    (id: string) => {
      setSelectedId(id);
      setSidebarOpen(false);
    },
    [setSelectedId],
  );

  const handleCreateNote = useCallback(() => {
    void createNote('Untitled').then(() => {
      setSidebarOpen(false);
      setMode('edit');
    });
  }, [createNote]);

  const handleDelete = useCallback(() => {
    if (!selectedNote) return;
    if (window.confirm(`Delete "${selectedNote.title}"? This can't be undone.`)) {
      void removeNote(selectedNote.id);
    }
  }, [selectedNote, removeNote]);

  return (
    <div className="app">
      <Sidebar
        open={sidebarOpen}
        notes={visibleNotes}
        selectedId={selectedId}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        allTags={allTags}
        activeTag={activeTag}
        onSelectTag={setActiveTag}
        onSelectNote={handleSelectNote}
        onCreateNote={handleCreateNote}
      />
      {sidebarOpen && (
        <div className="sidebar-scrim" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
      )}

      <main className="main">
        <div className="topbar">
          <button
            type="button"
            className="icon-button sidebar-toggle"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Toggle note list"
          >
            ☰
          </button>

          {selectedNote ? (
            <>
              <input
                className="title-input"
                value={selectedNote.title}
                onChange={(e) => updateNote(selectedNote.id, { title: e.target.value })}
                placeholder="Untitled"
              />
              <div className="topbar-actions">
                <button
                  type="button"
                  className={mode === 'edit' ? 'mode-button active' : 'mode-button'}
                  onClick={() => setMode('edit')}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className={mode === 'preview' ? 'mode-button active' : 'mode-button'}
                  onClick={() => setMode('preview')}
                >
                  Preview
                </button>
                <button type="button" className="icon-button danger" onClick={handleDelete} aria-label="Delete note">
                  🗑
                </button>
              </div>
            </>
          ) : (
            <span className="app-title">Knowledge Hub</span>
          )}
        </div>

        {!loaded ? (
          <div className="empty-state">Loading…</div>
        ) : !selectedNote ? (
          <div className="empty-state">
            <p>No note selected.</p>
            <button type="button" className="new-note-button" onClick={handleCreateNote}>
              + Create your first note
            </button>
          </div>
        ) : (
          <>
            {mode === 'edit' ? (
              <Editor
                noteId={selectedNote.id}
                content={selectedNote.content}
                onChange={(content) => updateNote(selectedNote.id, { content })}
                onNavigate={handleNavigate}
                getTitles={getTitles}
              />
            ) : (
              <PreviewPane content={selectedNote.content} onNavigate={handleNavigate} />
            )}
            <BacklinksPanel
              noteId={selectedNote.id}
              notes={notes}
              graph={graph}
              onSelect={handleSelectNote}
            />
          </>
        )}
      </main>
    </div>
  );
}
