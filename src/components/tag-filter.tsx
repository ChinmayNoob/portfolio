import { CloseIcon } from '~/components/ui/icons';
import { cn } from '~/lib/utils';

export function TagFilter({
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

  if (tags.length === 0) return null;

  return (
    <div className="relative my-14 border-l pl-6 md:pl-8">
      <div className="absolute top-0 right-full mr-4 select-none">
        <span className="font-editorial text-text-2 -mx-1 inline-block rounded-md px-1 text-[1.05rem] leading-none tracking-[-0.01em]">
          Tags
        </span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-2">
        {tags.map((tag) => (
          <div key={tag} className="inline-block">
            <button
              type="button"
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
            type="button"
            className="text-text-2 hover:text-text-1 rounded-md p-1 transition"
            onClick={() => setSelectedTag(undefined)}
            aria-label="Clear tag filter"
          >
            <CloseIcon />
          </button>
        )}
      </div>
    </div>
  );
}
