export const VIEW_TYPE = "todo-panel";

export type StorageMode = "base" | "markdown";

/** How todos are organized: a plain list, one group each, or any number of tags. */
export type Organize = "none" | "groups" | "tags";

export interface TodoSettings {
  mode: StorageMode;
  folder: string;
  markdownFile: string;
  organize: Organize;
}

export const DEFAULT_SETTINGS: TodoSettings = {
  mode: "base",
  folder: "Todos",
  markdownFile: "Todos.md",
  organize: "none",
};

export interface Todo {
  id: string;
  title: string;
  done: boolean;
  /** All stored tags; groups mode uses the first one as the group. */
  tags: string[];
}

export interface TodoStore {
  list(): Promise<Todo[]>;
  add(title: string, tags: string[]): Promise<void>;
  setTitle(todo: Todo, title: string): Promise<void>;
  setTags(todo: Todo, tags: string[]): Promise<void>;
  setDone(todo: Todo, done: boolean): Promise<void>;
  remove(todo: Todo): Promise<void>;
  /** Persists a new order; `ids` lists every todo id in display order. */
  reorder(ids: string[]): Promise<void>;
  /** Whether a change to this path affects the list. */
  isRelevant(path: string): boolean;
}
