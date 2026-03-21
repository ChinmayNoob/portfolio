import { defineCollection } from 'astro:content';
import {
  bookSchema,
  bookmarkFolderSchema,
  nowSchema,
  pageSchema,
  postSchema,
  projectSchema,
  zibaldoneSchema,
} from '~/lib/types';

const postsCollection = defineCollection({
  type: 'content',
  schema: postSchema,
});

const pagesCollection = defineCollection({
  type: 'content',
  schema: pageSchema,
});

const booksCollection = defineCollection({
  type: 'content',
  schema: bookSchema,
});

const nowCollection = defineCollection({
  type: 'content',
  schema: nowSchema,
});

const zibaldoneCollection = defineCollection({
  type: 'content',
  schema: zibaldoneSchema,
});

const bookmarksCollection = defineCollection({
  type: 'data',
  schema: bookmarkFolderSchema,
});

const blogrollCollection = defineCollection({
  type: 'content',
  schema: pageSchema,
});

const projectsCollection = defineCollection({
  type: 'content',
  schema: projectSchema,
});

export const collections = {
  posts: postsCollection,
  pages: pagesCollection,
  books: booksCollection,
  now: nowCollection,
  zibaldone: zibaldoneCollection,
  bookmarks: bookmarksCollection,
  blogroll: blogrollCollection,
  projects: projectsCollection,
};
