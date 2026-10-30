import { App, Notice, PluginSettingTab, Setting, normalizePath } from "obsidian";
import type TodoPanelPlugin from "./main";
import { FileSuggest } from "./FileSuggest";
import { groupName } from "./groups";
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
      .setDesc("Base: one note per todo, listed in a Base file. Markdown: checkbox lines in one file per group.")
      .addDropdown((dd) =>
        dd
          .addOption("base", "Base (note per todo)")
          .addOption("markdown", "Markdown files")
          .setValue(settings.mode)
          .onChange(async (value) => {
            settings.mode = value as StorageMode;
            await this.plugin.saveSettings();
            this.display();
          })
      );

    new Setting(containerEl)
      .setName("Tags")
      .setDesc("Give todos any number of #tags, shown as colored labels. Type #tag when adding or editing a todo.")
      .addToggle((toggle) =>
        toggle.setValue(settings.tags).onChange(async (value) => {
          settings.tags = value;
          await this.plugin.saveSettings();
        })
      );

    if (settings.mode === "base") {
      new Setting(containerEl)
        .setName("Todo folder")
        .setDesc("Each todo is a note in this folder; a Base file lists them. Groups are not available in this mode.")
        .addText((text) =>
          text.setValue(settings.folder).onChange(async (value) => {
            settings.folder = value.trim() || DEFAULT_SETTINGS.folder;
            await this.plugin.saveSettings();
          })
        );
      return;
    }

    this.displayGroups(containerEl);
  }

  private displayGroups(containerEl: HTMLElement) {
    const settings = this.plugin.settings;
    new Setting(containerEl)
      .setName("Groups")
      .setDesc(
        "Each group is a markdown file in your vault; its checkbox lines are the todos. " +
          "The alias is only a display name. Removing a group keeps its file."
      )
      .setHeading();

    const move = async (from: number, to: number) => {
      const [group] = settings.groups.splice(from, 1);
      settings.groups.splice(to, 0, group);
      await this.plugin.saveSettings();
      this.display();
    };

    settings.groups.forEach((group, i) => {
      new Setting(containerEl)
        .setName(groupName(group))
        .setDesc(group.path)
        .addText((text) =>
          text
            .setPlaceholder("Alias")
            .setValue(group.alias ?? "")
            .onChange(async (value) => {
              group.alias = value.trim() || undefined;
              await this.plugin.saveSettings();
            })
        )
        .addExtraButton((b) =>
          b
            .setIcon("arrow-up")
            .setTooltip("Move up")
            .setDisabled(i === 0)
            .onClick(() => move(i, i - 1))
        )
        .addExtraButton((b) =>
          b
            .setIcon("arrow-down")
            .setTooltip("Move down")
            .setDisabled(i === settings.groups.length - 1)
            .onClick(() => move(i, i + 1))
        )
        .addExtraButton((b) =>
          b
            .setIcon("trash")
            .setTooltip("Remove group (keeps the file)")
            .setDisabled(settings.groups.length === 1)
            .onClick(async () => {
              settings.groups.splice(i, 1);
              await this.plugin.saveSettings();
              this.display();
            })
        );
    });

    let path = "";
    new Setting(containerEl)
      .setName("Add group")
      .setDesc("Pick an existing markdown file or type a new path; a new file is created with its first todo.")
      .addText((text) => {
        text.setPlaceholder("Projects/Home.md").onChange((value) => (path = value));
        new FileSuggest(this.app, text.inputEl, (file) => {
          path = file.path;
          text.setValue(file.path);
        });
      })
      .addButton((b) =>
        b
          .setButtonText("Add")
          .setCta()
          .onClick(async () => {
            let normalized = normalizePath(path.trim());
            if (!path.trim()) return;
            if (!/\.md$/i.test(normalized)) normalized += ".md";
            if (settings.groups.some((g) => normalizePath(g.path).toLowerCase() === normalized.toLowerCase())) {
              new Notice("That file is already a group.");
              return;
            }
            settings.groups.push({ path: normalized });
            await this.plugin.saveSettings();
            this.display();
          })
      );
  }
}
