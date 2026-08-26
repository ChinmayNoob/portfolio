# Animated QR contact page

Date: 2026-08-26
Status: implemented

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

`src/pages/contact.astro` sets `export const prerender = true`. This was
necessary when the project was `output: 'server'`, and is redundant now that it
is `output: 'static'` on Cloudflare Workers — but it is kept explicit, because it
is the guarantee that `sharp`, `qrcode` and `jsqr` run only at build time.
`sharp` is a native binary and cannot execute on Workers at all, so an SSR
version of these pages would not merely be slower, it would not run.

URLs come from `cfg.bio.links` in `site.config.ts`. There is no second copy of
them.

`src/data/contact.ts` maps each link `label` to its presentation:

| label      | display  | handle                   | art embedded                          |
| ---------- | -------- | ------------------------ | ------------------------------------- |
| `github`   | GitHub   | `@chinmaynoob`           | `github-character` (dizzy, laptop)    |
| `x`        | X        | `@Chinmay0408`           | `x-character` (annoyed, phone, birds) |
| `linkedin` | LinkedIn | `chinmay-sawant0408`     | `linkedin-character` (lanyard badge)  |
| `mail`     | Email    | `chinmaypvt04@gmail.com` | `mail-character` (envelope)           |

Handles are not stored. They are derived from the configured URL (last path
segment, or the address after `mailto:`), so config and display cannot drift.

All four figures are purpose-built for this page, but they are **redrawn from**
the bento originals rather than invented: `github-character` keeps
`i-foreground`'s dizzy spiral eyes, squiggle mouth and hunch over the laptop;
`x-character` keeps `k-foreground`'s hard brows, ring eye, anger marks, raised
phone and pair of birds; `mail-character` keeps `a-foreground`'s dot eyes and
small open mouth. What changed is that every large dark mass (the laptop, the
phone) became a light fill with dark linework. The measurements that forced that
are in "Revised during implementation" at the end.

Head radius, tilt, posture and expression differ per figure — a hunch for
GitHub, a lean and anger marks for X, the most upright and symmetric posture for
LinkedIn, the smallest head and widest lean for Email. An earlier pass shared
one base figure and only swapped the prop, which read as a single avatar in four
costumes.

The four figures are new art authored for this work. They follow the
established bento conventions: `--accent-l0` head, `--accent-l1` shirt, features
in `--foreground-l2` (light) / `--background-l3` (dark), prop in
`--background-l6`, a -4 degree tilt, and a 304 viewBox. The badge is
`--background-l0` filled with `--foreground-l2` glyphs. Glyphs are stroked
geometry rather than `<text>`, so there is no font dependency.

They get their outline differently from the Figma-exported tiles. Those use a
generated mask plus a precomputed union path; these stroke each silhouette
shape at double width and repaint it fill-only underneath, so the inner half of
the stroke is covered and only a clean outer contour survives. Visually
equivalent, hand-maintainable, and no seam at the head/shoulder join.

Only `linkedin-character` has a dark variant, because only it is a candidate
for the bento grid. The other three exist solely to sit inside the QR panel,
which is light in both themes, so a dark variant would be speculative work for
a case that does not exist. Each carries a comment saying how to add one.

SVG comments cannot contain a double hyphen, so these files describe palette
tokens in prose rather than writing them literally.

A link present in `cfg.bio.links` but absent from this map renders as a card
with a QR and no embedded art. It must not fail the build. This keeps adding a
fifth social a one-line change.

`/contact` is deliberately NOT in the nav. It is reachable by URL and by direct
link only, so the nav stays at its five entries. On mobile the breadcrumb still
reads "Home / Contact": with no matching entry in `mobileNavItems` the crumb
falls through to `pageTitle`, which the page sets via its SEO title.

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

`isReserved` comes from the encoder's own `modules.reservedBit`, which marks
exactly the structural modules: the three finder patterns and their separators,
both timing patterns, the alignment pattern, and the format information areas.
At v6 that is 298 modules, 17.7% of the symbol. They are never recoloured in a
way that reduces contrast, and never occluded.

Two encoder settings are fixed:

- **Error correction level H** (30% recovery). This is not stylistic. It is
  what funds the occlusion budget in the art section below.
- **A single pinned version across all four cards.** Left to itself the encoder
  picks the smallest version that fits each payload, so the short `mailto:`
  would render a visibly coarser grid than the long LinkedIn URL and the row of
  cards would look accidental rather than designed. The version is pinned to
  whatever accommodates the longest payload. Measured against the encoder: the
  LinkedIn URL at 47 characters needs v6, the two short ones fit v4 and the X
  URL fits v3, so the pin is v6 at 41x41. All four cards share that grid.

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

### Occlusion follows the silhouette

`src/lib/qr/art.ts` rasterises the figure with `sharp` at 1024px, takes its
tight alpha bounding box, and averages alpha per module to get a coverage figure
for every cell of the grid. Coverage drives two treatments:

- at or above 0.55 the module is removed, so the artwork reads at full strength
- between 0.06 and 0.55 the module stays and is only recoloured, which gives the
  figure a soft edge

Removal follows the drawn silhouette rather than a centred rectangle. The figure
is its own mask, which is what makes it read as a character carved out of the
code rather than a logo pasted over a hole.

Structural modules are never removed and never recoloured, whatever the coverage
says. Placement is driven by the measured bounding box rather than the source
viewBox, so padding in the artwork cannot shift the figure off centre.

The artwork is positioned by giving its nested `<svg>` the measured bounding box
as a viewBox, so it lands on its module rect with no hand-computed transform.
That element must carry `fill="none"`: the figures' stroke-only paths (mouths,
envelope flap, terminal chevron) inherit it from the wrapper that gets stripped
when the artwork is inlined, and without it they fall back to solid black.

### The budget, and what it does not measure

Removed modules are capped at 16% of the symbol. The shipped set runs 5.4-6.9%.

That counter is necessary but not sufficient, and the gap is the main thing
learned building this. It counts dark modules removed. It cannot see a _light_
module that the artwork has painted dark, and that is equally destructive. It is
why large dark masses in artwork are disqualifying, and why every figure keeps
its props mostly light with small dark details.

### `src/lib/qr/verify.ts` — build-time scan assertion

"It looks fine" is not evidence that a phone will scan it, and the occlusion
mechanism above is exactly the kind of thing that degrades quietly when the art
is later adjusted.

After generating each card's SVG, the build rasterises it with `sharp` (already
a project dependency) and decodes it with `jsQR`, asserting the decoded payload
equals the input URL. A mismatch fails `astro build` with the offending link
named.

Verification runs at 4 pixels per module. A clean axis-aligned raster is a much
easier problem than a phone camera at an angle, and a build cannot simulate the
latter; verifying at a deliberately small raster is the cheapest available proxy
for that headroom.

This runs at build time rather than in a test file because the repository
currently has no test runner — there are no `*.test.*` files and no vitest.
Adding a harness for this one assertion was considered and rejected as
disproportionate; a build that cannot ship an unscannable QR is the stronger
guarantee anyway.

Cost: one devDependency (`jsqr`) and a few hundred milliseconds of build time.

## Animation

A scanner sweep. A beam travels down the panel, modules materialise as it
passes, and then the three finder patterns snap in corner by corner, like a
reader locking onto the code.

The mechanism matters as much as the look. The reveal is **one** animated
`clip-path` on a single group wrapping the artwork and all the data modules,
animating `inset(0 0 100% 0)` to `inset(0 0 0 0)`. Add the travelling beam and
the three finder groups and that is **five animated elements per card**.

The finder patterns are held out of the swept group and emitted separately, so
they can arrive last. They carry overshoot easing and staggered delays (760ms,
830ms, 900ms) so the code appears to be acquired rather than to pop. The beam's
travel distance reads `--qr-span` off the `<svg>`, which `render.ts` sets to the
module count including the quiet zone, so the animation stays correct if the
pinned version ever changes.

Total settle is ~1240ms.

The beam is parked just above the viewBox and additionally pinned to `opacity:
0` when idle, so a future geometry change cannot leave an orange bar sitting
across the top of a finished code.

The panel itself is light in BOTH themes. Inverted codes, meaning light modules
on a dark ground, fail on a meaningful share of scanners, and a light panel is
what QR codes are printed on everywhere for exactly that reason. `qr.css` pins
the handful of tokens the code and the figures need to their light values rather
than theming them. The card around the panel is themed normally. The scan beam
is the one accent, tied to `--tomato-9`, the token the active nav link uses.

The finished still code is the DEFAULT state. An inline script adds `.qr-anim`
to the document element, and that class is the only thing that opts a visitor
into the hidden start state, so a blocked or failed script degrades to a static
scannable code rather than to nothing. The class is set again where the observer
arms, because an inline script is not guaranteed to re-run when `ClientRouter`
swaps the document on a client-side navigation.

Playback is triggered by a single `IntersectionObserver` toggling one class per
card. `prefers-reduced-motion` cancels the start state outright and never shows
the beam.

## Files

| path                                     | purpose                                   |
| ---------------------------------------- | ----------------------------------------- |
| `src/pages/contact.astro`                | prerendered page, reads `cfg.bio.links`   |
| `src/data/contact.ts`                    | label to handle and art mapping           |
| `src/lib/qr/matrix.ts`                   | `qrcode` wrapper, matrix + reserved mask  |
| `src/lib/qr/art.ts`                      | artwork to per-module coverage mask       |
| `src/lib/qr/render.ts`                   | matrix + art region to SVG rect data      |
| `src/lib/qr/verify.ts`                   | build-time rasterise and decode assertion |
| `src/components/contact/qr-card.astro`   | a single card                             |
| `src/styles/qr.css`                      | keyframes, stagger, reduced-motion        |
| `src/components/layout/base-nav.astro`   | add `/contact`                            |
| `src/components/layout/mobile-nav.astro` | add `/contact`                            |

New dependencies, all `devDependencies`, all build-time only: `qrcode`,
`@types/qrcode`, `jsqr`.

Artwork is imported with Vite's `?raw` rather than read from disk. In the bundled
build `import.meta.url` points at a chunk instead of the source tree, so a path
resolves in dev and fails during `astro build`.

Nothing reaches the browser except markup and CSS.

## Verification

- Every card's payload round-trips through rasterise-and-decode at build time.
- Each of the four QR codes scans on a physical phone camera, checked once
  during implementation, in both light and dark theme.
- All four cards render an identical grid size.
- `prefers-reduced-motion` renders a still, scannable code.
- With JavaScript disabled, the page renders four still, scannable codes.
- `pnpm build` (which runs `astro check`) passes.

## The printable card (/card)

A second consumer of the same engine, and the case where a QR genuinely beats a
hyperlink: a standard 85.6 x 54mm business card.

**The code carries the whole vCard, not a link to one.** A printed card outlives
its hosting, so a card already in someone's wallet keeps working with no network
and no live domain. The cost is a denser symbol, which was measured rather than
assumed:

| payload                | version | grid  | a 22-module figure |
| ---------------------- | ------- | ----- | ------------------ |
| URL to a hosted `.vcf` | v5      | 37x37 | 59% of height      |
| vCard encoded directly | v11     | 61x61 | 34% of height      |

The denser grid is partly self-correcting: the same figure occludes a smaller
fraction of a bigger symbol, which frees error-correction headroom to spend on
enlarging the artwork again. The cliff for this payload sits between 44 and 46
modules, so the figure ships at 38 and still fills ~62% of the code's height.

The payload is kept lean for the same reason, and `src/data/vcard.ts` is the
single source for it: `/card.vcf` serves the identical string the code encodes,
so the page has a click-to-save path on desktop where scanning is awkward.

**Physical module size is the real constraint, not looks.** At 85.6mm wide with
the code taking 38% of the content width, modules came out ~0.40mm, under the
~0.5mm phone cameras want. The code's share was raised to 46% and the padding
tightened, which puts it at 0.53mm. That number is printed on the page itself so
it cannot silently regress.

For print the palette switches to white stock and black ink. On screen the paper
is warm to match the site; on paper, maximum contrast is what makes a small code
scan, and a cream flood fill would waste ink for nothing.

### Two print traps

**The hidden start state would print blank.** The sweep's start state hides the
modules until a script marks the code settled. Printing before that script ran
would put the hidden state on paper and emit an empty panel. `qr.css` therefore
forces the finished code under `@media print` regardless of animation state:
paper has no such thing as "not yet revealed".

**The card printed across three pages.** With an `@page` box only 85.6 x 54mm,
any leftover margin, padding or min-height anywhere in the ancestor chain
overflows onto further pages, and the layout has several wrappers each
contributing one. Zeroing each box individually is whack-a-mole; instead the
chain from `.page-shell` down to `.card-stage` is collapsed with
`display: contents` in print, so those elements stop generating boxes at all and
their margins go with them. Only `.card-sheet` is left producing a box, directly
in body's flow. Verified at one page both with `@page` honoured and when forced
onto A4.

### A container-query trap worth remembering

`.card-sheet` declares `container-type: inline-size` and the card's type sizes
are in `cqw`, so one set of values serves both the screen and the exact physical
size. But **an element cannot query itself**: `container-type` establishes a
container for descendants only. `cqw` used on `.card-sheet`'s own padding and gap
resolved against the viewport instead, making the padding 55px rather than 24px
and throwing the sheet well off its 85.6:54 ratio. Hence `.card-inner`: every
`cqw` value lives on a descendant.

A related trap in the same layout: the site sets a **fixed px** line-height,
which is inherited into the card and made every row 28px tall regardless of its
`cqw` font size. Unitless line-heights scale; px ones do not.

Neither page is linked from the nav, by choice.

## Revised during implementation

Everything below changed because a measurement contradicted the design, not
because of taste. Recorded so the reasoning is not lost.

**The bento tiles could not be used as embedded artwork.** The design named
`i-foreground`, `k-foreground` and `b-foreground`. Embedded and verified, all
three failed to decode. `i-foreground` carries a large block of rendered code
text, `k-foreground` a large dark phone. Both paint many of the code's _light_
modules dark, which the occlusion budget cannot see. `x` failed at 11% occlusion
while `mail` passed at 8%, which is what exposed the flaw in measuring only
removed dark modules. Four compact figures were authored instead, mostly light
with small dark details, and the whole set then behaved identically.

**Artwork height is empirical, not chosen.** Sweeping the set, every card decodes
at 26 modules and every card fails at 28 — a sharp error-correction cliff.
Shipping at 22 leaves two steps of margin, so a later art tweak cannot silently
land on the edge.

**Occlusion follows the silhouette, not a centred window.** The design proposed a
centred rectangle, reasoning that interleaved ECC blocks spread centred damage
thinly. Using the figure as its own mask both looks better and measures better,
and the verifier makes the theoretical argument unnecessary.

**The panel is light in both themes.** The design had it themed from `bento.css`.
That would have produced an inverted code in dark mode, which many scanners
reject. Pinning the panel light also removed the need for dark artwork variants
and for any palette duplication.

**Verification is stricter than designed.** 4 pixels per module rather than 8.
Both give identical pass/fail results on this set, which established that the
cliff is genuine symbol damage rather than a rasterisation artifact.

**Per-module animation was replaced by a swept clip-path.** The first build gave
every dark module its own animation with a delay derived from its distance to
the nearest finder pattern. That is roughly 2900 simultaneous animations on this
page. It measured fine headless but left the panels blank in a real browser, and
the effect was a generic staggered fade anyway. The scanner sweep is both more
interesting and about five animated elements per card. `ringIndex` in
`matrix.ts` and the per-rect `--i` custom property both went away with it; the
markup shrank from ~46KB to ~37KB per card as a side effect.

**XML comments cannot contain a double hyphen.** Hit twice while writing the
artwork, since every palette token name begins with one and `--` is also a
tempting em-dash substitute. `sharp` reports only a generic "corrupt header",
so `art.ts` now checks for it and raises a message naming the real cause.

## Known gaps

- The codes have not been scanned with a physical phone camera. Each is verified
  by build-time decode, which is not the same evidence.
- The animation was verified in headless Edge by stepping the sweep frame by
  frame, confirming the beam tracks the reveal edge and the finders land last,
  and confirming the settled state leaves no running animations and a beam at
  `opacity: 0`. The reduced-motion and no-JS paths were verified by reading the
  CSS and the built markup, not exercised in a browser.
- `/contact` and `/card` are both unlinked from the nav by choice, so they are
  discoverable only by URL. Worth linking from somewhere (the bento grid, the
  footer) if that is not the intent.
- The card has not been printed on paper or scanned from paper. Its geometry,
  single-page output and 0.53mm module size are all computed and verified in a
  browser, which is not the same as a scan off a real print.
- `site.config.ts` now points at `https://chinmay.fyi/`, which changes canonical
  URLs, the sitemap, RSS and OG for the WHOLE site, not just these pages. That
  is correct only once the domain is live.
- The `EPERM ... symlink` build failure noted during development came from the
  Vercel adapter and is gone: the branch is now rebased onto the Cloudflare
  Workers migration, where `pnpm build` completes cleanly with 0 errors and both
  pages prerender.
