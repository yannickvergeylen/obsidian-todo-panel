export const VIEW_TYPE = "todo-panel";

export type StorageMode = "base" | "markdown";

/** A group is a markdown file holding its todos as checkbox lines. */
export interface TodoGroup {
  path: string;
  /** Display name; defaults to the file name. */
  alias?: string;
}

export interface TodoSettings {
  mode: StorageMode;
  folder: string;
  /** Group files, in display order. Used by Markdown storage only. */
  groups: TodoGroup[];
  /** Whether todos can carry `#tags`. */
  tags: boolean;
}

export const DEFAULT_SETTINGS: TodoSettings = {
  mode: "base",
  folder: "Todos",
  groups: [],
  tags: false,
};

export interface Todo {
  id: string;
  title: string;
  done: boolean;
  tags: string[];
  /** Path of the group file holding the todo (Markdown storage only). */
  group?: string;
}

export interface TodoStore {
  list(): Promise<Todo[]>;
  /** Adds to `group` (a group file path); the first group when omitted. */
  add(title: string, tags: string[], group?: string): Promise<void>;
  setTitle(todo: Todo, title: string): Promise<void>;
  setTags(todo: Todo, tags: string[]): Promise<void>;
  setDone(todo: Todo, done: boolean): Promise<void>;
  remove(todo: Todo): Promise<void>;
  /** Persists a new order; `ids` lists every todo id in display order. */
  reorder(ids: string[]): Promise<void>;
  /** Moves a todo into another group, before `beforeId` (null: at the end). */
  move?(todo: Todo, group: string, beforeId: string | null): Promise<void>;
  /** Whether a change to this path affects the list. */
  isRelevant(path: string): boolean;
}
