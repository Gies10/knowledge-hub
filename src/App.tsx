import { useCallback, useMemo, useState } from 'react';
import { BacklinksPanel } from './components/BacklinksPanel';
import { Editor } from './components/Editor';
import { GraphView } from './components/GraphView';
import { PreviewPane } from './components/PreviewPane';
import { PropertiesPanel } from './components/PropertiesPanel';
import { QueryView } from './components/QueryView';
import { Sidebar } from './components/Sidebar';
import { SyncSettings } from './components/SyncSettings';
import { TypedRelationsPanel } from './components/TypedRelationsPanel';
import { UnlinkedMentionsPanel } from './components/UnlinkedMentionsPanel';
import { useNotes } from './hooks/useNotes';
import { useSync } from './hooks/useSync';
import { buildRelationBacklinks } from './lib/relations';
import { linkAllOccurrences } from './lib/unlinkedMentions';

type Mode = 'edit' | 'preview';
type ViewMode = 'note' | 'graph' | 'query';

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
    applyRemoteNote,
  } = useNotes();

  const sync = useSync({ notes, applyRemoteNote, removeNoteLocally: removeNote });

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('edit');
  const [viewMode, setViewMode] = useState<ViewMode>('note');
  const [syncModalOpen, setSyncModalOpen] = useState(false);

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
  const relationBacklinks = useMemo(() => buildRelationBacklinks(notes), [notes]);

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
      const id = selectedNote.id;
      void removeNote(id).then(() => sync.notifyNoteDeleted(id));
    }
  }, [selectedNote, removeNote, sync]);

  const handleOpenNoteFromGraph = useCallback(
    (id: string) => {
      setSelectedId(id);
      setViewMode('note');
      setMode('edit');
    },
    [setSelectedId],
  );

  const handleLinkNotes = useCallback(
    (sourceId: string, targetId: string) => {
      const source = notes.find((n) => n.id === sourceId);
      const target = notes.find((n) => n.id === targetId);
      if (!source || !target) return;
      const separator = source.content.trim().length > 0 ? '\n\n' : '';
      updateNote(sourceId, { content: `${source.content}${separator}[[${target.title}]]` });
    },
    [notes, updateNote],
  );

  const handleLinkAllMentions = useCallback(
    (sourceId: string) => {
      if (!selectedNote) return;
      const source = notes.find((n) => n.id === sourceId);
      if (!source) return;
      updateNote(sourceId, { content: linkAllOccurrences(source.content, selectedNote.title) });
    },
    [notes, selectedNote, updateNote],
  );

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

          <div className="view-switcher">
            <button
              type="button"
              className={viewMode === 'note' ? 'mode-button active' : 'mode-button'}
              onClick={() => setViewMode('note')}
            >
              Notes
            </button>
            <button
              type="button"
              className={viewMode === 'graph' ? 'mode-button active' : 'mode-button'}
              onClick={() => setViewMode('graph')}
            >
              Graph
            </button>
            <button
              type="button"
              className={viewMode === 'query' ? 'mode-button active' : 'mode-button'}
              onClick={() => setViewMode('query')}
            >
              Query
            </button>
          </div>

          {viewMode === 'graph' ? (
            <span className="app-title">Knowledge Graph</span>
          ) : viewMode === 'query' ? (
            <span className="app-title">Queries</span>
          ) : selectedNote ? (
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

          <button
            type="button"
            className="icon-button sync-button"
            onClick={() => setSyncModalOpen(true)}
            aria-label="Sync settings"
            title={sync.connected ? `Synced with ${sync.owner}/${sync.repo}` : 'Set up sync'}
          >
            <span className={`sync-dot sync-dot-${sync.connected ? sync.status : 'disconnected'}`} />
            ⇅
          </button>
        </div>

        {!loaded ? (
          <div className="empty-state">Loading…</div>
        ) : (
          <>
            <div className={viewMode === 'note' ? 'view-pane' : 'view-pane hidden'}>
              {!selectedNote ? (
                <div className="empty-state">
                  <p>No note selected.</p>
                  <button type="button" className="new-note-button" onClick={handleCreateNote}>
                    + Create your first note
                  </button>
                </div>
              ) : (
                <>
                  <PropertiesPanel
                    note={selectedNote}
                    onChange={(properties) => updateNote(selectedNote.id, { properties })}
                    getTitles={getTitles}
                  />
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
                  <TypedRelationsPanel
                    noteId={selectedNote.id}
                    notes={notes}
                    relationBacklinks={relationBacklinks}
                    onSelect={handleSelectNote}
                  />
                  <UnlinkedMentionsPanel
                    note={selectedNote}
                    notes={notes}
                    onSelect={handleSelectNote}
                    onLinkAll={handleLinkAllMentions}
                  />
                </>
              )}
            </div>

            <div className={viewMode === 'graph' ? 'view-pane' : 'view-pane hidden'}>
              <GraphView
                notes={notes}
                graph={graph}
                onOpenNote={handleOpenNoteFromGraph}
                onCreateNoteAt={createNote}
                onLinkNotes={handleLinkNotes}
              />
            </div>

            <div className={viewMode === 'query' ? 'view-pane' : 'view-pane hidden'}>
              <QueryView notes={notes} onOpenNote={handleOpenNoteFromGraph} getTitles={getTitles} />
            </div>
          </>
        )}
      </main>

      {syncModalOpen && <SyncSettings sync={sync} onClose={() => setSyncModalOpen(false)} />}
    </div>
  );
}
