import { forwardRef, type CSSProperties } from "react"
import { Film, Image as ImageIcon } from "lucide-react"
import { cn } from "~/lib/utils"
import { CompanyIcon } from "./company-icon"
import {
  getLifelineEventEffect,
  getLifelineEventImage,
  getLifelineEventKey,
  LifelineEventText,
} from "./lifeline-event"
import { useLifelineFireworks } from "./lifeline-fireworks"
import { useLifelineHoverImage } from "./lifeline-hover-image"
import { aggregateLifelinePeople, LifelinePeople } from "./lifeline-people"
import type { LifelineMarker } from "./types"

interface LifelineMarkerColumnProps {
  marker: LifelineMarker
  birthYear: number
  minWidth: number
  animateIntro?: boolean
  introDelay?: number
  introDuration?: number
}

export const LifelineMarkerColumn = forwardRef<
  HTMLDivElement,
  LifelineMarkerColumnProps
>(function LifelineMarkerColumn(
  {
    marker,
    birthYear,
    minWidth,
    animateIntro = false,
    introDelay = 0,
    introDuration = 420,
  },
  ref,
) {
  const age = marker.age ?? marker.year - birthYear
  const people = aggregateLifelinePeople(marker)
  const hoverImage = useLifelineHoverImage()
  const fireworks = useLifelineFireworks()

  return (
    <div
      ref={ref}
      // `will-change-[opacity]`, not `will-change-opacity` — the latter is not
      // a Tailwind utility and generated nothing, so the per-frame opacity
      // writes during a scrub were never promoted off the main raster path.
      className="group relative shrink-0 pr-8 transition-opacity duration-300 ease-out will-change-[opacity]"
      style={{ width: minWidth }}
      aria-label={marker.label ?? `${marker.year}`}
    >
      <div
        className={cn("relative", animateIntro && "lifeline-marker-intro")}
        style={{
          animationDelay: animateIntro ? `${introDelay}ms` : undefined,
          ...(animateIntro
            ? ({
                "--lifeline-marker-fade-ms": `${introDuration}ms`,
              } as CSSProperties)
            : {}),
        }}
      >
        <span
          className="absolute left-0 top-[var(--lifeline-rail)] z-10 h-[10px] w-px -translate-y-1/2 bg-border transition-colors duration-300 group-hover:bg-text-2"
          aria-hidden="true"
        />

        <div className="flex w-full flex-col items-start text-left">
          <p className="mb-5 h-4 text-[11px] font-medium leading-4 tabular-nums text-text-3 transition-colors duration-300 group-hover:text-text-2">
            {age}
          </p>

          {/* The years carry the site's display face — it's the one place the
              timeline gets to sound like the rest of the portfolio. */}
          <p className="mb-6 h-5 whitespace-nowrap font-editorial text-[19px] font-semibold leading-5 text-text-2 transition-colors duration-300 group-hover:text-text-1">
            {marker.label ?? marker.year}
          </p>

          <div className="relative w-full pb-10 text-text-3 transition-colors duration-300 group-hover:text-text-1">
            {/* When this column carries people, the content block reserves
                the band's height as a floor: short and average columns put
                their portraits on the same line as every other column, and
                a column whose events run past the floor pushes its own
                portraits below them instead of under them. pb-6 is the gap
                in the overflow case — absorbed by the floor otherwise. */}
            <div
              className={cn(
                "flex w-full flex-col items-start pt-6",
                people.length > 0 &&
                  "min-h-[var(--lifeline-people-top)] pb-6",
              )}
            >
              {marker.badges && marker.badges.length > 0 && (
                <div className="mb-3 flex items-center justify-start gap-2">
                  {marker.badges.map((badge) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={badge.src}
                      src={badge.src}
                      alt={badge.alt}
                      className="h-6 w-6 object-contain opacity-80 transition-opacity duration-300 group-hover:opacity-100"
                    />
                  ))}
                </div>
              )}

              {marker.companies && marker.companies.length > 0 && (
                <div className="mb-2 flex items-center justify-start gap-1.5">
                  {marker.companies.map((company) => (
                    <CompanyIcon
                      key={company.id}
                      id={company.id}
                      label={company.name}
                      className="opacity-70 transition-opacity duration-300 group-hover:opacity-100"
                    />
                  ))}
                </div>
              )}

              <div className="min-h-[3.25rem] space-y-4">
                {marker.events.map((event, index) => {
                  const image = getLifelineEventImage(event)
                  const effect = getLifelineEventEffect(event)

                  return (
                    <p
                      key={getLifelineEventKey(event, index)}
                      className={cn(
                        "max-w-[18rem] text-left text-[14px] leading-[1.55] tracking-[-0.01em]",
                        effect && "cursor-pointer",
                      )}
                      data-lifeline-interactive={effect ? "" : undefined}
                      onMouseEnter={
                        image && hoverImage
                          ? () => hoverImage.show(image)
                          : undefined
                      }
                      onMouseLeave={
                        image && hoverImage ? hoverImage.hide : undefined
                      }
                      onClick={
                        effect && fireworks
                          ? () => fireworks.launch(effect)
                          : undefined
                      }
                    >
                      <LifelineEventText event={event} />
                      {image && (
                        // Glued to the last word with a no-break space so
                        // the icon can never wrap onto a line of its own.
                        <span className="whitespace-nowrap">
                          {" "}
                          {image.video ? (
                            <Film
                              className="ml-0.5 inline-block h-3 w-3 -translate-y-px text-text-3 transition-colors duration-300"
                              strokeWidth={1.75}
                              aria-hidden="true"
                            />
                          ) : (
                            <ImageIcon
                              className="ml-0.5 inline-block h-3 w-3 -translate-y-px text-text-3 transition-colors duration-300"
                              strokeWidth={1.75}
                              aria-hidden="true"
                            />
                          )}
                        </span>
                      )}
                    </p>
                  )
                })}
              </div>
            </div>

            {people.length > 0 && (
              <div className="w-full">
                <LifelinePeople people={people} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})