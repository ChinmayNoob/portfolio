---
label: wayfinder:research
status: closed
assignee: research-subagent
blocks: []
blocked_by: []
---

# Does Astro DB work at runtime under the Cloudflare adapter?

## Question

This app uses `@astrojs/db` (`astro:db`) against a remote Turso/libSQL database
(`ASTRO_DB_REMOTE_URL` + `ASTRO_DB_APP_TOKEN`), built with `astro build --remote`.
The GuestBook page reads and the guestbook form path presumably writes to it.

If we swap the adapter from `@astrojs/vercel` to `@astrojs/cloudflare`, does
`astro:db` continue to work unmodified in the Cloudflare Workers runtime at request
time (not just at build time)? Specifically:

- Does the `astro:db` runtime client use `fetch`-based libSQL HTTP calls (Workers-safe)
  or does it depend on any Node-only APIs/native bindings that Workers can't run?
- Is any `compatibility_flags` entry (e.g. `nodejs_compat`) required in
  `wrangler.toml` for this to work?
- Are there known issues/GitHub threads about `@astrojs/db` + `@astrojs/cloudflare`
  together, and if so what's the workaround?
- Does this change at build time too — does `astro build --remote` behave the same
  under the Cloudflare adapter, or does something about the adapter change how/when
  the remote DB is queried?

## Answer

**Verdict: not supported — do not migrate the adapter with `@astrojs/db` still in place.** Treat this as a hard blocker for the Vercel → Cloudflare move, not a config tweak. The pragmatic path is to drop `@astrojs/db`/`astro:db` entirely and talk to Turso directly (e.g. `@libsql/client/web` or Drizzle over the libSQL HTTP client) before or as part of switching adapters — see "Recommendation" below.

### 1. Does the `astro:db` runtime client work unmodified in Workers?

Not reliably. `astro:db`'s remote client is built on `@libsql/client`, and the default client Astro wires up assumes a Node-ish runtime, not the Workers `workerd` sandbox. This isn't hypothetical — it's the exact gap a (never-merged) Astro PR tried to close:

- [withastro/astro#12163 – "feat(db): Add support for libSQL remotes on non-Node runtimes"](https://github.com/withastro/astro/pull/12163) proposed adding a `mode: 'web'` option specifically so `astro:db` could "use a libSQL remote on non-Node runtimes like Cloudflare and Deno" by restricting the client to Web-standard APIs instead of native/Node bindings. It was **closed without merging** — the author noted the whole DB package was being refactored (and, as it turned out, later deprecated), so the fix was abandoned rather than shipped.

Real-world confirmation that the unmodified client breaks on Cloudflare:

- [withastro/astro#12019 – "astrojs/db doesn't work on cloudflare pages"](https://github.com/withastro/astro/issues/12019): works locally, but on Cloudflare Pages a query against `astro:db` throws `LibsqlError: SERVER_ERROR: Server returned HTTP status 401` at runtime — an auth/transport failure specific to the Workers environment. Closed as **"not planned"** (i.e. the maintainers did not fix it).
- [withastro/astro#10872 – "Cannot create a remote client: missing app token"](https://github.com/withastro/astro/issues/10872): another Cloudflare-specific failure initializing the remote client.

So: it is fetch/HTTP-capable in principle (libSQL's remote protocol is HTTP/WebSocket-based, not a native binding per se), but Astro's default wiring of the client does not work correctly inside `workerd` today, and the one attempt to add a Workers-safe mode was abandoned.

### 2. Is a `compatibility_flags`/`nodejs_compat` entry enough to fix it?

No evidence that it is. The failures above (401 auth errors, "missing app token", and the build-time errors below) are not "missing Node built-in" errors that `nodejs_compat` typically papers over — they're protocol/serialization bugs in how `astro:db`'s client and Astro's Cloudflare adapter interact. Adding `nodejs_compat` to `wrangler.toml`/`wrangler.jsonc` is worth doing anyway for general Cloudflare-adapter compatibility, but nothing in the linked issues indicates it resolves the `astro:db` problems specifically.

### 3. Known issues combining `@astrojs/db` + `@astrojs/cloudflare`

Multiple, spanning both build time and runtime, and the pattern is "reported, not fixed":

- **Runtime, 401 auth error** — [#12019](https://github.com/withastro/astro/issues/12019) (closed, not planned).
- **Runtime, missing app token** — [#10872](https://github.com/withastro/astro/issues/10872).
- **Build time, "Invalid URL string"** — [withastro/astro#16114 – "astro build --remote fails using Cloudflare adapter + Astro DB remote: Invalid URL string"](https://github.com/withastro/astro/issues/16114) (opened Mar 27 2026, still open at last check). Root cause: Astro DB's manifest deserialization does `new URL(serializedManifest.rootDir)`, but on the Cloudflare/workerd build path (and especially on Windows, where paths aren't `file://` URLs) that field isn't a valid URL string, so the constructor throws.
- **Build time, `serializedManifest.rootDir is undefined`** — [withastro/astro#16738](https://github.com/withastro/astro/issues/16738) (opened May 14 2026): during `astro build --remote` under the Cloudflare adapter, `astro:db`'s `astro:build:setup` hook spins up a temporary Vite server that enters the Cloudflare `workerd` runner to deserialize `virtual:astro:manifest`, and `rootDir` comes through undefined, crashing the build with the same `Invalid URL string` symptom as #16114. Notably, `astro db verify --remote` and `astro db push --remote` (the CLI push path, unaffected by the adapter) still work — it's specifically the adapter-aware app build that breaks.

**Resolution**: none of these were fixed with a targeted patch. Instead, Astro closed out #16738 (and a related content-collections bug, #15431) via [withastro/astro#16964](https://github.com/withastro/astro/pull/16964), merged June 9 2026, which **deprecates `@astrojs/db` outright** rather than fixing the Cloudflare interaction. Per the Astro docs and v7 upgrade guide, `astro:db` was deprecated in **Astro v6.4** and fully **removed in Astro v7.0** (June 2026); maintainers stated they "no longer have the bandwidth to maintain this package." The documented replacement path is to move to a third-party solution — Drizzle ORM (direct libSQL/Turso client) for teams wanting a similar schema/query API, Node's built-in SQLite for Node-adapter-only local-storage use cases, or "whatever fits your deployment platform" for everything else. See [Astro v7 upgrade guide](https://docs.astro.build/en/guides/upgrade-to/v7/) and [Astro DB docs](https://docs.astro.build/en/guides/astro-db/) (both now carry the deprecation/removal notice).

This project currently pins `astro@^5.11.0` and `@astrojs/db@^0.20.1` (pre-deprecation), so it isn't blocked by the package being literally removed yet — but it means the Cloudflare-specific bugs above will never get an upstream fix, and staying on `astro:db` is a dead end regardless of adapter choice.

### 4. Does `astro build --remote` behave the same across adapters?

No — this is adapter-sensitive, not adapter-agnostic. With `@astrojs/vercel`, `astro build --remote` queries the remote Turso DB during the Node-based build/prerender step without incident (it's effectively a Node process talking libSQL-over-HTTP to Turso). With `@astrojs/cloudflare`, the build pipeline additionally routes server-entrypoint construction through Cloudflare's `workerd` runner (via `@astrojs/cloudflare`'s Vite/wrangler integration), and it's specifically *that* code path where `astro:db`'s temporary Vite server / manifest deserialization breaks (#16114, #16738). So switching adapters changes not just runtime behavior but also how/when the remote DB integration executes at build time, and it changes it in a way that currently fails outright with the Cloudflare adapter as of `astro:db`'s last maintained state.

### Recommendation for this migration

1. Do not attempt adapter-swap-only migration for the pages that touch `GuestBook`/`Stamps`. Budget time to replace `astro:db` with a direct libSQL client (`@libsql/client/web`, which is fetch-based and Workers-safe) or Drizzle ORM configured against the same Turso database, using `ASTRO_DB_REMOTE_URL`/`ASTRO_DB_APP_TOKEN` (or Drizzle-equivalent env vars) directly rather than through the `astro:db` virtual module.
2. Once off `astro:db`, re-verify both `GuestBook` reads/writes and `Stamps` reads under `wrangler dev`/a Pages preview before cutting over, and add `nodejs_compat` to `wrangler.toml` regardless, since other parts of the Astro/Cloudflare adapter stack commonly need it.
3. Track this against the broader `astro` upgrade path too: staying on Astro 5.x/`@astrojs/db` 0.20.x is fine short-term, but any future Astro major upgrade will force this same migration anyway since the package is gone in v7.
