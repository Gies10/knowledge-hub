export type PropertyValue =
  | { type: 'text'; value: string }
  | { type: 'number'; value: number }
  | { type: 'checkbox'; value: boolean }
  | { type: 'date'; value: string } // ISO yyyy-mm-dd
  | { type: 'relation'; value: string[] }; // related note titles

export type PropertyType = PropertyValue['type'];

export interface Note {
  id: string;
  title: string;
  /** Markdown body, not including any frontmatter. */
  content: string;
  /** Typed frontmatter-style fields, keyed by property name. */
  properties: Record<string, PropertyValue>;
  createdAt: number;
  updatedAt: number;
}
