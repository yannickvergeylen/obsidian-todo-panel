/**
 * Tags are todo.txt `@context` words: `@` plus non-space characters, preceded by whitespace, anywhere in
 * the line. They are deliberately not Obsidian's `#tags`, so they stay out of the vault's tag list.
 */
export const TAG_MARKER = "@";

// The lead whitespace keeps `me@example.com` from counting as a tag. A tag runs up to whitespace or the end
// and can't contain `@`, a backtick, `]` or `)`: an `@word` right before a link's or code span's closing is
// not a tag. This is only a rough guard; links and code spans are not parsed, so an `@word` elsewhere inside
// one still counts.
// The lead whitespace run is consumed whole, so removing a tag leaves the rest of the whitespace untouched.
// The lookbehind makes a match start at the beginning of a run (otherwise long runs backtrack quadratically).
const TAG_ANYWHERE = new RegExp(`(?<!\\s)(^|\\s+)${TAG_MARKER}([^\\s${TAG_MARKER}\`\\])]+)(?=\\s|$)`, "gu");

/** Cleans tag values: drops empties and case-insensitive duplicates, keeping the first spelling. */
export function normalizeTags(raw: string[]): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const value of raw) {
    const tag = value.trim();
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }
  return tags;
}

/** Splits text into a title and its `@tags`. */
export function parseInput(text: string) {
  const found: string[] = [];
  const stripped = text.replace(TAG_ANYWHERE, (_match, _lead: string, tag: string) => {
    found.push(tag);
    return "";
  });
  return { title: stripped.trim(), tags: normalizeTags(found) };
}

/** Like `parseInput`, for a line already in a file: a line made only of tags keeps them as its title. */
export function splitTags(text: string) {
  const { title, tags } = parseInput(text);
  return title ? { title, tags } : { title: text.trim(), tags: [] as string[] };
}

export function joinTags(title: string, tags: string[]) {
  return tags.length ? `${title} ${tags.map((t) => `${TAG_MARKER}${t}`).join(" ")}` : title;
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

/** `#rrggbb` for an HSL color (h 0–359, s and l 0–100). */
export function hslToHex(h: number, s: number, l: number) {
  const sat = s / 100;
  const light = l / 100;
  const a = sat * Math.min(light, 1 - light);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    return light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return `#${[channel(0), channel(8), channel(4)]
    .map((c) => Math.round(c * 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

/**
 * The color a tag label shows without a user choice, as hex for color pickers. Matches `.todo-panel-tag`
 * in styles.css (keep the two in sync).
 */
export function defaultTagColor(tag: string, dark: boolean) {
  return dark ? hslToHex(tagHue(tag), 70, 72) : hslToHex(tagHue(tag), 55, 38);
}
