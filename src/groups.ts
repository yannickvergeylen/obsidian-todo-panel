import type { App } from "obsidian";
import type { TodoGroup } from "./types";

/** The first free vault path among `todo.md`, `todo 2.md`, `todo 3.md`, ... (ignoring case). */
export function defaultGroupPath(app: App) {
  const taken = new Set(app.vault.getAllLoadedFiles().map((f) => f.path.toLowerCase()));
  for (let n = 1; ; n++) {
    const path = n === 1 ? "todo.md" : `todo ${n}.md`;
    if (!taken.has(path)) return path;
  }
}

export function groupName(group: TodoGroup) {
  return group.alias?.trim() || (group.path.split("/").pop() ?? group.path).replace(/\.md$/i, "");
}
