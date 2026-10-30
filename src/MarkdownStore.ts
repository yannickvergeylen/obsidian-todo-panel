import { App, TFile } from "obsidian";
import { joinTags, splitTrailingTags } from "./tags";
import type { Todo, TodoStore } from "./types";

// The last group captures a trailing `\r`, so files with CRLF line endings work.
// The text excludes only `\r` and `\n`, so exotic separators such as U+2028 stay in the title.
const TASK_LINE = /^(\s*[-*] \[)([ xX])(\] )([^\r\n]*?)(\r?)$/;

const STALE = "A todo changed in its file; the list was refreshed, try again.";

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
 *
 * Every write checks that the todo's line still reads as it did when listed
 * (`Todo.raw`), so an outdated line number can't hit another todo.
 */
export class MarkdownStore implements TodoStore {
  constructor(private app: App, private groups: string[], private parseTags: boolean) {}

  private split(text: string) {
    return this.parseTags ? splitTrailingTags(text) : { title: text, tags: [] as string[] };
  }

  isRelevant(path: string) {
    return this.groups.includes(path);
  }

  /** The group file, created (with its folder) when missing; only adding a todo should create files. */
  private async ensureFile(path: string): Promise<TFile> {
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) return existing;
    const slash = path.lastIndexOf("/");
    if (slash > 0) {
      const dir = path.slice(0, slash);
      if (!this.app.vault.getAbstractFileByPath(dir)) await this.app.vault.createFolder(dir);
    }
    try {
      return await this.app.vault.create(path, "");
    } catch (err) {
      // A concurrent call may have created it first.
      const created = this.app.vault.getAbstractFileByPath(path);
      if (created instanceof TFile) return created;
      throw err;
    }
  }

  /** The group file for changing an existing todo; never creates it. */
  private existingFile(path: string): TFile {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) throw new Error(`${path} no longer exists.`);
    return file;
  }

  async list(): Promise<Todo[]> {
    const todos: Todo[] = [];
    for (const path of this.groups) {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (!(file instanceof TFile)) continue;
      (await this.app.vault.cachedRead(file)).split("\n").forEach((raw, i) => {
        const m = TASK_LINE.exec(raw);
        if (!m) return;
        const { title, tags } = this.split(m[4]);
        todos.push({ id: makeId(path, i), title, done: m[2] !== " ", tags, group: path, raw });
      });
    }
    return todos;
  }

  /** Edits a file's lines in place; `fn` returns null when a todo's line no longer matches. */
  private async editLines(path: string, fn: (lines: string[]) => string[] | null) {
    const file = this.existingFile(path);
    let stale = false;
    await this.app.vault.process(file, (data) => {
      const lines = fn(data.split("\n"));
      if (!lines) {
        stale = true;
        return data;
      }
      return lines.join("\n");
    });
    if (stale) throw new Error(STALE);
  }

  /** Applies `fn` to the todo's line; returning null removes the line. */
  private editLine(todo: Todo, fn: (m: RegExpExecArray) => string | null) {
    const { path, line } = parseId(todo.id);
    return this.editLines(path, (lines) => {
      const m = lines[line] === todo.raw ? TASK_LINE.exec(todo.raw) : null;
      if (!m) return null;
      const next = fn(m);
      if (next === null) lines.splice(line, 1);
      else lines[line] = next;
      return lines;
    });
  }

  async add(title: string, tags: string[], group = this.groups[0]) {
    const file = await this.ensureFile(group);
    const text = this.parseTags ? joinTags(title, tags) : title;
    await this.app.vault.process(file, (data) => {
      const eol = data.includes("\r\n") ? "\r\n" : "\n";
      const sep = data === "" || data.endsWith("\n") ? "" : eol;
      return `${data}${sep}- [ ] ${text}${eol}`;
    });
  }

  update(todo: Todo, changes: { title?: string; tags?: string[] }) {
    return this.editLine(todo, (m) => {
      const current = this.split(m[4]);
      const title = changes.title ?? current.title;
      const tags = this.parseTags ? changes.tags ?? current.tags : [];
      return m[1] + m[2] + m[3] + joinTags(title, tags) + m[5];
    });
  }

  setDone(todo: Todo, done: boolean) {
    return this.editLine(todo, (m) => m[1] + (done ? "x" : " ") + m[3] + m[4] + m[5]);
  }

  remove(todo: Todo) {
    return this.editLine(todo, () => null);
  }

  /** Reorders within each file; todos never change file here (see `move`). */
  async reorder(todos: Todo[]) {
    const byGroup = new Map<string, Todo[]>();
    for (const todo of todos) byGroup.set(todo.group, [...(byGroup.get(todo.group) ?? []), todo]);

    for (const [path, order] of byGroup) {
      const slots = order.map((t) => parseId(t.id).line).sort((a, b) => a - b);
      if (order.every((t, i) => parseId(t.id).line === slots[i])) continue;
      await this.editLines(path, (lines) => {
        if (order.some((t) => lines[parseId(t.id).line] !== t.raw)) return null;
        // Task lines keep their slots; only the tasks swap places.
        slots.forEach((slot, i) => (lines[slot] = order[i].raw));
        return lines;
      });
    }
  }

  async move(todo: Todo, group: string, before: Todo | null) {
    const from = parseId(todo.id);
    if (from.path === group) return;
    const source = this.existingFile(from.path);
    if ((await this.app.vault.read(source)).split("\n")[from.line] !== todo.raw) throw new Error(STALE);

    // Write the target first so a failure can't lose the todo.
    const target = await this.ensureFile(group);
    const text = todo.raw.replace(/\r$/, "");
    await this.app.vault.process(target, (data) => {
      const crlf = data.includes("\r\n");
      if (before && before.group === group) {
        const lines = data.split("\n");
        const at = parseId(before.id).line;
        if (lines[at] === before.raw) {
          lines.splice(at, 0, text + (crlf ? "\r" : ""));
          return lines.join("\n");
        }
      }
      const eol = crlf ? "\r\n" : "\n";
      const sep = data === "" || data.endsWith("\n") ? "" : eol;
      return `${data}${sep}${text}${eol}`;
    });
    await this.remove(todo);
  }
}
