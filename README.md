# Todo Panel

An [Obsidian](https://obsidian.md) plugin that adds a side panel with a simple todo list. Todos are checkbox lines in markdown files in your vault, so they stay plain text you can open, link and search like any other note.

## Features

- Side panel (right sidebar) with add, edit, check and delete
- Drag and drop to reorder
- **Groups**: every group is a markdown file in your vault, with an optional alias
- Optional **tags**, shown as colored labels
- Changes made outside the panel (editing a group file) show up in the panel, except while you are editing a todo there (it refreshes when you leave the field)

## Usage

Open the panel from the ribbon checkbox icon, or run **Open todo panel** from the command palette.

| Action | How |
| --- | --- |
| Add | Type in the input at the top and press Enter |
| Edit | Click the todo text, then Enter to save or Esc to cancel |
| Check | Tick the checkbox |
| Delete | Click the × that appears on hover (the line is removed from its file) |
| Reorder | Drag the `⋮⋮` handle and drop above or below another todo |
| Move to a group | Drag the handle onto another group's header (end of the group) or onto one of its todos |
| Tag | Type `#tag` in the add box or while editing a todo (when Tags is on) |

## Groups

A group is a markdown file in your vault; its `- [ ]` lines are the todos, and everything else in the file is left alone:

```markdown
- [ ] Buy milk
- [x] Call the dentist
```

Any `- [ ]` or `* [ ]` line counts as a todo, including indented sub-tasks and lines inside code blocks. Files with Windows (CRLF) line endings work too.

With more than one group the panel shows a collapsible header per group (in the order set in settings) and a group picker next to the add box. With a single group it shows a plain list.

The first group is created for you with the first free name from `Todos`, `Tasks`, `To-do`, `To do`, `Todo list`, `Task list`, `Checklist`, `Action items`, `Open tasks`, `Backlog` (`Todos.md`, `Tasks.md`, ...; if all are taken, `Todos 2.md`, `Todos 3.md`, ...), so it never clashes with an existing note. The name is saved in the settings, so it stays put once chosen. The file itself is created when you add the first todo. Add more groups in settings by picking an existing markdown file or typing a new path. A group shows its file name unless you give it an alias. Removing a group only removes it from the list; the file stays. Renaming or moving a group file, or a folder holding it, in Obsidian updates the group.

Reordering moves the task lines within a file. Moving a todo between groups moves its line from one file to the other: it is written to the target first, so a failure can't lose it (at worst it ends up in both).

Every change checks that the todo's line is still what the panel showed. If the file was edited in between, the change is refused with a notice and the panel refreshes, so an outdated list can never change another todo. Other failures, such as a file that can't be created, also show a notice.

## Tags

An optional setting. When on, todos can carry any number of `#tags`, shown as colored labels (the color comes from the tag name). Typing `#` in the add box suggests existing tags. While editing a todo its tags appear as `#tag` text after the title.

Tags are the `#tags` trailing the task line (`- [ ] Buy milk #home #errand`). With Tags off, tags in the file are left as they are and shown as part of the title.

## Settings

| Setting | Description |
| --- | --- |
| Tags | Allow `#tags` on todos |
| Settings button | Show a gear button next to the add box that opens these settings (off by default; handy while developing) |
| Groups | Group files with optional alias, order and removal, plus add |

Settings from earlier versions are upgraded on load: a single todo file becomes the first group, and group paths are normalised. The removed Base storage mode is ignored; todo notes it created stay in your vault untouched but are no longer shown.

## Installation

The plugin is not published to the community plugin list, so install it manually.

Requires Obsidian 1.4.10 or newer.

```bash
git clone <repo-url> obsidian-todo-panel
cd obsidian-todo-panel
npm install
npm run build
```

Then copy or symlink `manifest.json`, `main.js` and `styles.css` into `<vault>/.obsidian/plugins/todo-panel/`, and enable **Todo Panel** under Settings → Community plugins.

## Development

```bash
npm run dev     # rebuild on save
npm run build   # type-check and produce main.js
```

Source is in `src/` (`main.ts` is the plugin entry). With the files symlinked into your vault, reload Obsidian (Cmd/Ctrl+P → "Reload app without saving") to pick up a rebuild.

## Roadmap

Filtering by tag and prioritizing.
