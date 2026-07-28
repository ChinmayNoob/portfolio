import type { LifelineLegendItem } from "./types"

/*
 * These are CSS classes rather than Tailwind colour utilities because
 * theme.css removes the stock palettes — `bg-blue-500` and `bg-pink-500`
 * generate nothing, which left both dots invisible.
 */
const LEGEND_DOT_CLASS: Record<LifelineLegendItem["type"], string> = {
  mentor: "lifeline-dot-mentor",
  met: "lifeline-dot-met",
}

const DEFAULT_ITEMS: LifelineLegendItem[] = [
  { type: "mentor", label: "Mentors" },
  { type: "met", label: "Met in person" },
]

export function LifelineLegend({
  items = DEFAULT_ITEMS,
}: {
  items?: LifelineLegendItem[]
}) {
  return (
    <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-text-3">
      {items.map((item) => (
        <li key={item.type} className="flex items-center gap-2">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${LEGEND_DOT_CLASS[item.type]}`}
            aria-hidden="true"
          />
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  )
}
