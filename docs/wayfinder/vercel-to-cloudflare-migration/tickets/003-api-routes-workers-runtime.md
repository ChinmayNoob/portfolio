---
label: wayfinder:research
status: closed
assignee: research-subagent
blocks: []
blocked_by: []
---

# Do the existing dynamic API routes and adapter config need changes for Workers?

## Question

Two routes are `prerender = false` (dynamic, server-rendered per request):
`src/pages/api/check-embeddable.ts` and `src/pages/api/music.ts`. Both only use
`fetch`, `URL`, `AbortSignal.timeout`, and `Response` — no Node built-ins observed.

- Are `fetch`, `URL`, and `AbortSignal.timeout` fully supported as-is in Cloudflare
  Workers, with no polyfill/compat flag needed?
- Does `@astrojs/cloudflare` need any special config for `output: 'server'` mixed
  with static/prerendered pages (this site has both), e.g. routing config in
  `wrangler.toml` or `_routes.json`?
- What does `wrangler.toml` need at minimum for an Astro Cloudflare Pages/Workers
  deploy of this shape (server output, some prerendered pages, one D1/none, KV: none)?
- Any required Node compatibility flag (`nodejs_compat`) given the dependency tree
  (e.g. does `@astrojs/mdx`, `github-slugger`, `markdown-it`, or `medium-zoom`'s
  server-side usage pull in any Node core module at request time)?

## Answer

### 1. `fetch`, `URL`, `AbortSignal.timeout` — fully supported, no polyfill/flag needed

All three are implemented natively in the `workerd` runtime as part of Cloudflare's standards-compliant Web APIs (Fetch, URL, and the `AbortController`/`AbortSignal` integration with `EventTarget`/`fetch`/streams). `AbortSignal.timeout(ms)` is a supported convenience method for aborting a `fetch()` after a delay. No `compatibility_flags` and no polyfill are required for these three APIs — they are plain Workers runtime globals, not Node built-ins.

One caveat found in the wild: a `workerd` GitHub issue (cloudflare/workerd#1020) reports `AbortSignal.timeout()` throwing an uncaught async `DOMException` instead of being catchable — but this was only reproduced under local `wrangler dev` (Miniflare), not under `--remote`/production. Given `check-embeddable.ts` and `music.ts` already wrap their `fetch` calls in `try/catch` (per source), this should not surface in production, but it's worth a quick smoke test against `wrangler dev --remote` or a preview deployment before cutover.

Verdict: **no changes needed** to these two routes for `fetch`/`URL`/`AbortSignal.timeout` usage.

### 2. Mixed prerendered + SSR routing config for `@astrojs/cloudflare`

No manual routing config is required for the common case. The adapter builds a `dist/_worker.js` (SSR worker) alongside the static assets in `dist/`, and Cloudflare's asset-serving layer routes requests: if the request path matches a static file in the build output, it's served directly (no Worker invocation); otherwise it falls through to the Worker for on-demand (SSR) rendering. This is exactly the mixed static+SSR shape this site needs, and it works out of the box.

By default, `@astrojs/cloudflare` auto-generates a `_routes.json` with `include`/`exclude` rules derived from the site's static vs. dynamic routes (and any `_redirects` entries go into `exclude`), so Cloudflare knows which paths can skip the Worker entirely. **Do not hand-write a custom `_routes.json`** unless there's a specific reason — doing so overrides the adapter's automatic optimization and can cause extra Worker invocations (which count against request-based billing/limits) for paths that should have been served as static assets.

Practical config notes for `astro.config.ts`:
- `output: 'server'` stays as-is; the Cloudflare adapter honors per-page `export const prerender = true/false` the same way Vercel's does.
- No special adapter option is needed purely for "mixed" output — this is the default behavior of `@astrojs/cloudflare`.
- If using image optimization or other adapter options previously set for Vercel, they'll need Cloudflare-specific equivalents (e.g., `imageService` config), but that's out of scope for these two API routes.

### 3. Minimal `wrangler.toml` (or `wrangler.jsonc`) for this deployment shape

For SSR + prerendered pages with **no D1/KV/R2 bindings** (the two API routes only do outbound HTTP `fetch` to a remote libSQL/Turso-style endpoint, which needs no Cloudflare binding at all — it's just an HTTPS call), the wrangler config can be genuinely minimal. Astro's own docs now treat the Wrangler config file as **optional** for simple projects (Astro auto-generates sane defaults), but for explicitness/CI reproducibility, a minimal file is recommended:

```jsonc
// wrangler.jsonc
{
  "name": "portfolio", // your Worker/project name
  "compatibility_date": "2026-08-01", // use a recent date
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS"
  },
  "main": "./dist/_worker.js/index.js"
}
```

or the TOML equivalent:

```toml
name = "portfolio"
compatibility_date = "2026-08-01"
main = "./dist/_worker.js/index.js"

[assets]
directory = "./dist"
binding = "ASSETS"
```

No `[[d1_databases]]`, `[[kv_namespaces]]`, or `[[r2_buckets]]` blocks are needed since the remote libSQL DB is reached over plain HTTP(S) `fetch` from the Worker, not via a Cloudflare binding. Add `nodejs_compat` (see below) only if a dependency turns out to need a real `node:*` module at request time — current analysis says it doesn't.

### 4. `nodejs_compat` — not required for the build-time toolchain; confirm no request-time use

Confirmed: MDX/Markdown compilation (`@astrojs/mdx`, `markdown-it`, `shiki`/`@shikijs/*`, `rehype-external-links`, `rehype-slug`, `rehype-autolink-headings`, `remark-breaks`, `github-slugger`) all run **during `astro build`** under Node, transforming `.md`/`.mdx` content into static HTML/Astro components ahead of time. None of this pipeline executes per-request in the deployed Worker — by the time the SSR worker handles a request, content has already been compiled to output. `medium-zoom` is a client-side (browser) library, not server code, so it's irrelevant to the Workers runtime entirely. This confirms the assumption in the question.

Important related risk (not a correctness issue, but worth flagging for the migration): a known Astro issue (withastro/astro#16070) shows that `shiki` and its language grammars can still get **statically bundled into the SSR server output** even when syntax highlighting isn't needed at runtown, because `@astrojs/markdown-remark` uses static top-level imports of shiki that Rollup/Vite can't tree-shake — even with `markdown.syntaxHighlight: false`. This doesn't mean shiki *runs* at request time, but it can bloat `dist/_worker.js` by several MB, which matters because Cloudflare Workers enforce a hard size limit (1 MB compressed / 3 MB uncompressed on the standard plan, higher on paid plans with Workers Unbound/Bundled). Recommendation: after the first Cloudflare build, check the resulting worker bundle size (`wrangler deploy --dry-run` or inspect `dist/_worker.js`) and if it's bloated, consider Astro's built-in Shiki language/theme trimming options or evaluate whether this is hitting the project.

Verdict: **`nodejs_compat` is not required** based on current dependency usage (no `node:*` imports observed in the two dynamic routes or in request-time code paths). Revisit only if bundle inspection turns up an actual `node:*` import pulled in transitively at runtime, or if a future dependency needs one — in that case add:

```toml
compatibility_flags = ["nodejs_compat"]
compatibility_date = "2024-09-23" # or later, required for nodejs_compat polyfill injection
```

### Sources

- https://developers.cloudflare.com/workers/runtime-apis/web-standards/
- https://developers.cloudflare.com/workers/runtime-apis/fetch/
- https://developers.cloudflare.com/workers/runtime-apis/handlers/fetch/
- https://developer.mozilla.org/docs/Web/API/AbortSignal/timeout_static
- https://github.com/cloudflare/workerd/issues/1020
- https://docs.astro.build/en/guides/integrations-guide/cloudflare/
- https://docs.astro.build/en/guides/deploy/cloudflare/
- https://developers.cloudflare.com/pages/framework-guides/deploy-an-astro-site/
- https://github.com/withastro/astro/issues/16070
- https://github.com/withastro/astro/issues/8520
