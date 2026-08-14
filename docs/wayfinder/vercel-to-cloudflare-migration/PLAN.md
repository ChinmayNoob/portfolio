# Migration plan: Vercel → Cloudflare Pages/Workers

Source map: [Migrate hosting from Vercel to Cloudflare Pages/Workers](MAP.md).

**Status: on hold after Phase 1.** Decision (2026-08-14): stay on Vercel for now.
Phase 1 (Drizzle) is implemented and deployable as-is on Vercel with no hosting
changes required — see "Staying on Vercel" below. Phases 2–3 (the actual adapter
swap and cutover) are written out below but not started; pick this back up
whenever the Cloudflare move is wanted again.

## Summary

Two independent changes, done in sequence so each can be verified on its own:

1. **Replace `astro:db` with Drizzle + libSQL**, still deployed on Vercel — de-risks
   the DB layer before also changing hosting. **Done.**
2. **Swap `@astrojs/vercel` → `@astrojs/cloudflare`** and cut DNS over — a short
   downtime window during cutover is acceptable. **Not started — on hold.**

R2/object storage is explicitly out of scope (no current need; images are served via
Cloudinary).

## Staying on Vercel (current state)

Phase 1 alone requires **no Vercel dashboard changes**:

- The Drizzle client (`src/db/client.ts`) reads the exact same env var names the
  old `astro:db` setup used — `ASTRO_DB_REMOTE_URL` and `ASTRO_DB_APP_TOKEN`.
  Whatever is already set in the Vercel project's Environment Variables is reused
  as-is; nothing to rename or re-add.
- The only build-script change was dropping the `--remote` flag (it was
  `astro:db`-specific, for pushing schema/pulling remote data at build time —
  irrelevant now that nothing imports `astro:db`). Vercel runs whatever
  `package.json`'s `build` script says, so this is picked up automatically on the
  next deploy. **Do check** the Vercel project's Settings → General → Build Command
  — if it has an *override* there (rather than "inherited from package.json") that
  hardcodes `astro build --remote`, update or clear that override so it doesn't
  pass a now-meaningless flag.
- No Vercel-side Turso/Astro DB integration was found wired into this project (no
  `.vercel/project.json` linkage beyond the standard Vercel CLI project link) — so
  there's no integration to unlink either.
- Everything else (adapter, routing, output mode) is unchanged, since Phase 1 only
  touched the DB layer.

**Net effect:** deploying this branch to Vercel should just work — same env vars,
same build command shape, same adapter. Recommended before merging: pull the
production env vars locally (`vercel env pull` or copy from the dashboard into
`.env`) and run `pnpm dev`, then hit `/guestbook?preview=1` to confirm reads/writes
against the real Turso DB, since that hasn't been verified yet in this session.

---

## Phase 1 — Replace `astro:db` with Drizzle ORM (still on Vercel) — ✅ done

Implemented: `src/db/schema.ts`, `src/db/client.ts`, `guestbook.astro` migrated to
Drizzle, `@astrojs/db` removed from `astro.config.ts`/`package.json`, `db/` folder
removed, seed data ported to `scripts/seed-stamps.ts` (`pnpm db:seed`). Note: the
guestbook route itself was separately archived (404-gated, `?preview=1` to view) —
unrelated to this migration, but means the DB code isn't exercised by real traffic
right now. `astro check` passes with 0 errors; `astro build`'s server+client steps
complete cleanly with zero `astro:db` references in `dist/`. Not yet verified
against the live Turso DB (no local credentials in this session) — do that before
Phase 2.


**Why first:** [Ticket 001](tickets/001-astro-db-cloudflare-compat.md) found
`astro:db`'s remote client doesn't work reliably under Cloudflare Workers (runtime
401 auth errors, build-time crashes) and the package itself is deprecated/removed
upstream (Astro v6.4 → v7.0). [Ticket 004](tickets/004-db-replacement-approach.md)
confirmed Drizzle over raw `@libsql/client` for closer parity to the existing
schema/query ergonomics, and confirmed doing this before the adapter swap.

**Scope:** `astro:db` is used in exactly three places in this repo —
`db/config.ts` (schema), `db/seed.ts` (seed data), and `src/pages/guestbook.astro`
(reads `GuestBook`/`Stamps`, writes `GuestBook` on POST). Nothing else imports
`astro:db`.

1. `pnpm add drizzle-orm @libsql/client` and `pnpm add -D drizzle-kit`.
2. Create `src/db/schema.ts` mirroring `db/config.ts`'s two tables (`GuestBook`,
   `Stamps`) as Drizzle table definitions, keeping the same columns
   (`author`, `link`, `content`, `country`, `timestamp` / `country`, `imageUrl`,
   `hue`) and the `timestamp` index.
3. Create `src/db/client.ts` exporting a Drizzle client built on
   `createClient({ url: import.meta.env.ASTRO_DB_REMOTE_URL, authToken:
   import.meta.env.ASTRO_DB_APP_TOKEN })` (reuse the existing env var names — no
   Turso-side changes needed).
4. Port `db/seed.ts`'s stamp data into a one-off Drizzle seed script (or a
   `drizzle-kit` seed/migration), run once against the existing Turso DB to confirm
   parity — the data's already there, so this is a verification step, not a fresh
   seed.
5. Update `src/pages/guestbook.astro`:
   - replace `import { db, GuestBook, Stamps, desc, eq, asc } from "astro:db"` with
     the Drizzle client + schema + `drizzle-orm` query helpers (`desc`, `eq`, `asc`
     have direct Drizzle equivalents).
   - `db.insert(GuestBook).values({...})` → Drizzle's `.insert(guestBook).values({...})`.
   - the `.select({...}).from(GuestBook).leftJoin(Stamps, ...).orderBy(...).limit(...).offset(...)`
     chain has a direct Drizzle equivalent — translate one clause at a time and diff
     the rendered page against production to confirm identical output.
6. Remove `@astrojs/db` from `astro.config.ts` (drop the `db()` integration import
   and call) and from `package.json`. Remove the `--remote` flag from the `build`
   script once nothing depends on `astro:db`'s build-time remote push.
7. Deploy to Vercel (unchanged hosting), verify the guestbook page renders existing
   entries correctly and that submitting a new entry still works end-to-end.

**Exit criteria:** guestbook reads/writes work identically in production on Vercel,
with zero `astro:db` imports left in the repo.

---

## Phase 2 — Swap the adapter to Cloudflare

**Do this only after Phase 1 is verified in production.**

1. `pnpm add @astrojs/cloudflare` and remove `@astrojs/vercel`.
2. Update `astro.config.ts`:
   ```ts
   import cloudflare from '@astrojs/cloudflare';
   // ...
   adapter: cloudflare({
     imageService: 'passthrough', // see Ticket 002 — v12's 'compile' default
                                   // silently breaks astro:assets on SSR routes
   }),
   ```
3. Audit local `<Image>`/`<Picture>` usage (at least
   `src/components/layout/post-image.astro`) for whether it's reachable from
   on-demand (SSR) routes vs. only prerendered pages — per
   [Ticket 002](tickets/002-image-service-cloudflare.md), `passthrough` means no
   resize/format-conversion at runtime, so if any local image relied on Astro doing
   that, ship a pre-optimized source asset instead.
4. Add a minimal `wrangler.jsonc` (per [Ticket 003](tickets/003-api-routes-workers-runtime.md)):
   ```jsonc
   {
     "name": "portfolio",
     "compatibility_date": "2026-08-14",
     "main": "./dist/_worker.js/index.js",
     "assets": { "directory": "./dist", "binding": "ASSETS" }
   }
   ```
   No D1/KV/R2 bindings needed — the Turso DB is reached over plain HTTPS. Do not
   hand-write `_routes.json`; the adapter generates it.
5. Set `ASTRO_DB_REMOTE_URL`/`ASTRO_DB_APP_TOKEN` (or whatever they're renamed to
   post-Phase-1, e.g. `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN`) as Cloudflare
   secrets (`wrangler secret put ...` or the Pages dashboard's environment
   variables), mirroring whatever's currently set in the Vercel dashboard. Check
   `.env.example` and the Vercel project settings for the full list — this repo's
   `.env.example` currently lists just those two.
6. Build and run locally with `wrangler pages dev` (or `wrangler dev`) against a
   preview/staging Turso token, and confirm:
   - guestbook reads/writes work,
   - `check-embeddable` and `music` API routes respond correctly,
   - the SSR worker bundle size is reasonable — per Ticket 003, a known Astro/shiki
     tree-shaking issue (withastro/astro#16070) can bloat it; check `dist/_worker.js`
     size and trim shiki languages/themes in `astro.config.ts` if needed.
7. Deploy to a Cloudflare Pages preview URL (not production domain yet) and smoke
   test the whole site, not just the pages touched above.

**Exit criteria:** a working Cloudflare Pages preview deployment that matches
current production behavior.

---

## Phase 3 — Cutover

Downtime during cutover is acceptable, so no dual-run/gradual traffic shift is
needed.

1. Point the site's domain's DNS (or Cloudflare's "custom domain" attachment if the
   zone is already on Cloudflare) at the Cloudflare Pages project.
2. Once DNS has propagated and the Cloudflare deployment is confirmed serving
   correctly on the real domain, remove the domain from the Vercel project.
3. Keep the Vercel project around (not deleted) for a rollback window in case an
   issue surfaces post-cutover, then decommission it.

---

## Open follow-ups (not blocking this plan)

- Cloudflare Worker size limits: revisit if the shiki-bundling issue
  (withastro/astro#16070) turns out to matter after Phase 2's bundle-size check.
- If a future Astro major upgrade is planned, note that `@astrojs/db` is removed
  entirely in Astro v7 — this migration's Phase 1 also clears that blocker early.
