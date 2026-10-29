import { App, TFile, TFolder, normalizePath } from "obsidian";
import type { Todo, TodoStore } from "./types";

/** One note per todo (frontmatter properties), listed by a Base file. */
export class BaseStore implements TodoStore {
  constructor(private app: App, private folder: string) {}

  isRelevant(path: string) {
    return path.startsWith(this.folder + "/");
  }

  private async ensureFolder() {
    if (!this.app.vault.getAbstractFileByPath(this.folder)) {
      await this.app.vault.createFolder(this.folder);
    }
    await this.ensureBase();
  }

  /** Creates the Base file that lists the todos, if missing. */
  private async ensureBase() {
    const path = normalizePath(`${this.folder}/Todos.base`);
    if (this.app.vault.getAbstractFileByPath(path)) return;
    const content = [
      "filters:",
      "  and:",
      `    - file.folder == "${this.folder}"`,
      "properties:",
      "  note.title:",
      "    displayName: Todo",
      "  note.done:",
      "    displayName: Done",
      "  note.created:",
      "    displayName: Created",
      "views:",
      "  - type: table",
      "    name: Todos",
      "    sort:",
      "      - property: note.order",
      "        direction: ASC",
      "    order:",
      "      - note.title",
      "      - note.done",
      "      - note.created",
      "",
    ].join("\n");
    await this.app.vault.create(path, content);
  }

  async list(): Promise<Todo[]> {
    const folder = this.app.vault.getAbstractFileByPath(this.folder);
    if (!(folder instanceof TFolder)) return [];
    const todos: (Todo & { order: number })[] = [];
    for (const child of folder.children) {
      if (!(child instanceof TFile) || child.extension !== "md") continue;
      const fm = this.app.metadataCache.getFileCache(child)?.frontmatter;
      if (!fm) continue;
      todos.push({
        id: child.path,
        title: String(fm.title ?? child.basename),
        done: fm.done === true,
        order: Number(fm.order ?? fm.created ?? child.stat.ctime),
      });
    }
    return todos.sort((a, b) => a.order - b.order);
  }

  private file(todo: Todo): TFile | null {
    const f = this.app.vault.getAbstractFileByPath(todo.id);
    return f instanceof TFile ? f : null;
  }

  async add(title: string) {
    await this.ensureFolder();
    const created = Date.now();
    const path = normalizePath(`${this.folder}/${created}.md`);
    const content = `---\ntitle: ${JSON.stringify(title)}\ndone: false\ncreated: ${created}\norder: ${created}\n---\n`;
    await this.app.vault.create(path, content);
  }

  async setTitle(todo: Todo, title: string) {
    const file = this.file(todo);
    if (!file) return;
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      fm.title = title;
    });
  }

  async setDone(todo: Todo, done: boolean) {
    const file = this.file(todo);
    if (!file) return;
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      fm.done = done;
    });
  }

  async remove(todo: Todo) {
    const file = this.file(todo);
    if (file) await this.app.fileManager.trashFile(file);
  }

  async reorder(ids: string[]) {
    await Promise.all(
      ids.map((id, order) => {
        const file = this.app.vault.getAbstractFileByPath(id);
        if (!(file instanceof TFile)) return;
        return this.app.fileManager.processFrontMatter(file, (fm) => {
          if (fm.order !== order) fm.order = order;
        });
      })
    );
  }
}
