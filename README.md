![Chinmay builds things for the web.](public/og.png)

# Chinmay Sawant

Source code for [chinmay.fyi](https://chinmay.fyi/) — my little corner of the internet.
I'm constantly tweaking it to improve the experience. I post random nicheless notes, and
once in a while, write on software and design.

For a breakdown of how I built this, check out the [Colophon](https://chinmay.fyi/colophon).

## Stack

- **[Astro 5](https://astro.build/)** — static output, with a couple of on-demand routes
- **[MDX](https://mdxjs.com/)** for posts, with [Shiki](https://shiki.style/) + Twoslash for code blocks
- **[React 19](https://react.dev/)** islands where a page genuinely needs interactivity
- **[Tailwind CSS 4](https://tailwindcss.com/)**
- **[Cloudflare Workers](https://workers.cloudflare.com/)** for hosting, via `@astrojs/cloudflare`

## Development

```bash
pnpm install
pnpm dev          # astro dev
pnpm build        # astro check && astro build
pnpm preview      # wrangler dev — runs the built worker locally
pnpm lint:fix     # prettier --write .
```

No environment variables are required to run the site.

## Deployment

Pushes to `main` build and deploy automatically through
[Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/). Routing lives in
`wrangler.jsonc`: `chinmay.fyi` and `www.chinmay.fyi` are attached as custom domains, and a
Cloudflare Redirect Rule sends `www` to the apex.

`pnpm wrangler deploy` still works for deploying by hand.

## Layout

```
src/
  assets/art/      # gallery pieces, pre-converted WebP
  components/      # layout, home bento tiles, art panels, ui
  content/         # posts, projects, mini-projects, colophon, about
  data/            # bento config, resolved iTunes tracks
  lib/             # data helpers — art, itunes, lanyard, wakatime
  pages/           # routes
  styles/
scripts/
  refresh-tracks.mjs
```

Beyond the writing there's a bento home page, an [/art](https://chinmay.fyi/art) gallery, plus
[/lifeline](https://chinmay.fyi/lifeline), [/bookshelf](https://chinmay.fyi/bookshelf),
[/bookmarks](https://chinmay.fyi/bookmarks), [/blogroll](https://chinmay.fyi/blogroll),
[/zibaldone](https://chinmay.fyi/zibaldone) and a few other corners.

### Adding art

Export as WebP (1600w is plenty — panels never render wider), drop it in `src/assets/art/`,
and add an entry to `src/lib/art-data.ts`. Pieces sort newest-first.

### The music tile

Tracks are resolved ahead of time rather than at request time, because Apple blocks
Cloudflare's shared Workers egress IP. Edit the list in `scripts/refresh-tracks.mjs`, then:

```bash
node scripts/refresh-tracks.mjs   # writes src/data/tracks.json
```

## Inspiration

- [Eva Decker](https://eva.town/) — for digital gardens and a certain calm, intentional
  personal site energy.
- [Ky Decker](https://ky.fyi/) — designer and developer in NYC, whose site spans procedural
  art, web tools and writing on design.

## Credits & license

The foundations of this site come from Edward Kim's MIT-licensed work — see
[`LICENSE`](LICENSE), which retains their copyright. Much has been rebuilt or added since,
but the original license stands and travels with the code.

The writing, art and other content are mine; please don't republish those as your own.
