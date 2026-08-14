---
label: wayfinder:map
status: open
---

# Migrate hosting from Vercel to Cloudflare Pages/Workers

## Destination

A written migration plan (not execution) for moving this Astro 5 SSR site off Vercel
onto Cloudflare Pages/Workers: adapter swap, Astro DB runtime compatibility, image
service handling, env/secrets mapping, and a DNS cutover. A short downtime window
during cutover is acceptable — no need for a zero-downtime dual-run. Cloudflare R2 is
not in scope; the app has no object-storage need today (images are served via
Cloudinary).

## Notes

- Domain: personal portfolio blog (Astro 5, `output: 'server'`, currently `@astrojs/vercel`).
- Astro DB (`@astrojs/db`) is backed by an external Turso/libSQL database — already
  portable, not Vercel-specific.
- Two dynamic API routes exist: `src/pages/api/check-embeddable.ts`,
  `src/pages/api/music.ts` — both use only `fetch`/`AbortSignal`/`Response`, no
  Node-specific APIs found in `src`.
- Consult `superpowers:writing-plans` once the map is clear, to turn the closed
  tickets' decisions into the final migration plan document.

## Decisions so far

- [Do the existing dynamic API routes and adapter config need changes for Workers?](tickets/003-api-routes-workers-runtime.md) — No blockers: `fetch`/`URL`/`AbortSignal.timeout` are native Workers APIs; `@astrojs/cloudflare` auto-generates routing for mixed static+SSR (don't hand-write `_routes.json`); minimal `wrangler.toml` needs no D1/KV/R2 bindings; `nodejs_compat` not required (MDX/shiki/rehype all build-time only) — but watch SSR worker bundle size due to a known Astro/shiki tree-shaking issue (withastro/astro#16070).
- [What image service config does this site need under the Cloudflare adapter?](tickets/002-image-service-cloudflare.md) — On Astro 5, `@astrojs/cloudflare@12.x` applies (not the v13+ `cloudflare-binding` default, which needs Astro 6). v12's own default (`imageService: 'compile'`) silently breaks `astro:assets`/`<Image>` on SSR/on-demand routes (Sharp unavailable in Workers) — must set `imageService: 'passthrough'` explicitly since this site is `output: 'server'`. Local `<Image>` usage (e.g. `post-image.astro`) needs an audit for SSR-reachability; remote Cloudinary allowlisting is unaffected by the adapter swap.
- [Does Astro DB work at runtime under the Cloudflare adapter?](tickets/001-astro-db-cloudflare-compat.md) — **Hard blocker, not a config tweak**: `astro:db`'s remote client does not work reliably under `@astrojs/cloudflare` (401 auth errors at runtime, build-time `Invalid URL string` crashes) — a Workers-safe mode was proposed and abandoned (astro#12163), and Astro deprecated/removed `@astrojs/db` entirely in v6.4/v7.0. `nodejs_compat` does not fix this. Must replace `astro:db` with a direct `@libsql/client/web` or Drizzle client against the same Turso DB before/alongside the adapter swap.

- [Which astro:db replacement and what sequencing?](tickets/004-db-replacement-approach.md) — Replace `astro:db` with Drizzle ORM over libSQL (typed queries, closer to existing ergonomics than raw `@libsql/client/web`). Ship that change first on Vercel, verify it, then do the adapter swap as a separate step — de-risks by changing one variable at a time.

## Not yet specified

(none — plan written, see [PLAN.md](PLAN.md))

## Out of scope

- Introducing Cloudflare R2 or any new object storage — no current need found in the
  codebase; revisit only if the destination is redrawn.
- Zero-downtime dual-run / gradual traffic shift — user confirmed a short downtime
  window during cutover is acceptable.
