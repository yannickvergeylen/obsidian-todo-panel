# Todo Panel

An [Obsidian](https://obsidian.md) plugin that adds a side panel with a simple todo list. Todos are stored in your vault, either as notes listed by an Obsidian Base or as checkbox lines in a single markdown file.

## Features

- Side panel (right sidebar) with add, edit, check and delete
- Drag and drop to reorder
- Two storage modes, switchable in settings:
  - **Base**: one note per todo, listed in a generated `Todos.base`
  - **Markdown files**: `- [ ] task` lines, one file per group
- **Groups** (Markdown mode): every group is a file in your vault, with an optional alias
- Optional **tags**, shown as colored labels
- Changes made outside the panel (editing the file, the Base, or the notes) show up in the panel

## Usage

Open the panel from the ribbon checkbox icon, or run **Open todo panel** from the command palette.

| Action | How |
| --- | --- |
| Add | Type in the input at the top and press Enter |
| Edit | Click the todo text, then Enter to save or Esc to cancel |
| Check | Tick the checkbox |
| Delete | Click the × that appears on hover (Base mode moves the note to trash) |
| Reorder | Drag the `⋮⋮` handle and drop above or below another todo |
| Move to a group | Drag the handle onto another group's header (end of the group) or onto one of its todos |
| Tag | Type `#tag` in the add box or while editing a todo (when Tags is on) |

## Groups

Groups are available with Markdown storage and are always on. A group is a markdown file in your vault; its `- [ ]` lines are the todos, and everything else in the file is left alone. With more than one group the panel shows a collapsible header per group (in the order set in settings) and a group picker next to the add box.

The first group is created for you with the first free name from `Todos`, `Tasks`, `To-do`, `To do`, `Todo list`, `Task list`, `Checklist`, `Action items`, `Open tasks`, `Backlog` (`Todos.md`, `Tasks.md`, ...), so it never clashes with an existing note. The file itself is created when you add the first todo. Add more groups in settings by picking an existing markdown file or typing a new path. A group shows its file name unless you give it an alias. Removing a group only removes it from the list; the file stays. Renaming or moving a group file in Obsidian updates the group.

Moving a todo between groups moves its line from one file to the other.

## Tags

An optional setting. When on, todos can carry any number of `#tags`, shown as colored labels (the color comes from the tag name). Typing `#` in the add box suggests existing tags. While editing a todo its tags appear as `#tag` text after the title.

Tags are stored as the `tags` property in Base mode and as trailing `#tags` on the task line in Markdown mode (`- [ ] Buy milk #home #errand`). With Tags off, tags in the file are left as they are and shown as part of the title in Markdown mode.

## Storage modes

### Base (default)

Each todo is a note in the todo folder (default `Todos/`) with these properties:

```yaml
---
title: "Buy milk"
done: false
created: 1761750000000
order: 1761750000000
---
```

The first time you add a todo, the plugin creates `Todos/Todos.base`, a table view of the folder sorted by `order`. An existing `Todos.base` is never overwritten. If you want it sorted by order, add a sort on `note.order` ascending, or delete it so it gets recreated.

### Markdown files

Todos live in one file per group (see Groups), for example `Todos.md`:

```markdown
- [ ] Buy milk
- [x] Call the dentist
```

Reordering moves the task lines. Other content in the file is left alone.

Switching modes does not convert anything; each mode keeps its own todos.

## Settings

| Setting | Description |
| --- | --- |
| Storage | Base or Markdown files |
| Tags | Allow `#tags` on todos |
| Todo folder | Folder for todo notes (Base mode, default `Todos`) |
| Groups | Group files with optional alias, order and removal, plus add (Markdown mode) |

## Installation

The plugin is not published to the community plugin list, so install it manually.

Requires Obsidian 1.9.0 or newer (Bases support).

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

## Known limitations

- Drag and drop uses desktop drag events and likely doesn't work on touch devices
- Groups are not available in Base mode
- No filtering or priorities yet

## Roadmap

Filtering by tag and prioritizing. Because todos are notes with properties in Base mode, these can be added as extra properties.
