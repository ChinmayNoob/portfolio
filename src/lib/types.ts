import { z } from 'astro:schema';

export interface SEO {
  title?: string;
  description?: string;
  ogImage?: string;
}

export const postSchema = z.object({
  title: z.string(),
  description: z.string(),
  date: z.coerce.date(),
  updatedDate: z.coerce.date().optional(),
  tags: z.array(z.string()).optional(),
  draft: z.boolean().optional(),
});
export type Post = z.infer<typeof postSchema>;

export const pageSchema = z.object({
  title: z.string(),
  description: z.string(),
  dateModified: z.coerce.date(),
  img: z.array(z.string()).optional(),
  imgAlt: z.string().optional(),
});
export type Page = z.infer<typeof pageSchema>;

export const bookSchema = z.object({
  title: z.string(),
  author: z.string(),
  coverUrl: z.string(),
  reviewUrl: z.union([z.string().url(), z.null()]).optional(),
});
export type Book = z.infer<typeof bookSchema>;

export const nowSchema = z.object({
  title: z.string(),
  date: z.coerce.date(),
});
export type NowEntry = z.infer<typeof nowSchema>;

export const zibaldoneSchema = z.object({
  month: z.string(),
});
export type ZibaldoneMonth = z.infer<typeof zibaldoneSchema>;

export const bookmarkItemSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  note: z.string().optional(),
});

export const bookmarkFolderSchema = z.object({
  name: z.string(),
  order: z.number(),
  bookmarks: z.array(bookmarkItemSchema),
});
export type BookmarkFolderData = z.infer<typeof bookmarkFolderSchema>;

export const projectSchema = z.object({
  title: z.string(),
  year: z.number().int(),
  description: z.string(),
  role: z.string(),
  technologies: z.string(),
  githubUrl: z.string().url().optional(),
  liveUrl: z.string().url().optional(),
  demoVideoUrl: z.string().url().optional(),
  image: z.string().optional(),
  imageAlt: z.string().optional(),
  status: z.string().optional(),
  tags: z.array(z.string()).optional(),
  sortOrder: z.number().optional(),
});
export type Project = z.infer<typeof projectSchema>;

// to not importing CollectionEntry from astro:content
export type PostData = {
  id: string;
  slug: string;
  body: string;
  collection: 'posts';
  data: Post;
};
