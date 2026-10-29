import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import type TodoPanelPlugin from "./main";
import { joinTags, parseInput, sameTags, tagHue } from "./tags";
import { VIEW_TYPE } from "./types";
import type { Todo } from "./types";

/** Group name of todos without a tag. */
const UNGROUPED = "";

export class TodoView extends ItemView {
  /** Collapsed group names (lowercase); kept per view, not persisted. */
  private collapsed = new Set<string>();

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

  private get organize() {
    return this.plugin.settings.organize;
  }

  /** Tags shown (and edited) in the current mode. */
  private visibleTags(todo: Todo) {
    if (this.organize === "tags") return todo.tags;
    if (this.organize === "groups") return todo.tags.slice(0, 1);
    return [];
  }

  /** Splits typed text into title and tags; plain lists leave `#` text alone. */
  private parse(text: string) {
    if (this.organize === "none") return { title: text.trim(), tags: [] as string[] };
    return parseInput(text, this.organize === "groups" ? 1 : Infinity);
  }

  async render() {
    const root = this.contentEl;
    // Keep an in-progress edit from being clobbered by a refresh.
    if (root.querySelector(".todo-panel-text:focus")) return;
    const todos = await this.plugin.store.list();
    root.empty();
    root.addClass("todo-panel");

    this.renderAddInput(root, todos);

    const list = root.createDiv({ cls: "todo-panel-list" });
    if (this.organize === "groups") this.renderGroups(list, todos);
    else for (const todo of todos) this.renderTodo(list, list, todo, todos);
  }

  private renderAddInput(root: HTMLElement, todos: Todo[]) {
    const input = root.createEl("input", {
      cls: "todo-panel-add",
      attr: {
        type: "text",
        placeholder: this.organize === "none" ? "Add a todo…" : "Add a todo… (#tag)",
      },
    });
    const suggest = root.createDiv({ cls: "todo-panel-suggest" });
    const known = [...new Map(todos.flatMap((t) => this.visibleTags(t)).map((t) => [t.toLowerCase(), t])).values()];

    input.addEventListener("input", () => {
      suggest.empty();
      if (this.organize === "none") return;
      const partial = /(?:^|\s)#([^\s#]*)$/.exec(input.value);
      if (!partial) return;
      const prefix = partial[1].toLowerCase();
      const used = new Set(this.parse(input.value).tags.map((t) => t.toLowerCase()));
      const start = input.value.length - partial[1].length - 1;
      for (const tag of known.filter((t) => t.toLowerCase().startsWith(prefix) && !used.has(t.toLowerCase())).slice(0, 6)) {
        const chip = suggest.createSpan({ cls: "todo-panel-tag is-suggestion", text: tag });
        chip.style.setProperty("--tag-hue", String(tagHue(tag)));
        // mousedown keeps focus in the input.
        chip.addEventListener("mousedown", (e) => {
          e.preventDefault();
          input.value = `${input.value.slice(0, start)}#${tag} `;
          suggest.empty();
          input.focus();
        });
      }
    });

    input.addEventListener("keydown", async (e) => {
      if (e.key !== "Enter" || e.isComposing) return;
      const { title, tags } = this.parse(input.value);
      if (!title) return;
      input.value = "";
      suggest.empty();
      try {
        await this.plugin.store.add(title, tags);
      } catch (err) {
        new Notice(`Could not add todo: ${err}`);
      }
    });
  }

  /** Renders todos under a header per first tag; untagged todos go last. */
  private renderGroups(list: HTMLElement, todos: Todo[]) {
    const groups = new Map<string, { name: string; todos: Todo[] }>();
    for (const todo of todos) {
      const name = todo.tags[0] ?? UNGROUPED;
      const group = groups.get(name.toLowerCase()) ?? { name, todos: [] };
      group.todos.push(todo);
      groups.set(name.toLowerCase(), group);
    }
    const ordered = [...groups.values()].sort((a, b) => Number(a.name === UNGROUPED) - Number(b.name === UNGROUPED));

    // Without any tag there is nothing to group by, so skip the header.
    if (ordered.length === 1 && ordered[0].name === UNGROUPED) {
      for (const todo of todos) this.renderTodo(list, list, todo, todos);
      return;
    }

    for (const group of ordered) {
      const key = group.name.toLowerCase();
      const section = list.createDiv({ cls: "todo-panel-group" });
      section.toggleClass("is-collapsed", this.collapsed.has(key));

      const header = section.createDiv({ cls: "todo-panel-group-header" });
      header.createSpan({ cls: "todo-panel-group-arrow", text: "▾" });
      header.createSpan({ cls: "todo-panel-group-name", text: group.name || "Ungrouped" });
      header.createSpan({ cls: "todo-panel-group-count", text: String(group.todos.length) });
      header.addEventListener("click", () => {
        if (this.collapsed.delete(key)) section.removeClass("is-collapsed");
        else {
          this.collapsed.add(key);
          section.addClass("is-collapsed");
        }
      });
      header.addEventListener("dragover", (e) => {
        if (!list.find(".is-dragging")) return;
        e.preventDefault();
        header.addClass("drop-target");
      });
      header.addEventListener("dragleave", () => header.removeClass("drop-target"));
      header.addEventListener("drop", async (e) => {
        e.preventDefault();
        header.removeClass("drop-target");
        const dragged = todos.find((t) => t.id === e.dataTransfer?.getData("text/plain"));
        if (dragged) await this.moveToGroup(dragged, group.name);
      });

      const body = section.createDiv({ cls: "todo-panel-group-body" });
      for (const todo of group.todos) this.renderTodo(body, list, todo, todos);
    }
  }

  /** Makes `name` the todo's group (first tag), keeping its other tags. */
  private async moveToGroup(todo: Todo, name: string) {
    const rest = todo.tags.filter((t) => t.toLowerCase() !== name.toLowerCase());
    const tags = name === UNGROUPED ? [] : [name, ...rest];
    if (!sameTags(tags, todo.tags)) await this.plugin.store.setTags(todo, tags);
  }

  /** `list` is the whole list element, used to find the row being dragged. */
  private renderTodo(parent: HTMLElement, list: HTMLElement, todo: Todo, todos: Todo[]) {
    const row = parent.createDiv({ cls: "todo-panel-item" });
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
      list.findAll(".drop-target").forEach((el) => el.removeClass("drop-target"));
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
      const dragged = todos.find((t) => t.id === draggedId);
      // Dropping into another group moves the todo there.
      if (dragged && this.organize === "groups") await this.moveToGroup(dragged, todo.tags[0] ?? UNGROUPED);
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
    let cancelled = false;
    // While editing, tags show as `#tag` text after the title.
    text.addEventListener("focus", () => {
      if (this.organize === "none") return;
      text.textContent = joinTags(todo.title, this.visibleTags(todo));
      const range = document.createRange();
      range.selectNodeContents(text);
      range.collapse(false);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    });
    text.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        text.blur();
      } else if (e.key === "Escape") {
        cancelled = true;
        text.blur();
      }
    });
    text.addEventListener("blur", async () => {
      if (cancelled) {
        cancelled = false;
        this.render();
        return;
      }
      const { title, tags } = this.parse(text.textContent ?? "");
      const tagsChanged = this.organize !== "none" && !sameTags(tags, this.visibleTags(todo));
      if (!title || (title === todo.title && !tagsChanged)) {
        this.render();
        return;
      }
      if (title !== todo.title) await this.plugin.store.setTitle(todo, title);
      if (tagsChanged) await this.plugin.store.setTags(todo, tags);
    });

    if (this.organize === "tags" && todo.tags.length) {
      const tagList = row.createDiv({ cls: "todo-panel-tags" });
      for (const tag of todo.tags) {
        const pill = tagList.createSpan({ cls: "todo-panel-tag", text: tag });
        pill.style.setProperty("--tag-hue", String(tagHue(tag)));
      }
    }

    const del = row.createEl("button", {
      cls: "todo-panel-delete clickable-icon",
      attr: { "aria-label": "Delete todo" },
    });
    del.setText("×");
    del.addEventListener("click", () => this.plugin.store.remove(todo));
  }
}
