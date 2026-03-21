import { useEffect, useState } from 'react';

import { TagFilter } from '~/components/tag-filter';
import { normalizeTagKey } from '~/lib/project-tags';

export default function ProjectsTagFilter({
  tags,
  listSelector,
}: {
  tags: string[];
  listSelector: string;
}) {
  const [selectedTag, setSelectedTag] = useState<string | undefined>();

  useEffect(() => {
    const root = document.querySelector(listSelector);
    if (!root) return;
    const items = root.querySelectorAll<HTMLElement>('[data-project-tags]');
    items.forEach((el) => {
      const raw = el.getAttribute('data-project-tags') ?? '';
      const projectTags = raw
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean);
      if (selectedTag === undefined) {
        el.hidden = false;
        return;
      }
      const sel = normalizeTagKey(selectedTag);
      el.hidden = !projectTags.some((t) => normalizeTagKey(t) === sel);
    });
  }, [selectedTag, listSelector]);

  return (
    <TagFilter
      tags={tags}
      selectedTag={selectedTag}
      setSelectedTag={setSelectedTag}
    />
  );
}
