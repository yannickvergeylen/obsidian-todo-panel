import { App, PluginSettingTab, Setting } from "obsidian";
import type TodoPanelPlugin from "./main";
import { DEFAULT_SETTINGS } from "./types";
import type { StorageMode } from "./types";

export class TodoSettingTab extends PluginSettingTab {
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
