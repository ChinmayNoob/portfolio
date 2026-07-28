# Lifeline: theme alignment, site chrome, and scroll smoothness

Date: 2026-07-28

## Problem

`/lifeline` does not read as part of the portfolio. Four distinct causes,
three of them outright bugs rather than taste:

1. **The lifeline's colours are dead classes.** `src/styles/theme.css`
   deliberately removes Tailwind's stock palettes (`--color-zinc-*: initial`,
   plus `slate`, `gray`, `blue`, `pink`, and the rest). The lifeline is written
   entirely in those: `text-zinc-500`, `bg-zinc-400`, `border-zinc-300`,
   `bg-blue-500`, `bg-pink-500`. None of those utilities are generated, so:
   - there is no text hierarchy — every string falls back to the shell's
     `text-black dark:text-white`;
   - the dashed rail has no border colour;
   - the legend and people dots are invisible (a `rounded-full` span with no
     background and no size-independent fill).

2. **`next-themes` is not wired up.** `lifeline-fireworks.tsx` is the only
   importer, and no `ThemeProvider` is mounted anywhere in the app. So
   `resolvedTheme` is always `undefined` and `setTheme` is a no-op: the
   "switch a light page to dark for the fireworks, then restore" behaviour has
   never run. The site's real mechanism is `ui/theme-toggle.astro` — a class on
   `<html>`, `localStorage['theme']`, and `document.startViewTransition`.

3. **No site chrome.** The page uses `UnstyledBaseLayout` plus a bespoke
   `LifelineNav` carrying only a wordmark. There is no back button, no nav
   links, and no theme toggle. Elsewhere the site puts nav in a left sidebar
   rail; on a full-viewport timeline that space does not exist.

4. **Scrubbing janks.** `use-lifeline-scroll.ts`'s `applyTranslate` calls
   `updateFades()`, which reads `getBoundingClientRect()` on the section *and
   on every marker* — and it runs synchronously inside every `wheel` and
   `pointermove` handler. Trackpads emit wheel events faster than 60Hz, so this
   is repeated read-after-write layout thrash within a single frame. The wheel
   also maps delta onto the transform 1:1, so response is stepwise rather than
   continuous.

## Non-goals

- `src/styles/theme.css` is not modified. Other pages depend on it.
- The global `--font-sans` oddity is left alone (see below).
- `next-themes` stays in `package.json`; only the code stops importing it.
- The vertical/mobile timeline's scroll logic is untouched. Its colours are not.

## A note on `--font-sans`

`theme.css:2` sets `--font-sans: 'Source Sans Pro'`, but `global.css:507` — a
shadcn-init `@theme inline` block — re-declares `--font-sans: 'Geist Variable'`
and is imported later, so it wins. The site's body font is therefore Geist
Variable everywhere, and Source Sans Pro is loaded but unused.

This is pre-existing and out of scope: changing it restyles every page. The
lifeline's own `--lifeline-font` hardcodes a Geist stack to work around the
same confusion. That workaround is removed in favour of following
`var(--font-sans)`, which resolves to the same face — no visual change, but the
timeline now tracks the theme instead of pinning its own font.

## Design

### 1. Colour: map onto tokens that exist

`theme.css` already exposes `--color-text-1/2/3`, `--color-border`,
`--color-divider`, `--color-bg`, `--color-bg-elv`, `--color-bg-soft` as real
Tailwind utilities. Because `--c-text-*` carry their own dark-mode values, the
`dark:` variants collapse away entirely.

| current (emits nothing)                                            | replacement                        |
| ------------------------------------------------------------------ | ---------------------------------- |
| `text-zinc-500 dark:text-zinc-600`                                 | `text-text-3`                      |
| `text-zinc-500 … group-hover:text-black dark:group-hover:text-white` | `text-text-2 group-hover:text-text-1` |
| `bg-zinc-400 group-hover:bg-zinc-600 dark:bg-zinc-700` (ticks)      | `bg-border group-hover:bg-text-2`  |
| `border-zinc-300 dark:border-zinc-800` (rail)                       | `border-divider`                   |
| `decoration-zinc-400 dark:decoration-zinc-700`                      | `decoration-border`, hover `decoration-text-2` |
| `bg-white text-black dark:bg-black dark:text-white`                 | `bg-bg text-text-1`                |
| `bg-blue-500` / `bg-pink-500` (dots)                                | `var(--blue-9)` / `var(--pink-9)`  |

The two accent dots become CSS classes in `global.css`
(`.lifeline-dot-mentor`, `.lifeline-dot-met`) fed by Radix scale vars, which
are already imported by `variable.css` and already flip in dark mode.

### 2. Typography

`.lifeline-typeset` follows `var(--font-sans)` instead of hardcoding Geist.
Year labels move to `font-editorial` (Editorial New), the site's display face,
giving the timeline the portfolio's voice. Ages and other dense numerics stay
in the sans with `tabular-nums`.

### 3. Header

`LifelineHeader` replaces `LifelineNav` in `lifeline-shell.tsx`.

It **must** keep `data-site-nav-logo` and `data-site-nav-inner`:
`measureLayout()` derives the rail's start from the logo's left edge and its
end from the inner container's right edge. Losing them collapses the rail to a
default inset.

- Left: back control, then the `chinmay` wordmark in `font-editorial` (the
  wordmark carries `data-site-nav-logo`, so the rail aligns to it and the back
  button sits outside the rail's span).
- Right: Home / About / Projects / Posts, matching `base-nav.astro`'s items and
  its `--tomato-9` active treatment, then the theme toggle.

The toggle is a React port of `theme-toggle.astro` rather than a reuse of it:
that component binds its listener on `DOMContentLoaded` / `astro:page-load`,
which races a `client:load` island's mount. Same storage key, same icon, same
`startViewTransition`.

### 4. Back button

A real `<a href="/">` so it works without JS and right-clicks correctly. Its
`onClick` calls `history.back()` when `document.referrer` is same-origin,
otherwise it lets the `/` navigation proceed.

### 5. Footer

Same slim fixed bar — a full-viewport timeline has no room for the tall site
footer, and letting the page scroll to reveal it would fight the horizontal
scrub's wheel handling. Restyled to `border-divider` / `text-text-3`, and
gains a scrub hint that self-dismisses on the first `wheel`, `pointerdown`, or
`keydown` on `window` (self-contained; nothing plumbs through the shell).

### 6. Theme hook

New `use-site-theme.ts`: reads the current theme from the `.dark` class on
`<html>`, writes `localStorage['theme']` under the existing key, and wraps
changes in `document.startViewTransition` where supported. It is the single
source for both the header toggle and the fireworks nightfall.
`lifeline-fireworks.tsx` swaps `useTheme()` for it, at which point the
nightfall behaviour works for the first time.

### 7. Scroll smoothness

All in `use-lifeline-scroll.ts`:

- `measureLayout()` additionally caches, per marker, `left`
  (`LIFELINE_STICKY_SHIELD_WIDTH + offsetLeft`) and `width` (`offsetWidth`),
  plus the stage width, into a geometry ref. This geometry is static between
  measures — that is the whole reason the per-frame reads were avoidable.
- `updateFades()` becomes pure arithmetic over that cache and
  `translatePx.current`. Zero layout reads per frame, down from one plus one
  per marker.
- DOM writes are rAF-batched: handlers mutate state and schedule a single
  commit per frame that writes the track transform, the label transform, and
  the marker opacities. Several trackpad events in one frame now cost one
  write rather than several read→write cycles.
- The wheel drives a `targetTranslate`; a rAF loop eases the actual translate
  toward it with frame-rate-normalized damping, snapping below 0.1px. **Drag
  stays 1:1** — direct manipulation must not lag the finger, so a pointer drag
  sets both target and actual.
- The embed boundary-release check (currently comparing a freshly clamped
  target against `translatePx.current`) is re-pointed at the glide target, so a
  flick that consumes the last of the rail still releases to the page.
- `will-change-opacity` in `lifeline-marker.tsx` is not a real Tailwind class
  and generates nothing; it becomes `will-change-[opacity]`.

## Verification

Manual, by the user. Build-level check: `astro check` must pass.
