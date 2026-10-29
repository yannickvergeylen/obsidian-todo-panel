# Todo Panel

An [Obsidian](https://obsidian.md) plugin that adds a side panel with a simple todo list. Todos are stored in your vault, either as notes listed by an Obsidian Base or as checkbox lines in a single markdown file.

## Features

- Side panel (right sidebar) with add, edit, check and delete
- Drag and drop to reorder
- Two storage modes, switchable in settings:
  - **Base**: one note per todo, listed in a generated `Todos.base`
  - **Markdown file**: one file with `- [ ] task` lines
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

### Markdown file

All todos live in one file (default `Todos.md`):

```markdown
- [ ] Buy milk
- [x] Call the dentist
```

Reordering moves the task lines. Other content in the file is left alone.

Switching modes does not convert anything; each mode keeps its own todos.

## Settings

| Setting | Description |
| --- | --- |
| Storage | Base or Markdown file |
| Todo folder | Folder for todo notes (Base mode, default `Todos`) |
| Todo file | Path of the markdown file (Markdown mode, default `Todos.md`) |

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

Source is in `src/main.ts`. With the files symlinked into your vault, reload Obsidian (Cmd/Ctrl+P → "Reload app without saving") to pick up a rebuild.

## Known limitations

- Drag and drop uses desktop drag events and likely doesn't work on touch devices
- No tags, priorities or grouping yet

## Roadmap

Prioritizing, tagging and grouping. Because todos are notes with properties in Base mode, these can be added as extra properties.
