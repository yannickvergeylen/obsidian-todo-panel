export const VIEW_TYPE = "todo-panel";

/** A group is a markdown file holding its todos as checkbox lines. */
export interface TodoGroup {
  path: string;
  /** Display name; defaults to the file name. */
  alias?: string;
}

export interface TodoSettings {
  /** Group files, in display order; there is always at least one. */
  groups: TodoGroup[];
  /** Whether todos can carry `@tags`. */
  tags: boolean;
  /** Chosen tag colors as `#rrggbb`, keyed by lowercase tag; other tags get a color derived from their name. */
  tagColors: Record<string, string>;
  /** Whether the panel shows a button next to the add box that opens these settings. */
  showSettingsButton: boolean;
}

export interface Todo {
  id: string;
  title: string;
  done: boolean;
  tags: string[];
  /** Path of the group file holding the todo. */
  group: string;
  /** The todo's line exactly as listed; writes check it to detect outdated ids. */
  raw: string;
}

export interface TodoStore {
  list(): Promise<Todo[]>;
  /** Adds to `group` (a group file path); the first group when omitted. */
  add(title: string, tags: string[], group?: string): Promise<void>;
  /** Changes the given fields in one write. */
  update(todo: Todo, changes: { title?: string; tags?: string[] }): Promise<void>;
  setDone(todo: Todo, done: boolean): Promise<void>;
  remove(todo: Todo): Promise<void>;
  /** Persists a new order; `todos` lists every todo in display order. */
  reorder(todos: Todo[]): Promise<void>;
  /** Moves a todo into another group, before `before` (null: at the end). */
  move(todo: Todo, group: string, before: Todo | null): Promise<void>;
  /** Whether a change to this path affects the list. */
  isRelevant(path: string): boolean;
}
