import { Plugin, normalizePath } from "obsidian";
import { BaseStore } from "./BaseStore";
import { MarkdownStore } from "./MarkdownStore";
import { TodoSettingTab } from "./TodoSettingTab";
import { TodoView } from "./TodoView";
import { DEFAULT_SETTINGS, VIEW_TYPE } from "./types";
import type { TodoSettings, TodoStore } from "./types";

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
