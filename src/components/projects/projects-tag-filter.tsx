import { useEffect, useState } from 'react';

import { TagFilter } from '~/components/tag-filter';
import { normalizeTagKey } from '~/lib/project-tags';

export default function ProjectsTagFilter({
  tags,
  listSelector,
  emptySelector,
}: {
  tags: string[];
  listSelector: string;
  /** Element to reveal when the filter matches nothing. */
  emptySelector?: string;
}) {
  const [selectedTag, setSelectedTag] = useState<string | undefined>();

  useEffect(() => {
    const root = document.querySelector(listSelector);
    if (!root) return;

    const items = root.querySelectorAll<HTMLElement>('[data-project-tags]');
    const sel =
      selectedTag === undefined ? undefined : normalizeTagKey(selectedTag);
    const visible: HTMLElement[] = [];

    items.forEach((el) => {
      if (sel === undefined) {
        el.hidden = false;
      } else {
        const projectTags = (el.getAttribute('data-project-tags') ?? '')
          .split('|')
          .map((s) => s.trim())
          .filter(Boolean);
        el.hidden = !projectTags.some((t) => normalizeTagKey(t) === sel);
      }

      /*
       * The row rules key off these attributes rather than :first-child and
       * :last-child. A hidden element still matches those pseudo-classes, so
       * filtering out the first project left a stray divider under the filter
       * bar, and filtering out the last one lost the list's bottom padding.
       */
      el.removeAttribute('data-first-visible');
      el.removeAttribute('data-last-visible');
      if (!el.hidden) visible.push(el);
    });

    visible[0]?.setAttribute('data-first-visible', '');
    visible[visible.length - 1]?.setAttribute('data-last-visible', '');

    if (emptySelector) {
      const empty = document.querySelector(emptySelector);
      if (empty instanceof HTMLElement) empty.hidden = visible.length > 0;
    }
  }, [selectedTag, listSelector, emptySelector]);

  return (
    <TagFilter
      tags={tags}
      selectedTag={selectedTag}
      setSelectedTag={setSelectedTag}
    />
  );
}
