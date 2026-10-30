import { App, TFile } from "obsidian";
import { joinTags, splitTrailingTags } from "./tags";
import type { Todo, TodoStore } from "./types";

const TASK_LINE = /^(\s*[-*] \[)([ xX])(\] )(.*)$/;

/** Ids are `path:line`; a path may contain colons, the line number never does. */
function makeId(path: string, line: number) {
  return `${path}:${line}`;
}

function parseId(id: string) {
  const i = id.lastIndexOf(":");
  return { path: id.slice(0, i), line: Number(id.slice(i + 1)) };
}

/**
 * Markdown files (one per group) with a `- [ ] task` line per todo. Tags are
 * the `#tags` trailing the line; with `parseTags` off they stay in the title.
 */
export class MarkdownStore implements TodoStore {
  constructor(private app: App, private groups: string[], private parseTags: boolean) {}

  private split(text: string) {
    return this.parseTags ? splitTrailingTags(text) : { title: text, tags: [] as string[] };
  }

  isRelevant(path: string) {
    return this.groups.includes(path);
  }

  private async ensureFile(path: string): Promise<TFile> {
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) return existing;
    const slash = path.lastIndexOf("/");
    if (slash > 0) {
      const dir = path.slice(0, slash);
      if (!this.app.vault.getAbstractFileByPath(dir)) await this.app.vault.createFolder(dir);
    }
    return this.app.vault.create(path, "");
  }

  async list(): Promise<Todo[]> {
    const todos: Todo[] = [];
    for (const path of this.groups) {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (!(file instanceof TFile)) continue;
      (await this.app.vault.cachedRead(file)).split("\n").forEach((line, i) => {
        const m = TASK_LINE.exec(line);
        if (!m) return;
        const { title, tags } = this.split(m[4]);
        todos.push({ id: makeId(path, i), title, done: m[2] !== " ", tags, group: path });
      });
    }
    return todos;
  }

  /** Applies `fn` to the todo's line; returning null removes the line. */
  private async editLine(todo: Todo, fn: (m: RegExpExecArray) => string | null) {
    const { path, line } = parseId(todo.id);
    const file = await this.ensureFile(path);
    await this.app.vault.process(file, (data) => {
      const lines = data.split("\n");
      const m = TASK_LINE.exec(lines[line] ?? "");
      if (!m) return data;
      const next = fn(m);
      if (next === null) lines.splice(line, 1);
      else lines[line] = next;
      return lines.join("\n");
    });
  }

  async add(title: string, tags: string[], group = this.groups[0]) {
    const file = await this.ensureFile(group);
    const text = this.parseTags ? joinTags(title, tags) : title;
    await this.app.vault.process(file, (data) => {
      const sep = data === "" || data.endsWith("\n") ? "" : "\n";
      return `${data}${sep}- [ ] ${text}\n`;
    });
  }

  setTitle(todo: Todo, title: string) {
    return this.editLine(todo, (m) => m[1] + m[2] + m[3] + joinTags(title, this.split(m[4]).tags));
  }

  async setTags(todo: Todo, tags: string[]) {
    if (!this.parseTags) return;
    await this.editLine(todo, (m) => m[1] + m[2] + m[3] + joinTags(this.split(m[4]).title, tags));
  }

  setDone(todo: Todo, done: boolean) {
    return this.editLine(todo, (m) => m[1] + (done ? "x" : " ") + m[3] + m[4]);
  }

  remove(todo: Todo) {
    return this.editLine(todo, () => null);
  }

  /** Reorders within each file; todos never change file here (see `move`). */
  async reorder(ids: string[]) {
    const byPath = new Map<string, number[]>();
    for (const id of ids) {
      const { path, line } = parseId(id);
      byPath.set(path, [...(byPath.get(path) ?? []), line]);
    }
    for (const [path, order] of byPath) {
      const file = await this.ensureFile(path);
      await this.app.vault.process(file, (data) => {
        const lines = data.split("\n");
        // Task lines keep their slots; only the tasks swap places.
        const slots = [...order].sort((a, b) => a - b);
        const moved = order.map((line) => lines[line]);
        if (moved.some((l) => !TASK_LINE.test(l ?? ""))) return data;
        slots.forEach((slot, i) => (lines[slot] = moved[i]));
        return lines.join("\n");
      });
    }
  }

  async move(todo: Todo, group: string, beforeId: string | null) {
    const from = parseId(todo.id);
    if (from.path === group) return;
    const source = await this.ensureFile(from.path);
    const raw = (await this.app.vault.read(source)).split("\n")[from.line];
    if (!TASK_LINE.test(raw ?? "")) return;

    // Write the target first so a failure can't lose the todo.
    const target = await this.ensureFile(group);
    const before = beforeId ? parseId(beforeId) : null;
    await this.app.vault.process(target, (data) => {
      if (before && before.path === group) {
        const lines = data.split("\n");
        lines.splice(before.line, 0, raw);
        return lines.join("\n");
      }
      const sep = data === "" || data.endsWith("\n") ? "" : "\n";
      return `${data}${sep}${raw}\n`;
    });
    await this.remove(todo);
  }
}
