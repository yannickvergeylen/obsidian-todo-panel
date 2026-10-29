export const VIEW_TYPE = "todo-panel";

export type StorageMode = "base" | "markdown";

export interface TodoSettings {
  mode: StorageMode;
  folder: string;
  markdownFile: string;
}

export const DEFAULT_SETTINGS: TodoSettings = {
  mode: "base",
  folder: "Todos",
  markdownFile: "Todos.md",
};

export interface Todo {
  id: string;
  title: string;
  done: boolean;
}

export interface TodoStore {
  list(): Promise<Todo[]>;
  add(title: string): Promise<void>;
  setTitle(todo: Todo, title: string): Promise<void>;
  setDone(todo: Todo, done: boolean): Promise<void>;
  remove(todo: Todo): Promise<void>;
  /** Persists a new order; `ids` lists every todo id in display order. */
  reorder(ids: string[]): Promise<void>;
  /** Whether a change to this path affects the list. */
  isRelevant(path: string): boolean;
}
