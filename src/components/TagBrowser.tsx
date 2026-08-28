interface TagBrowserProps {
  allTags: string[];
  activeTag: string | null;
  onSelectTag: (tag: string | null) => void;
}

export function TagBrowser({ allTags, activeTag, onSelectTag }: TagBrowserProps) {
  if (allTags.length === 0) return null;

  return (
    <div className="panel tag-browser">
      <h3>Tags</h3>
      <div className="tag-list">
        {allTags.map((tag) => (
          <button
            key={tag}
            type="button"
            className={tag === activeTag ? 'tag-chip active' : 'tag-chip'}
            onClick={() => onSelectTag(tag === activeTag ? null : tag)}
          >
            #{tag}
          </button>
        ))}
      </div>
    </div>
  );
}
