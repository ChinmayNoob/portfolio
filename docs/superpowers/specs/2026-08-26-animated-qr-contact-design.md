# Animated QR contact page

Date: 2026-08-26
Status: approved, not yet implemented

## Goal

A `/contact` page holding one card per social link. Each card shows a real,
scannable QR code that animates into existence, with one of the bento
illustration characters embedded inside the code matrix.

Non-goals: scan tracking, redirect shortening, a QR playground, and any
runtime QR generation. The four payloads are fixed URLs read from site config.

## Terminology

"Static" and "dynamic" here mean **still versus animated rendering**, not the
QR-industry sense of direct-URL versus trackable-redirect. There is no backend,
no `/q/:slug` route, and no scan counting. One component produces both states:
animated by default, still for `prefers-reduced-motion` and for no-JS.

## Data

`src/pages/contact.astro` sets `export const prerender = true`. The project
default is `output: 'server'` with the Vercel adapter, so without this the page
would be server-rendered on every request for no benefit.

URLs come from `cfg.bio.links` in `site.config.ts`. There is no second copy of
them.

`src/data/contact.ts` maps each link `label` to its presentation:

| label      | display  | handle                   | art embedded                   |
|------------|----------|--------------------------|--------------------------------|
| `github`   | GitHub   | `@chinmaynoob`           | `i-foreground` (laptop + code) |
| `x`        | X        | `@Chinmay0408`           | `k-foreground` (birds)         |
| `linkedin` | LinkedIn | `chinmay-sawant0408`     | `linkedin-character` (lanyard + `in` badge) |
| `mail`     | Email    | `chinmaypvt04@gmail.com` | `a-foreground` (plain)         |

Each entry resolves the dark and light variant of its art SVG, matching the
existing `data-theme-dark` / `data-theme-light` convention used across the
bento tiles.

`linkedin-character-{light,dark}.svg` is new art authored for this work, since
none of the existing tiles carried anything that read as LinkedIn. It follows
the established conventions: `--accent-l0` head, `--accent-l1` shirt, features
in `--foreground-l2` (light) / `--background-l3` (dark), prop in
`--background-l6`, a -4 degree tilt, and a 304 viewBox. The badge is
`--background-l0` filled with `--foreground-l2` glyphs, so it inverts per theme
on its own. The `in` glyphs are stroked geometry rather than `<text>`, so there
is no font dependency.

Its light variant gets its outline differently from the Figma-exported tiles.
Those use a generated mask plus a precomputed union path; this one strokes each
silhouette shape at double width and repaints it fill-only underneath, so the
inner half of the stroke is covered and only a clean outer contour survives.
Visually equivalent, hand-maintainable, and no seam at the head/shoulder join.

A link present in `cfg.bio.links` but absent from this map renders as a card
with a QR and no embedded art. It must not fail the build. This keeps adding a
fifth social a one-line change.

`/contact` is added to the `navItems` array in both
`src/components/layout/base-nav.astro` and
`src/components/layout/mobile-nav.astro`. These two files each hold their own
copy of that array; unifying them is out of scope for this work.

## QR pipeline

### `src/lib/qr/matrix.ts`

Wraps the `qrcode` package (build-time only). Exports:

```ts
toMatrix(url: string): QrMatrix

type QrMatrix = {
  size: number // modules per side
  isDark(x: number, y: number): boolean
  isReserved(x: number, y: number): boolean
}
```

`isReserved` is true for the structural modules: the three finder patterns and
their separators, the timing patterns, the alignment patterns, and the format
and version information areas. Reserved modules are never recoloured in a way
that reduces contrast, and are never occluded.

Two encoder settings are fixed:

- **Error correction level H** (30% recovery). This is not stylistic. It is
  what funds the occlusion budget in the art section below.
- **A single pinned version across all four cards.** Left to itself the encoder
  picks the smallest version that fits each payload, so the short `mailto:`
  would render a visibly coarser grid than the long LinkedIn URL and the row of
  cards would look accidental rather than designed. The version is pinned to
  whatever accommodates the longest payload (the LinkedIn URL, 47 characters,
  at level H — expected to be version 6 / 41x41, to be confirmed against the
  encoder during implementation rather than trusted from capacity tables). All
  four cards then share an identical grid.

If a payload ever exceeds the pinned version's capacity, the build fails with a
message naming the link and the required version. Silently bumping the version
would break the visual consistency the pin exists to guarantee.

### `src/lib/qr/render.ts`

Turns a `QrMatrix` plus an art placement into the data the component renders:
one entry per dark module carrying its grid position, its fill role, and its
animation stagger index.

Output is inline SVG: one `<rect>` per dark module. Roughly 840 rects per card
at 41x41, four cards per page. The markup is highly repetitive and compresses
to single-digit kilobytes.

## Art in the code

Two distinct mechanisms with different risk profiles. They must not be
conflated.

### Tinting — unlimited area, no scan risk

Within the character silhouette's region, dark modules take an art ink colour
and light modules take a pale tint of the same hue. Every module remains
**present** and remains high-contrast, so scanner behaviour is unaffected. The
drawing reads through the code as a colour shift.

Most of the visual effect comes from this mechanism, and it costs nothing in
reliability. Contrast ratio between the tinted dark and tinted light values
must stay at or above the ratio used by the untinted modules.

### Occlusion — budgeted, real risk

A single centred window where module rects are **omitted** and the artwork
draws at full strength: the character's head and prop.

Constraints:

- Area capped at 20% of the symbol's total module area.
- Centred. ECC blocks are interleaved across the symbol, so centred damage
  spreads thinly across many blocks rather than destroying any one block
  outright.
- Never overlaps a reserved module.

The art SVGs are authored in a 304-wide viewBox. Placement wraps their paths in
a `<g transform>` that scales and positions them into a module-space rectangle,
so art coordinates and module coordinates stay decoupled.

### `src/lib/qr/verify.ts` — build-time scan assertion

"It looks fine" is not evidence that a phone will scan it, and the occlusion
mechanism above is exactly the kind of thing that degrades quietly when the art
is later adjusted.

After generating each card's SVG, the build rasterises it with `sharp` (already
a project dependency) and decodes it with `jsQR`, asserting the decoded payload
equals the input URL. A mismatch fails `astro build` with the offending link
named.

This runs at build time rather than in a test file because the repository
currently has no test runner — there are no `*.test.*` files and no vitest.
Adding a harness for this one assertion was considered and rejected as
disproportionate; a build that cannot ship an unscannable QR is the stronger
guarantee anyway.

Cost: one devDependency (`jsqr`) and a few hundred milliseconds of build time.

## Animation

A single `@keyframes` rule in `src/styles/qr.css`.

Each rect carries `style="--i: n"`, where `n` is its **Chebyshev distance from
the nearest of the three finder corners**, computed at build time. The delay is
`calc(var(--i) * 22ms)`. With roughly 20 rings across a 41x41 symbol that is
about 440ms of stagger, plus a ~260ms per-module scale-and-fade, for a total of
roughly 700ms. The code then sits completely still.

The nearest-finder metric is the point: the code grows out of its three
structural anchors instead of fading in as an undifferentiated blob. Stillness
after settling is equally deliberate — a perpetually moving QR reads as cheap
and gives scanners a moving target.

Playback is triggered by a single `IntersectionObserver` that toggles one class
on the card. Around fifteen lines of vanilla JS; GSAP is a project dependency
but is not needed here and is not used.

Two paths render the finished, still, scannable QR with no animation at all:

- `@media (prefers-reduced-motion: reduce)`
- no JavaScript, since the observer never runs and the class is never added

Both are served by the same component. There is no separate static variant.

Colours use the existing `var(--background-l*)` and `var(--foreground-l*)`
tokens defined in `src/styles/bento.css`, so light and dark theming requires no
additional work.

## Files

| path                                    | purpose                                  |
|-----------------------------------------|------------------------------------------|
| `src/pages/contact.astro`               | prerendered page, reads `cfg.bio.links`  |
| `src/data/contact.ts`                   | label to handle and art mapping          |
| `src/lib/qr/matrix.ts`                  | `qrcode` wrapper, matrix + reserved mask |
| `src/lib/qr/render.ts`                  | matrix + art region to SVG rect data     |
| `src/lib/qr/verify.ts`                  | build-time rasterise and decode assertion|
| `src/components/contact/qr-card.astro`  | a single card                            |
| `src/styles/qr.css`                     | keyframes, stagger, reduced-motion       |
| `src/components/layout/base-nav.astro`  | add `/contact`                           |
| `src/components/layout/mobile-nav.astro`| add `/contact`                           |

New dependencies, all `devDependencies`, all build-time only: `qrcode`,
`@types/qrcode`, `jsqr`.

Nothing reaches the browser except markup and CSS.

## Verification

- Every card's payload round-trips through rasterise-and-decode at build time.
- Each of the four QR codes scans on a physical phone camera, checked once
  during implementation, in both light and dark theme.
- All four cards render an identical grid size.
- `prefers-reduced-motion` renders a still, scannable code.
- With JavaScript disabled, the page renders four still, scannable codes.
- `pnpm build` (which runs `astro check`) passes.
