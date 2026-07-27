import { Lifeline, LifelineLegend } from "~/components/lifeline"
import {
  LifelineFooter,
  LifelineNav,
  LifelineShell,
  LifelineStage,
} from "~/components/lifeline-shell"
import { defineLifeline } from "~/lib/lifeline-data"

const life = defineLifeline({
  slug: "chinmay",
  name: "Chinmay's Lifeline",
  birthYear: 2004,
  endYear: 2026,
  description: "From the first breath to the first commit — a life in years.",
  milestones: {
    2004: {
      id: "born",
      label: "Aug 4",
      events: ["Born."],
    },
    2015: {
      id: "hello-world",
      events: ["Wrote my first Hello, World! in C."],
    },
    2022: {
      id: "school-graduation",
      events: [
        "Graduated school. Picked Computer Science as my major.",
      ],
    },
    2026: {
      id: "engineering-and-first-job",
      events: [
        { text: "May — Graduated engineering." },
        { text: "July — Started my first job as a Software Engineer." },
      ],
    },
  },
})

export function LifelinePage() {
  return (
    <LifelineShell>
      <LifelineNav
        logo={
          <span className="text-[15px] font-semibold tracking-tight">
            chinmay
          </span>
        }
      />

      <LifelineStage>
        <Lifeline
          markers={life.markers}
          birthYear={life.birthYear}
          title={life.name}
          className="h-full"
        />
      </LifelineStage>

      <LifelineFooter>
        <p className="text-[13px] text-zinc-500">
          {life.description}
        </p>
        <LifelineLegend />
      </LifelineFooter>
    </LifelineShell>
  )
}
