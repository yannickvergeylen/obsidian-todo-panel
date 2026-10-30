import type { App } from "obsidian";
import type { TodoGroup } from "./types";

/** Candidate names for the first group, tried in order until one is free. */
export const DEFAULT_GROUP_NAMES = [
  "Todos",
  "Tasks",
  "To-do",
  "To do",
  "Todo list",
  "Task list",
  "Checklist",
  "Action items",
  "Open tasks",
  "Backlog",
];

/** A vault path for a new group that clashes with no file and no existing group. */
export function defaultGroupPath(app: App, taken: string[]) {
  const free = (path: string) => !taken.includes(path) && !app.vault.getAbstractFileByPath(path);
  for (const name of DEFAULT_GROUP_NAMES) {
    if (free(`${name}.md`)) return `${name}.md`;
  }
  for (let n = 2; ; n++) {
    if (free(`Todos ${n}.md`)) return `Todos ${n}.md`;
  }
}

export function groupName(group: TodoGroup) {
  return group.alias?.trim() || (group.path.split("/").pop() ?? group.path).replace(/\.md$/i, "");
}
