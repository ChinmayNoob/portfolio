import { getCollection, type CollectionEntry } from 'astro:content';
import { compareTwoStrings } from '~/lib/dice-coefficient';
import { isProd } from '~/lib/utils';

export const isDraft = (post: CollectionEntry<'posts'>) => {
  return isProd && post.data.draft;
};

export const sortCollectionDateDesc = (
  a: CollectionEntry<'posts'>,
  b: CollectionEntry<'posts'>,
) => {
  return new Date(b.data.date).valueOf() - new Date(a.data.date).valueOf();
};

export const getPostsCollection = async () => {
  return (await getCollection('posts'))
    .filter((post) => !isDraft(post))
    .sort(sortCollectionDateDesc);
};

export const getRelatedPosts = (
  post: CollectionEntry<'posts'>,
  postList: CollectionEntry<'posts'>[],
) => {
  return postList
    .filter((p) => p.slug !== post.slug)
    .map((p) => {
      const tagPoint = post.data.tags
        ? post.data.tags.filter((tag) => p.data.tags?.includes(tag)).length
        : 0;
      const titlePoint = compareTwoStrings(post.data.title, p.data.title);
      return {
        post: p,
        similarity: tagPoint + 3.0 * titlePoint,
      };
    })
    .toSorted((a, b) => b.similarity - a.similarity)
    .map((p) => p.post)
    .filter((p): p is CollectionEntry<'posts'> => p != null && p.data != null)
    .slice(0, 4);
};

export const getTags = (postList: CollectionEntry<'posts'>[]) => {
  return [
    ...new Set(
      postList
        .map((post) => post.data.tags)
        .flat()
        .filter((post): post is string => Boolean(post))
        .toSorted(),
    ),
  ];
};

/**
 * The image to represent a post visually.
 *
 * Prefers an explicit `image` in frontmatter; otherwise falls back to the
 * first image in the body, so existing posts get a lead image with no edits.
 * Returns null for posts that have neither.
 */
export const postLeadImage = (post: CollectionEntry<'posts'>) => {
  if (post.data.image) {
    return { src: post.data.image, alt: post.data.imageAlt ?? '' };
  }

  const body = post.body ?? '';
  // ![alt](/path "optional title")
  const markdown = body.match(/!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?[^)]*\)/);
  if (markdown) return { src: markdown[2], alt: markdown[1] };

  // <img src="/path" alt="..."> — MDX posts sometimes use raw tags
  const html = body.match(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/i);
  if (html) {
    const alt = html[0].match(/\balt=["']([^"']*)["']/i);
    return { src: html[1], alt: alt?.[1] ?? '' };
  }

  return null;
};
