export interface Note {
  id: string;
  title: string;
  /** Markdown body, not including any frontmatter. */
  content: string;
  createdAt: number;
  updatedAt: number;
}
