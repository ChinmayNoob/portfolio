import { format } from 'date-fns';
import { useState } from 'react';
import { CloseIcon } from '~/components/ui/icons';
import type { PostData } from '~/lib/types';
import { cn } from '~/lib/utils';

interface PostListProps {
  posts: PostData[];
  tags: string[];
}

export default function PostList({ posts, tags }: PostListProps) {
  const [selectedTag, setSelectedTag] = useState<string | undefined>(undefined);

  const filteredPosts = selectedTag
    ? posts.filter((post) => post.data.tags?.includes(selectedTag))
    : posts;

  return (
    <>
      <TagFilter
        tags={tags}
        selectedTag={selectedTag}
        setSelectedTag={setSelectedTag}
      />
      <PostYearList posts={filteredPosts} />
    </>
  );
}

function TagFilter({
  tags,
  selectedTag,
  setSelectedTag,
}: {
  tags: string[];
  selectedTag?: string;
  setSelectedTag: (tag: string | undefined) => void;
}) {
  const hasSelected = selectedTag !== undefined;

  function handleSelectTag(tag: string) {
    if (hasSelected && selectedTag === tag) {
      setSelectedTag(undefined);
    } else {
      setSelectedTag(tag);
    }
  }

  return (
    <div className="relative my-14 border-l pl-5 md:pl-6">
      <div className="absolute top-0 -left-16 select-none md:-left-20">
        <span className="font-editorial text-text-2 -mx-1 inline-block rounded-md px-1 text-[1.05rem] leading-none tracking-[-0.01em]">
          Tags
        </span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-2">
        {tags.map((tag) => (
          <div key={tag} className="inline-block">
            <button
              className={cn(
                'link text-[1rem] leading-7 group-hover:opacity-60 hover:opacity-100!',
                hasSelected && selectedTag === tag && 'opacity-100!',
                hasSelected && selectedTag !== tag && 'opacity-40!',
              )}
              onClick={() => handleSelectTag(tag)}
            >
              {tag}
            </button>
          </div>
        ))}
        {hasSelected && (
          <button
            className="text-text-2 hover:text-text-1 rounded-md p-1 transition"
            onClick={() => setSelectedTag(undefined)}
          >
            <CloseIcon />
          </button>
        )}
      </div>
    </div>
  );
}

function PostYearList({ posts }: { posts: PostData[] }) {
  const yearList = Object.entries(
    posts.reduce<{ [year: string]: PostData[] }>((ac, post) => {
      const year = new Date(post.data.date).getFullYear();
      if (!ac[year]) ac[year] = [];
      ac[year].push(post);
      return ac;
    }, {}),
  ).sort(([yearA], [yearB]) => +yearB - +yearA);

  return (
    <div className="group my-14 space-y-10 border-l pl-5 md:pl-6">
      {yearList.map(([year, postList]) => {
        return (
          <div key={year} className="group/year relative">
            <div className="absolute top-0 -left-16 select-none md:-left-20">
              <h2 className="font-editorial text-text-2 group-hover/year:bg-gray-soft -mx-1 rounded-md px-1 text-[1.35rem] leading-none tracking-[-0.01em] transition group-hover:opacity-40 group-hover/year:opacity-100!">
                {year}
              </h2>
            </div>
            <ul className="flex flex-col items-start gap-3">
              {postList.map((post) => {
                return (
                  <li key={post.slug}>
                    <a
                      href={`/posts/${post.slug}`}
                      className="hover:bg-gray-soft -mx-1 flex items-baseline gap-3 rounded-md px-1 py-0.5 transition group-hover:opacity-60 hover:opacity-100!"
                    >
                      <span className="font-editorial text-text-1 max-w-[34rem] text-[1.35rem] leading-[1.15] tracking-[-0.01em]">
                        {post.data.title}
                      </span>
                      <span className="text-text-2 shrink-0 text-sm tabular-nums">
                        {format(new Date(post.data.date), 'MM. dd.')}
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
