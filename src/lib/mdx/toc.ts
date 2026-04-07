import GithubSlugger from 'github-slugger';

export type TocSection = {
  slug: string;
  value: string;
  depth: number;
};

export function getTableOfContents(content: string) {
  // Match `rehype-slug`'s heading id generation (GitHub-style slugs, with de-duping).
  const slugger = new GithubSlugger();
  const headings = content
    .split('\n')
    .filter((line) => line.match(/^#{1,3}\s/))
    .map((heading) => {
      const level = heading.match(/^#{1,3}/)?.[0].length || 0;
      const text = heading.replace(/^#+\s/, '');
      return {
        slug: slugger.slug(text),
        depth: level,
        value: text,
      } satisfies TocSection;
    });

  return headings;
}
