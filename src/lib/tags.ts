// Text tags from external channels (and hand-typed on forms): free labels
// stored at document and line level. This is deliberately dumb storage,
// nothing branches on a tag; normalisation just keeps the chips tidy.

const MAX_TAGS = 20;
const MAX_LENGTH = 40;

/**
 * Trim, drop empties, clip absurd lengths, dedupe case-insensitively while
 * keeping the first spelling, cap the count. Accepts a ready array or a
 * comma-separated string (what a form field sends).
 */
export function normalizeTags(input: unknown): string[] {
  const raw: unknown[] = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(",")
      : [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const value of raw) {
    if (typeof value !== "string") continue;
    const tag = value.trim().slice(0, MAX_LENGTH);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length >= MAX_TAGS) break;
  }
  return tags;
}
