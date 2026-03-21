/** Lowercase key for deduping tags that differ only by case/whitespace. */
export function normalizeTagKey(tag: string): string {
  return tag.trim().toLowerCase();
}

/**
 * First-seen label wins per normalized key (stable order follows `projects` sort).
 */
export function buildCanonicalTagRegistry(
  projects: Array<{ project: { data: { tags?: string[] } } }>,
): Map<string, string> {
  const canonicalByKey = new Map<string, string>();
  for (const { project } of projects) {
    for (const t of project.data.tags ?? []) {
      const trimmed = t.trim();
      if (!trimmed) continue;
      const key = normalizeTagKey(trimmed);
      if (!canonicalByKey.has(key)) {
        canonicalByKey.set(key, trimmed);
      }
    }
  }
  return canonicalByKey;
}

/** Map each tag to the canonical label and drop duplicate keys. */
export function canonicalizeProjectTags(
  tags: string[] | undefined,
  registry: Map<string, string>,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags ?? []) {
    const trimmed = t.trim();
    if (!trimmed) continue;
    const key = normalizeTagKey(trimmed);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(registry.get(key) ?? trimmed);
  }
  return out;
}
