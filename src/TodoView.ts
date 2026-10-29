import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import type TodoPanelPlugin from "./main";
import { VIEW_TYPE } from "./types";
import type { Todo } from "./types";

export class TodoView extends ItemView {
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
