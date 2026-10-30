import { Plugin, normalizePath } from "obsidian";
import { BaseStore } from "./BaseStore";
import { MarkdownStore } from "./MarkdownStore";
import { TodoSettingTab } from "./TodoSettingTab";
import { TodoView } from "./TodoView";
import { defaultGroupPath } from "./groups";
import { DEFAULT_SETTINGS, VIEW_TYPE } from "./types";
import type { TodoSettings, TodoStore } from "./types";

export default class TodoPanelPlugin extends Plugin {
  settings: TodoSettings = DEFAULT_SETTINGS;
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

    // Keep a group pointing at its file when the file is renamed or moved.
    this.registerEvent(
      this.app.vault.on("rename", async (file, oldPath) => {
        const group = this.settings.groups.find((g) => normalizePath(g.path) === oldPath);
        if (!group) return;
        group.path = file.path;
        await this.saveSettings();
      })
    );
  }

  /** Loads settings, upgrading older versions (single `markdownFile`, `organize`). */
  private async loadSettings() {
    const data = (await this.loadData()) ?? {};
    const hasGroups = Array.isArray(data.groups);
    this.settings = {
      mode: data.mode ?? DEFAULT_SETTINGS.mode,
      folder: data.folder ?? DEFAULT_SETTINGS.folder,
      tags: data.tags ?? data.organize === "tags",
      groups: hasGroups ? data.groups : data.markdownFile ? [{ path: normalizePath(data.markdownFile) }] : [],
    };
    // Groups are always on: make sure there is a first one.
    if (!this.settings.groups.length) {
      this.settings.groups.push({ path: defaultGroupPath(this.app, []) });
    }
    if (!hasGroups) await this.saveData(this.settings);
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
    const { mode, folder, groups, tags } = this.settings;
    this.store =
      mode === "markdown"
        ? new MarkdownStore(
            this.app,
            groups.map((g) => normalizePath(g.path)),
            tags
          )
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
