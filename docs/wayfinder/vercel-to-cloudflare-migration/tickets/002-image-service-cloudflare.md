---
label: wayfinder:research
status: closed
assignee: research-subagent
blocks: []
blocked_by: []
---

# What image service config does this site need under the Cloudflare adapter?

## Question

Astro's default image service (`astro:assets`) uses Sharp, which isn't available in
the Cloudflare Workers runtime. This site uses `astro:assets`/`<Image>` in several
places (e.g. `src/components/layout/post-image.astro`) and most content images
appear to already be served remotely via Cloudinary.

- What does `@astrojs/cloudflare` require for `image.service` — is there a built-in
  passthrough/no-op service, or do we need Cloudflare Images / a custom loader?
- For images that ARE local (not Cloudinary-hosted) and go through
  `astro:assets`, does build-time optimization still work (since that runs in Node
  during `astro build`, not in the Workers runtime), or does something break?
- Any config needed in `astro.config.ts` beyond swapping the adapter (e.g.
  `image: { service: ... }`)?

## Answer

**Verdict: an explicit `image.service` / `imageService` decision is required — the default is not simply "off," and it silently restricts `astro:assets` on non-prerendered routes.**

### Version context (important)

This site is on `astro@^5.11.0`. The `@astrojs/cloudflare` adapter has diverged sharply by major version:

- `@astrojs/cloudflare@12.x` — peers on `astro ^5.0.0` / `^5.7.0`. **This is the version this migration will actually install.** Latest in this line is `12.6.13`.
- `@astrojs/cloudflare@13.x` / `14.x` — require `astro ^6.0.0` / `^7.0.0` respectively, and add a *new* `cloudflare-binding` runtime option (Cloudflare Images binding, auto-provisioned) as the default `imageService`. **This does not apply here** unless Astro itself is also upgraded past v5 as part of the migration. Any doc/blog page describing `cloudflare-binding` as the default is describing v13+/Astro 6, not this project's target version.

### 1. What does `@astrojs/cloudflare` (v12.x, matching this site) require/recommend for images?

The adapter has its own `imageService` option (separate from Astro's top-level `image.service`), accepted values in v12: `'passthrough' | 'compile' | 'cloudflare' | 'custom'`.

- No Cloudflare Images integration is required — `passthrough` (the pre-v11 default, a no-op service) is fully supported and documented as the safe fallback.
- Since adapter v11.0.0 (carried into v12), **the default changed from `passthrough` to `compile`**. `compile` optimizes local images with Sharp at build time, but *only for prerendered/static routes* — it silently disables `astro:assets` image features (`<Image>`/`<Picture>` optimization) on any on-demand/SSR route. This is a documented breaking change, not a bug, but it's easy to miss.

Source: `@astrojs/cloudflare` CHANGELOG, v11.0.0 entry ("BREAKING: `imageService`"): "In the past the default behavior was falling back to a `noop` service... The new default is `compile`, which enables image optimization for prerendered pages during build, but disallows the usage of any `astro:assets` feature inside of on-demand pages." — https://github.com/withastro/adapters/blob/main/packages/cloudflare/CHANGELOG.md

### 2. Does build-time optimization for LOCAL images still work under this adapter?

Yes for prerendered pages, no for on-demand pages — and this is adapter-specific, not a Node-vs-Workers artifact of `astro build` itself:

- `astro build` always runs in Node regardless of adapter, so Sharp is available at build time in every case.
- With the v12 default (`imageService: 'compile'`), Astro uses Sharp to optimize local `<Image>`/`<Picture>` images at build time **only for statically prerendered routes**. Since this site uses `output: 'server'` today, and per Ticket context is moving to Cloudflare, routes rendered on-demand (SSR) will hit `astro:assets` at runtime in the Workers/Pages Functions runtime — where Sharp is unavailable — and Astro will throw/error unless a no-op/passthrough image service is configured for the runtime path.
- Practical implication for this repo: `src/components/layout/post-image.astro` (and any other `<Image>` usage) needs to be audited for whether it's used on prerendered pages only, or also reachable from SSR/on-demand routes. If any on-demand route renders it, `compile`-only will break in production.

Source: same CHANGELOG entry as above, plus Astro Images guide (see below) which states the base Sharp service is not compatible with the Workers runtime.

### 3. Required `astro.config.ts` change beyond swapping the adapter?

Yes — recommend making the choice explicit rather than relying on the v12 default:

```ts
// astro.config.ts
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    imageService: 'passthrough', // safest: no-op everywhere, avoids surprise
    // OR: 'compile' to keep Sharp optimization for prerendered routes only,
    // if this site's local <Image> usage is confirmed to be static-only.
  }),
});
```

Astro's own top-level `image.service` / `passthroughImageService()` (`astro/config`) is the underlying mechanism the adapter's `passthrough` option maps to, and is the officially documented pattern for any adapter that can't run Sharp:

```ts
import { defineConfig, passthroughImageService } from 'astro/config';

export default defineConfig({
  image: {
    service: passthroughImageService(),
  },
});
```

Using this, `astro:assets`/`<Image>`/`<Picture>` still work for layout benefits (enforced `alt`, no CLS) but perform **no transformation/resizing/format-conversion** — width/height/format come from the source file as-is. If any current local images rely on Astro resizing/format conversion (not just Cloudinary remote images), that optimization is lost unless pre-optimized source assets are shipped, or Cloudflare Image Resizing / a Cloudflare Images binding is adopted later (v13+/Astro 6 path).

Recommendation for this ticket: set `imageService: 'passthrough'` explicitly for predictability across all routes (SSR + prerendered), given the mixed `output: 'server'` setup, rather than relying on the `compile` default which behaves differently per-route-type.

Sources:
- Astro Images guide — passthrough/no-op service for adapters without Sharp support: https://docs.astro.build/en/guides/images/
- `@astrojs/cloudflare` integration guide: https://docs.astro.build/en/guides/integrations-guide/cloudflare/
- `@astrojs/cloudflare` CHANGELOG (v11.0.0 breaking change, v12.x Astro 5 support): https://github.com/withastro/adapters/blob/main/packages/cloudflare/CHANGELOG.md
- npm registry version/peerDependency history for `@astrojs/cloudflare` (confirms v12.x → astro ^5.x, v13.x → astro ^6.x, v14.x → astro ^7.x): https://registry.npmjs.org/@astrojs/cloudflare

### 4. Caveats for remote images (Cloudinary URLs) through `<Image>`?

None specific to the Cloudflare adapter. Remote image allowlisting (`image.domains` / `image.remotePatterns` in `astro.config.ts`) is a core Astro feature independent of the adapter — it's already required today under Vercel and doesn't change under Cloudflare. Two things to double check, unrelated to the adapter swap itself:

- Confirm `image.domains`/`image.remotePatterns` in `astro.config.ts` already includes the Cloudinary hostname (needed regardless of hosting target).
- If `imageService` is set to `passthrough`/`compile` on the Cloudflare adapter, remote images processed through `<Image>` are subject to the same constraint as local ones: `compile` only optimizes at build time for prerendered pages, and Astro's remote-image optimization at request time for on-demand routes would hit the same Sharp-unavailable-in-Workers problem. Since most Cloudinary images are apparently referenced as plain URLs (not run through `<Image>`), this is likely low-impact here, but any `<Image src={cloudinaryUrl}>` usage on SSR routes should be flagged in the same audit as item 2.
