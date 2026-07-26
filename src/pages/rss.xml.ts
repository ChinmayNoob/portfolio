import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { cfg } from '~/cfg';
import { getPostsCollection } from '~/lib/mdx/post';

export const GET: APIRoute = async () => {
  const postList = await getPostsCollection();

  return rss({
    title: cfg.title,
    description: cfg.description,
    site: cfg.siteUrl,
    stylesheet: '/rss/styles.xsl',
    customData: '<language>en-us</language>',
    items: postList.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.date,
      link: `/posts/${post.slug}`,
      categories: post.data.tags ?? [],
    })),
  });
};
