import { App, TFile } from "obsidian";
import type { Todo, TodoStore } from "./types";

const TASK_LINE = /^(\s*[-*] \[)([ xX])(\] )(.*)$/;

/** One markdown file with a `- [ ] task` line per todo. */
export class MarkdownStore implements TodoStore {
  constructor(private app: App, private path: string) {}

  isRelevant(path: string) {
    return path === this.path;
  }

  private async ensureFile(): Promise<TFile> {
    const existing = this.app.vault.getAbstractFileByPath(this.path);
    if (existing instanceof TFile) return existing;
    const slash = this.path.lastIndexOf("/");
    if (slash > 0) {
      const dir = this.path.slice(0, slash);
      if (!this.app.vault.getAbstractFileByPath(dir)) await this.app.vault.createFolder(dir);
    }
    return this.app.vault.create(this.path, "");
  }

  async list(): Promise<Todo[]> {
    const file = this.app.vault.getAbstractFileByPath(this.path);
    if (!(file instanceof TFile)) return [];
    const todos: Todo[] = [];
    (await this.app.vault.cachedRead(file)).split("\n").forEach((line, i) => {
      const m = TASK_LINE.exec(line);
      if (m) todos.push({ id: String(i), title: m[4], done: m[2] !== " " });
    });
    return todos;
  }

  /** Applies `fn` to the todo's line; returning null removes the line. */
  private async editLine(todo: Todo, fn: (m: RegExpExecArray) => string | null) {
    const file = await this.ensureFile();
    await this.app.vault.process(file, (data) => {
      const lines = data.split("\n");
      const i = Number(todo.id);
      const m = TASK_LINE.exec(lines[i] ?? "");
      if (!m) return data;
      const next = fn(m);
      if (next === null) lines.splice(i, 1);
      else lines[i] = next;
      return lines.join("\n");
    });
  }

  async add(title: string) {
    const file = await this.ensureFile();
    await this.app.vault.process(file, (data) => {
      const sep = data === "" || data.endsWith("\n") ? "" : "\n";
      return `${data}${sep}- [ ] ${title}\n`;
    });
  }

  setTitle(todo: Todo, title: string) {
    return this.editLine(todo, (m) => m[1] + m[2] + m[3] + title);
  }

  setDone(todo: Todo, done: boolean) {
    return this.editLine(todo, (m) => m[1] + (done ? "x" : " ") + m[3] + m[4]);
  }

  remove(todo: Todo) {
    return this.editLine(todo, () => null);
  }

  async reorder(ids: string[]) {
    const file = await this.ensureFile();
    await this.app.vault.process(file, (data) => {
      const lines = data.split("\n");
      // Task lines keep their slots; only the tasks swap places.
      const slots = ids.map(Number).sort((a, b) => a - b);
      const moved = ids.map((id) => lines[Number(id)]);
      if (moved.some((l) => !TASK_LINE.test(l ?? ""))) return data;
      slots.forEach((slot, i) => (lines[slot] = moved[i]));
      return lines.join("\n");
    });
  }
}
