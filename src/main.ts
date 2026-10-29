import {
  App,
  ItemView,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  TFolder,
  WorkspaceLeaf,
  normalizePath,
} from "obsidian";

const VIEW_TYPE = "todo-panel";

type StorageMode = "base" | "markdown";

interface TodoSettings {
  mode: StorageMode;
  folder: string;
  markdownFile: string;
}

const DEFAULT_SETTINGS: TodoSettings = {
  mode: "base",
  folder: "Todos",
  markdownFile: "Todos.md",
};

interface Todo {
  id: string;
  title: string;
  done: boolean;
}

interface TodoStore {
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

/** One note per todo (frontmatter properties), listed by a Base file. */
class BaseStore implements TodoStore {
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

const TASK_LINE = /^(\s*[-*] \[)([ xX])(\] )(.*)$/;

/** One markdown file with a `- [ ] task` line per todo. */
class MarkdownStore implements TodoStore {
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

export default class TodoPanelPlugin extends Plugin {
  settings: TodoSettings = DEFAULT_SETTINGS;
  store!: TodoStore;

  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.updateStore();

    this.registerView(VIEW_TYPE, (leaf) => new TodoView(leaf, this));
    this.addRibbonIcon("check-square", "Open todo panel", () => this.activateView());
    this.addCommand({
      id: "open-todo-panel",
      name: "Open todo panel",
      callback: () => this.activateView(),
    });
    this.addSettingTab(new TodoSettingTab(this.app, this));
  }

  async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      leaf = workspace.getRightLeaf(false)!;
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    workspace.revealLeaf(leaf);
  }

  /** Rebuilds the store from the current settings and redraws open panels. */
  updateStore() {
    const { mode, folder, markdownFile } = this.settings;
    this.store =
      mode === "markdown"
        ? new MarkdownStore(this.app, normalizePath(markdownFile))
        : new BaseStore(this.app, normalizePath(folder));
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      (leaf.view as TodoView).render();
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.updateStore();
  }
}

class TodoView extends ItemView {
  constructor(leaf: WorkspaceLeaf, private plugin: TodoPanelPlugin) {
    super(leaf);
  }

  getViewType() {
    return VIEW_TYPE;
  }

  getDisplayText() {
    return "Todos";
  }

  getIcon() {
    return "check-square";
  }

  async onOpen() {
    const refresh = (file: { path: string }) => {
      if (this.plugin.store.isRelevant(file.path)) this.render();
    };
    this.registerEvent(this.app.metadataCache.on("changed", refresh));
    this.registerEvent(this.app.vault.on("modify", refresh));
    this.registerEvent(this.app.vault.on("create", refresh));
    this.registerEvent(this.app.vault.on("delete", refresh));
    this.registerEvent(this.app.vault.on("rename", refresh));
    this.render();
  }

  async render() {
    const root = this.contentEl;
    // Keep an in-progress edit from being clobbered by a refresh.
    if (root.querySelector(".todo-panel-text:focus")) return;
    const todos = await this.plugin.store.list();
    root.empty();
    root.addClass("todo-panel");

    const input = root.createEl("input", {
      cls: "todo-panel-add",
      attr: { type: "text", placeholder: "Add a todo…" },
    });
    input.addEventListener("keydown", async (e) => {
      if (e.key !== "Enter" || e.isComposing) return;
      const title = input.value.trim();
      if (!title) return;
      input.value = "";
      try {
        await this.plugin.store.add(title);
      } catch (err) {
        new Notice(`Could not add todo: ${err}`);
      }
    });

    const list = root.createDiv({ cls: "todo-panel-list" });
    for (const todo of todos) this.renderTodo(list, todo, todos);
  }

  private renderTodo(list: HTMLElement, todo: Todo, todos: Todo[]) {
    const row = list.createDiv({ cls: "todo-panel-item" });
    row.toggleClass("is-done", todo.done);
    row.dataset.id = todo.id;

    const handle = row.createDiv({
      cls: "todo-panel-handle",
      text: "⋮⋮",
      attr: { draggable: "true", "aria-label": "Drag to reorder" },
    });
    handle.addEventListener("dragstart", (e) => {
      e.dataTransfer?.setData("text/plain", todo.id);
      e.dataTransfer?.setDragImage(row, 0, 0);
      row.addClass("is-dragging");
    });
    handle.addEventListener("dragend", () => {
      row.removeClass("is-dragging");
      list.findAll(".drop-before, .drop-after").forEach((el) => el.removeClasses(["drop-before", "drop-after"]));
    });
    row.addEventListener("dragover", (e) => {
      if (!list.find(".is-dragging")) return;
      e.preventDefault();
      const rect = row.getBoundingClientRect();
      const before = e.clientY < rect.top + rect.height / 2;
      row.toggleClass("drop-before", before);
      row.toggleClass("drop-after", !before);
    });
    row.addEventListener("dragleave", () => row.removeClasses(["drop-before", "drop-after"]));
    row.addEventListener("drop", async (e) => {
      e.preventDefault();
      const draggedId = e.dataTransfer?.getData("text/plain");
      const after = row.hasClass("drop-after");
      row.removeClasses(["drop-before", "drop-after"]);
      if (!draggedId || draggedId === todo.id) return;
      const ids = todos.map((t) => t.id).filter((id) => id !== draggedId);
      ids.splice(ids.indexOf(todo.id) + (after ? 1 : 0), 0, draggedId);
      await this.plugin.store.reorder(ids);
    });

    const check = row.createEl("input", { attr: { type: "checkbox" } });
    check.checked = todo.done;
    check.addEventListener("change", () => this.plugin.store.setDone(todo, check.checked));

    const text = row.createEl("span", {
      cls: "todo-panel-text",
      text: todo.title,
      attr: { contenteditable: "plaintext-only", spellcheck: "false" },
    });
    text.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        text.blur();
      } else if (e.key === "Escape") {
        text.textContent = todo.title;
        text.blur();
      }
    });
    text.addEventListener("blur", async () => {
      const title = (text.textContent ?? "").trim();
      if (!title) text.textContent = todo.title;
      else if (title !== todo.title) await this.plugin.store.setTitle(todo, title);
      else this.render();
    });

    const del = row.createEl("button", {
      cls: "todo-panel-delete clickable-icon",
      attr: { "aria-label": "Delete todo" },
    });
    del.setText("×");
    del.addEventListener("click", () => this.plugin.store.remove(todo));
  }
}

class TodoSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: TodoPanelPlugin) {
    super(app, plugin);
  }

  display() {
    const { containerEl } = this;
    const settings = this.plugin.settings;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Storage")
      .setDesc("Base: one note per todo, listed in a Base file. Markdown: one file with checkbox lines.")
      .addDropdown((dd) =>
        dd
          .addOption("base", "Base (note per todo)")
          .addOption("markdown", "Markdown file")
          .setValue(settings.mode)
          .onChange(async (value) => {
            settings.mode = value as StorageMode;
            await this.plugin.saveSettings();
            this.display();
          })
      );

    if (settings.mode === "base") {
      new Setting(containerEl)
        .setName("Todo folder")
        .setDesc("Each todo is a note in this folder; a Base file lists them.")
        .addText((text) =>
          text.setValue(settings.folder).onChange(async (value) => {
            settings.folder = value.trim() || DEFAULT_SETTINGS.folder;
            await this.plugin.saveSettings();
          })
        );
    } else {
      new Setting(containerEl)
        .setName("Todo file")
        .setDesc("Path of the markdown file holding the todos.")
        .addText((text) =>
          text.setValue(settings.markdownFile).onChange(async (value) => {
            settings.markdownFile = value.trim() || DEFAULT_SETTINGS.markdownFile;
            await this.plugin.saveSettings();
          })
        );
    }
  }
}
