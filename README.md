# Todo Panel

*All your project todo lists in one sidebar panel, and still just markdown.*

An [Obsidian](https://obsidian.md) plugin that adds a side panel with your todo lists. Every list is a markdown file in your vault, so your todos stay plain text you can open, link and search like any other note. The panel is a convenient way to work with them: check things off, reorder by dragging, move a todo from one list to another, and tag them, without leaving the note you are in.

## Why this exists

I use Obsidian as my second brain, and I keep a todo list in it for each of my projects. Switching between those files just to check something off got annoying, and some things I wanted, like easy reordering, were missing. Other apps offer them, but I like having one "brain space", and for me that is Obsidian.

So I built this: a panel that pulls the todos out of the files and puts them side by side, with a bit of flexibility the files alone don't give you. Once I had started, adding features became a natural habit.

## Features

- Side panel (right sidebar) with add, edit, check and delete
- Drag and drop to reorder
- **Groups**: every group is a markdown file in your vault, with an optional alias
- Optional **tags** (`@tag`, todo.txt style), shown as colored labels with colors you can choose in settings
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
| Tag | Type `@tag` in the add box or while editing a todo (when Tags feature setting is on) |

## Todo format

For now I'm planning to follow the [todo.txt](https://github.com/todotxt/todo.txt) conventions where they apply:

- `@context` words anywhere in a line are the todo's tags (see Tags)
- Other todo.txt elements, such as `(A)` priorities, `+project` words, dates and `key:value` pairs, are not interpreted yet; they stay plain text in the title
- Completion uses the markdown checkbox (`- [x]`) instead of todo.txt's leading `x `

## Groups

Each group is a markdown file in your vault. Its `- [ ]` lines are the todos, and everything else in the file is left alone:

```markdown
- [ ] Buy milk
- [x] Call the dentist
```

Any `- [ ]` or `* [ ]` line counts as a todo, including indented sub-tasks and lines inside code blocks. Files with Windows (CRLF) line endings work too.

With more than one group the panel shows a collapsible header per group (the order can be changed in settings) and a group picker next to the add box. With a single group it shows a plain list. Clicking a header collapses or expands the group, and the panel remembers that across restarts: the state is saved in the plugin settings (not in your files), so it syncs wherever the settings do.

On first run the plugin sets up the first group for you: `todo.md` in the root of your vault, or `todo 2.md`, `todo 3.md`, ... if the name is taken (ignoring case), so it never clashes with an existing note. The name is saved in the settings, so it stays put once chosen. The file itself is only created when you add your first todo, so nothing is added to your vault before you use the plugin. Add more groups in settings by picking an existing markdown file or typing a new path. A group shows its file name unless you give it an alias. Removing a group only removes it from the list; the file stays. Renaming or moving a group file, or a folder holding it, in Obsidian updates the group.

## Tags

An optional setting. When on, todos can carry any number of `@tags`, shown as colored labels. Typing `@` in the add box suggests existing tags. While editing a todo its tags appear as `@tag` text after the title.

They are deliberately not Obsidian's `#tags`: they don't show up in the tag pane, search or graph, so todo tags can't clutter your note tags. A `#word` in a todo is just text, and `#tags` in existing lines are not converted. With Tags off, `@tags` in the file are left as they are and shown as part of the title.

### Tag colors

With Tags on, the settings list every tag found in your group files with the number of todos using it, a color picker and a reset button. A tag without a chosen color gets one derived from its name (adapted to the light or dark theme). Chosen colors are kept in the plugin settings, keyed by tag name (case-insensitive), not in your files.

A tag whose color you set but that no todo uses any more stays in the list, marked "Not used by any todo". Its reset button becomes a trash button that removes the color.

## Settings

| Setting | Description |
| --- | --- |
| Tags | Allow `@tags` on todos |
| Tag colors | A color per tag found in your files (shown when Tags is on) |
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
