import codeIsDead from "~/assets/art/code-is-dead.png"
import littleRooms from "~/assets/art/little-rooms.png"
import space from "~/assets/art/space.png"

export type ArtAspectRatio = "9:16" | "1:1" | "4:5" | "full"

/**
 * Each piece's background. `auto` is the default and inverts the active
 * theme — when the site is light the panel goes dark, and vice versa — so
 * the design always sits on a contrasting field. Override per piece with a
 * solid color (with its own text color) or a background image.
 */
export type ArtBackground =
  | { kind: "auto" }
  | { kind: "color"; bg: string; text?: string }
  | { kind: "image"; src: ImageMetadata; text?: "light" | "dark" }

export interface ArtPiece {
  title: string
  /** ISO date, e.g. "2026-08-09". Sorted newest-first for display. */
  date: string
  image: ImageMetadata
  aspect?: ArtAspectRatio
  background?: ArtBackground
}

export const artPieces: ArtPiece[] = (
  [
    {
      title: "Code is Dead",
      date: "2026-08-09",
      image: codeIsDead,
      aspect: "9:16",
      background: { kind: "color", bg: "#1d283a" },
    },
    {
      title: "Space",
      date: "2026-08-07",
      image: space,
      aspect: "1:1",
    },
    {
      title: "Little Rooms: Andre 3000",
      date: "2026-04-10",
      image: littleRooms,
      aspect: "1:1",
      background: { kind: "color", bg: "#FDCF19", text: "rgba(30, 30, 35, 0.92)" },
    },
  ] satisfies ArtPiece[]
).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

/** "2026-08-09" -> "9th August 2026" */
export function formatArtDate(iso: string): string {
  const parts = iso.split("-").map(Number)
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return iso
  const [y, m, d] = parts
  const month = new Intl.DateTimeFormat("en-US", { month: "long" }).format(
    new Date(2000, m - 1, 1),
  )
  return `${d}${ordinal(d)} ${month} ${y}`
}

function ordinal(n: number): string {
  if (n > 3 && n < 21) return "th"
  switch (n % 10) {
    case 1:
      return "st"
    case 2:
      return "nd"
    case 3:
      return "rd"
    default:
      return "th"
  }
}
