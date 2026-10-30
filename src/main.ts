import { Plugin, normalizePath } from "obsidian";
import { MarkdownStore } from "./MarkdownStore";
import { TodoSettingTab } from "./TodoSettingTab";
import { TodoView } from "./TodoView";
import { defaultGroupPath } from "./groups";
import { VIEW_TYPE } from "./types";
import type { TodoGroup, TodoSettings, TodoStore } from "./types";

export default class TodoPanelPlugin extends Plugin {
  settings!: TodoSettings;
  store!: TodoStore;

  async onload() {
    await this.loadSettings();
    this.updateStore();

    this.registerView(VIEW_TYPE, (leaf) => new TodoView(leaf, this));
    this.addRibbonIcon("check-square", "Open todo panel", () => this.activateView());
    this.addCommand({
      id: "open-todo-panel",
      name: "Open todo panel",
      callback: () => this.activateView(),
    });
    this.addSettingTab(new TodoSettingTab(this.app, this));

    // Keep groups pointing at their files when a file, or a folder holding them, is renamed or moved.
    this.registerEvent(
      this.app.vault.on("rename", async (file, oldPath) => {
        let changed = false;
        for (const group of this.settings.groups) {
          const path = normalizePath(group.path);
          if (path === oldPath || path.startsWith(`${oldPath}/`)) {
            group.path = file.path + path.slice(oldPath.length);
            changed = true;
          }
        }
        if (changed) await this.saveSettings();
      })
    );
  }

  /** Loads settings, upgrading older versions (single `markdownFile`, `organize`, Base `mode`). */
  private async loadSettings() {
    const data = (await this.loadData()) ?? {};
    const hasGroups = Array.isArray(data.groups);
    const stored: unknown[] = hasGroups ? data.groups : data.markdownFile ? [{ path: data.markdownFile }] : [];
    const groups: TodoGroup[] = [];
    for (const entry of stored as Partial<TodoGroup>[]) {
      if (typeof entry?.path !== "string" || !entry.path.trim()) continue;
      const path = normalizePath(entry.path);
      // Duplicate paths would give duplicate todo ids.
      if (groups.some((g) => g.path === path)) continue;
      groups.push({
        path,
        alias: typeof entry.alias === "string" ? entry.alias : undefined,
        collapsed: entry.collapsed === true ? true : undefined,
      });
    }
    // Groups are always on: make sure there is a first one.
    const addedDefault = !groups.length;
    // Only the name is chosen here; the file is created when the first todo is added.
    if (addedDefault) groups.push({ path: defaultGroupPath(this.app) });

    // No prototype, so tags named like `constructor` or `__proto__` are ordinary keys.
    const tagColors: Record<string, string> = Object.create(null);
    for (const [tag, color] of Object.entries(data.tagColors ?? {})) {
      if (typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color)) tagColors[tag.toLowerCase()] = color;
    }

    this.settings = {
      tags: data.tags ?? data.organize === "tags",
      tagColors,
      showSettingsButton: data.showSettingsButton === true,
      groups,
    };
    // Persist the default so its name stays put once its file exists.
    if (!hasGroups || addedDefault || groups.length !== stored.length) await this.saveData(this.settings);
  }

  /** Opens Obsidian's settings on this plugin's tab (`app.setting` is not in the public typings). */
  openSettings() {
    const { setting } = this.app as unknown as { setting: { open(): void; openTabById(id: string): void } };
    setting.open();
    setting.openTabById(this.manifest.id);
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
    const { groups, tags } = this.settings;
    this.store = new MarkdownStore(
      this.app,
      groups.map((g) => normalizePath(g.path)),
      tags
    );
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      // Background tabs may hold a lazy-loaded placeholder instead of the view.
      if (leaf.view instanceof TodoView) leaf.view.render();
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.updateStore();
  }
}
