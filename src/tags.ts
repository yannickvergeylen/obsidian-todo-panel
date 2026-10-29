// A tag needs at least one non-digit character, like in Obsidian (`#123` is not a tag).
const TAG = "[\\p{L}\\p{N}_\\-/]*[\\p{L}_\\-/][\\p{L}\\p{N}_\\-/]*";
const TAG_ANYWHERE = new RegExp(`(^|\\s)#(${TAG})`, "gu");
const TAG_AT_END = new RegExp(`(?:^|\\s+)#(${TAG})$`, "u");

/** Cleans raw tag values: strips `#`, drops empties and case-insensitive duplicates. */
export function normalizeTags(raw: unknown): string[] {
  const values = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/[,\s]+/) : [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const value of values) {
    const tag = String(value).trim().replace(/^#/, "");
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }
  return tags;
}

/** Splits typed text into a title and its `#tags`, keeping at most `maxTags`. */
export function parseInput(text: string, maxTags: number) {
  const found: string[] = [];
  const stripped = text.replace(TAG_ANYWHERE, (_match, lead: string, tag: string) => {
    found.push(tag);
    return lead;
  });
  const title = found.length ? stripped.replace(/\s+/g, " ").trim() : text.trim();
  return { title, tags: normalizeTags(found).slice(0, maxTags) };
}

/** Splits a markdown task's text into its title and the `#tags` trailing it. */
export function splitTrailingTags(text: string) {
  let rest = text.trimEnd();
  const tags: string[] = [];
  for (let m = TAG_AT_END.exec(rest); m; m = TAG_AT_END.exec(rest)) {
    tags.unshift(m[1]);
    rest = rest.slice(0, m.index);
  }
  // A line made only of tags keeps them as its title.
  if (!rest.trim()) return { title: text, tags: [] as string[] };
  return { title: rest, tags: normalizeTags(tags) };
}

export function joinTags(title: string, tags: string[]) {
  return tags.length ? `${title} ${tags.map((t) => `#${t}`).join(" ")}` : title;
}

export function sameTags(a: string[], b: string[]) {
  return a.length === b.length && a.every((t, i) => t.toLowerCase() === b[i].toLowerCase());
}

/** A stable hue (0–359) for a tag, so the same tag always gets the same color. */
export function tagHue(tag: string) {
  let hash = 0;
  for (const ch of tag.toLowerCase()) hash = (hash * 31 + ch.codePointAt(0)!) % 360;
  return hash;
}
