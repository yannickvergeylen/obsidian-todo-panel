import { ItemView, Notice, WorkspaceLeaf, setIcon } from "obsidian";
import type TodoPanelPlugin from "./main";
import { groupName } from "./groups";
import { joinTags, parseInput, sameTags, tagHue } from "./tags";
import { VIEW_TYPE } from "./types";
import type { Todo, TodoGroup } from "./types";

export class TodoView extends ItemView {
  /** Collapsed group paths; kept per view, not persisted. */
  private collapsed = new Set<string>();
  /** Group chosen in the add box. */
  private addGroup?: string;
  /** Id of the latest render; older, slower renders drop their result. */
  private renderId = 0;

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
    this.registerEvent(this.app.vault.on("modify", refresh));
    this.registerEvent(this.app.vault.on("create", refresh));
    this.registerEvent(this.app.vault.on("delete", refresh));
    this.registerEvent(this.app.vault.on("rename", refresh));
    this.render();
  }

  private get tagsOn() {
    return this.plugin.settings.tags;
  }

  private get groups(): TodoGroup[] {
    return this.plugin.settings.groups;
  }

  /** Tags shown (and edited) while Tags is on. */
  private visibleTags(todo: Todo) {
    return this.tagsOn ? todo.tags : [];
  }

  /** Splits typed text into title and tags; without tags `#` text is left alone. */
  private parse(text: string) {
    // Pasted line breaks would otherwise write extra lines into the file.
    const oneLine = text.replace(/\s*\n\s*/g, " ");
    if (!this.tagsOn) return { title: oneLine.trim(), tags: [] as string[] };
    return parseInput(oneLine, Infinity);
  }

  /** The group new todos go to: the chosen one, else the first. */
  private currentAddGroup() {
    const groups = this.groups;
    return groups.find((g) => g.path === this.addGroup)?.path ?? groups[0]?.path;
  }

  /** Runs a store change; on failure shows why and redraws from the files. */
  private async run(change: () => Promise<unknown>) {
    try {
      await change();
    } catch (err) {
      new Notice(`Todo panel: ${err instanceof Error ? err.message : err}`);
      this.render();
    }
  }

  async render() {
    const root = this.contentEl;
    const renderId = ++this.renderId;
    const todos = await this.plugin.store.list();
    // Skip when a newer render started meanwhile, and keep an in-progress edit
    // from being clobbered by a refresh (checked after the await: focus can arrive during it).
    if (renderId !== this.renderId || root.querySelector(".todo-panel-text:focus")) return;

    // The add box is rebuilt too; carry over what was typed and its focus.
    const previous = root.querySelector<HTMLInputElement>(".todo-panel-add");
    const typed = previous?.value ?? "";
    const hadFocus = !!previous && previous === document.activeElement;
    root.empty();
    root.addClass("todo-panel");

    const input = this.renderAddInput(root, todos);
    input.value = typed;
    if (hadFocus) input.focus();

    const list = root.createDiv({ cls: "todo-panel-list" });
    if (this.groups.length > 1) this.renderGroups(list, todos);
    else for (const todo of todos) this.renderTodo(list, list, todo, todos);
  }

  private renderAddInput(root: HTMLElement, todos: Todo[]): HTMLInputElement {
    const row = root.createDiv({ cls: "todo-panel-add-row" });
    const input = row.createEl("input", {
      cls: "todo-panel-add",
      attr: { type: "text", placeholder: this.tagsOn ? "Add a todo… (#tag)" : "Add a todo…" },
    });
    if (this.groups.length > 1) {
      const select = row.createEl("select", { cls: "dropdown todo-panel-add-group" });
      for (const group of this.groups) select.createEl("option", { text: groupName(group), value: group.path });
      select.value = this.currentAddGroup() ?? "";
      select.addEventListener("change", () => (this.addGroup = select.value));
    }
    if (this.plugin.settings.showSettingsButton) {
      // Not a view header action: Obsidian hides those in sidebar panes.
      const settingsButton = row.createEl("button", {
        cls: "todo-panel-settings clickable-icon",
        attr: { "aria-label": "Open todo panel settings" },
      });
      setIcon(settingsButton, "settings");
      settingsButton.addEventListener("click", () => this.plugin.openSettings());
    }
    const suggest = root.createDiv({ cls: "todo-panel-suggest" });
    const known = new Map<string, string>();
    for (const todo of todos) for (const tag of this.visibleTags(todo)) known.set(tag.toLowerCase(), tag);

    input.addEventListener("input", () => {
      suggest.empty();
      if (!this.tagsOn) return;
      const partial = /(?:^|\s)#([^\s#]*)$/.exec(input.value);
      if (!partial) return;
      const prefix = partial[1].toLowerCase();
      const used = new Set(this.parse(input.value).tags.map((t) => t.toLowerCase()));
      const start = input.value.length - partial[1].length - 1;
      const matches = [...known]
        .filter(([key]) => key.startsWith(prefix) && !used.has(key))
        .map(([, tag]) => tag)
        .slice(0, 6);
      for (const tag of matches) {
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
      await this.run(() => this.plugin.store.add(title, tags, this.currentAddGroup()));
    });
    return input;
  }

  /** Renders a collapsible section per group, in settings order. */
  private renderGroups(list: HTMLElement, todos: Todo[]) {
    for (const group of this.groups) {
      const groupTodos = todos.filter((t) => t.group === group.path);
      const section = list.createDiv({ cls: "todo-panel-group" });
      section.toggleClass("is-collapsed", this.collapsed.has(group.path));

      const header = section.createDiv({ cls: "todo-panel-group-header" });
      header.createSpan({ cls: "todo-panel-group-arrow", text: "▾" });
      header.createSpan({ cls: "todo-panel-group-name", text: groupName(group) });
      header.createSpan({ cls: "todo-panel-group-count", text: String(groupTodos.length) });
      header.addEventListener("click", () => {
        if (this.collapsed.delete(group.path)) section.removeClass("is-collapsed");
        else {
          this.collapsed.add(group.path);
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
        if (dragged) await this.run(() => this.plugin.store.move(dragged, group.path, null));
      });

      const body = section.createDiv({ cls: "todo-panel-group-body" });
      for (const todo of groupTodos) this.renderTodo(body, list, todo, todos);
    }
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
      if (!dragged) return;
      if (dragged.group !== todo.group) {
        // Dropping onto a row of another group moves the todo there, next to that row.
        const siblings = todos.filter((t) => t.group === todo.group);
        const before = after ? siblings[siblings.indexOf(todo) + 1] ?? null : todo;
        await this.run(() => this.plugin.store.move(dragged, todo.group, before));
        return;
      }
      const order = todos.filter((t) => t !== dragged);
      order.splice(order.indexOf(todo) + (after ? 1 : 0), 0, dragged);
      await this.run(() => this.plugin.store.reorder(order));
    });

    const check = row.createEl("input", { attr: { type: "checkbox" } });
    check.checked = todo.done;
    check.addEventListener("change", () => this.run(() => this.plugin.store.setDone(todo, check.checked)));

    const text = row.createEl("span", {
      cls: "todo-panel-text",
      text: todo.title,
      attr: { contenteditable: "plaintext-only", spellcheck: "false" },
    });
    let cancelled = false;
    // While editing, tags show as `#tag` text after the title.
    text.addEventListener("focus", () => {
      if (!this.tagsOn) return;
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
      const tagsChanged = this.tagsOn && !sameTags(tags, this.visibleTags(todo));
      if (!title || (title === todo.title && !tagsChanged)) {
        this.render();
        return;
      }
      await this.run(() =>
        this.plugin.store.update(todo, {
          title: title !== todo.title ? title : undefined,
          tags: tagsChanged ? tags : undefined,
        })
      );
    });

    if (this.tagsOn && todo.tags.length) {
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
    del.addEventListener("click", () => this.run(() => this.plugin.store.remove(todo)));
  }
}
