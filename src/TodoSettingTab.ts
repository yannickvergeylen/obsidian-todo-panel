import { App, ExtraButtonComponent, Notice, PluginSettingTab, Setting, debounce, normalizePath } from "obsidian";
import type TodoPanelPlugin from "./main";
import { FileSuggest } from "./FileSuggest";
import { groupName } from "./groups";
import { TAG_MARKER, defaultTagColor } from "./tags";

export class TodoSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: TodoPanelPlugin) {
    super(app, plugin);
  }

  /** Id of the latest `display()`; the async tag list drops its result if a newer one started. */
  private displayId = 0;

  display() {
    const { containerEl } = this;
    const settings = this.plugin.settings;
    const displayId = ++this.displayId;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Tags")
      .setDesc(
        "Give todos any number of @tags (todo.txt style), shown as colored labels. Type @tag when adding or editing a todo. " +
          "Obsidian does not treat @tags as note tags."
      )
      .addToggle((toggle) =>
        toggle.setValue(settings.tags).onChange(async (value) => {
          settings.tags = value;
          await this.plugin.saveSettings();
          this.display(); // shows or hides the tag colors
        })
      );

    new Setting(containerEl)
      .setName("Settings button")
      .setDesc("Show a gear button next to the add box that opens these settings.")
      .addToggle((toggle) =>
        toggle.setValue(settings.showSettingsButton).onChange(async (value) => {
          settings.showSettingsButton = value;
          await this.plugin.saveSettings();
        })
      );

    this.displayGroups(containerEl);
    if (settings.tags) {
      this.displayTagColors(containerEl, displayId).catch((err) => new Notice(`Could not list tags: ${err}`));
    }
  }

  /** Lists the tags found in the group files, each with a color picker. */
  private async displayTagColors(containerEl: HTMLElement, displayId: number) {
    const settings = this.plugin.settings;
    const todos = await this.plugin.store.list();
    // The settings may have been redrawn while the files were read.
    if (displayId !== this.displayId) return;

    // Tag key (lowercase) -> display name and the number of todos using it.
    const tags = new Map<string, { name: string; count: number }>();
    for (const todo of todos) {
      for (const tag of todo.tags) {
        const entry = tags.get(tag.toLowerCase()) ?? { name: tag, count: 0 };
        entry.count++;
        tags.set(tag.toLowerCase(), entry);
      }
    }
    // Keep tags whose color was set but that no todo uses (any more), so the color can be removed.
    for (const key of Object.keys(settings.tagColors)) if (!tags.has(key)) tags.set(key, { name: key, count: 0 });

    new Setting(containerEl)
      .setName("Tag colors")
      .setDesc(
        "Colors for the @tags in your group files, with the number of todos using each. " +
          "Tags without a choice get a color derived from their name; the color of a tag no todo uses can be removed."
      )
      .setHeading();
    if (!tags.size) {
      containerEl.createEl("p", { text: "No tags yet.", cls: "setting-item-description" });
      return;
    }

    // The picker reports every step of a drag; save once it settles.
    const saveSettled = debounce(() => this.plugin.saveSettings(), 300, true);
    const dark = containerEl.doc.body.hasClass("theme-dark");
    for (const [key, { name, count }] of [...tags].sort(([a], [b]) => a.localeCompare(b))) {
      let reset: ExtraButtonComponent;
      // Only a tag that no todo uses is removed from the list; a used one just goes back to its default color.
      const unused = count === 0;
      new Setting(containerEl)
        .setName(`${TAG_MARKER}${name}`)
        .setDesc(unused ? "Not used by any todo" : `${count} ${count === 1 ? "todo" : "todos"}`)
        .addColorPicker((picker) =>
          picker.setValue(settings.tagColors[key] ?? defaultTagColor(name, dark)).onChange((value) => {
            settings.tagColors[key] = value;
            reset.setDisabled(false);
            saveSettled();
          })
        )
        .addExtraButton((button) => {
          reset = button;
          button
            .setIcon(unused ? "trash" : "rotate-ccw")
            .setTooltip(unused ? "Remove this color" : "Reset to the default color")
            .setDisabled(!(key in settings.tagColors))
            .onClick(async () => {
              delete settings.tagColors[key];
              await this.plugin.saveSettings();
              this.display();
            });
        });
    }
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
            if (!path.trim()) return;
            let normalized = normalizePath(path.trim());
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
