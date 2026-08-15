import type { APIRoute } from 'astro';
import type { Track } from '~/lib/itunes';
import tracks from '~/data/tracks.json';

/** Kept server-side so the tile's fetch stays same-origin, as it was before. */
export const prerender = false;

/**
 * The tile used to call itunes.apple.com from the browser, which prod blocked
 * cross-origin; resolving here fixed that. Since the move to Cloudflare this
 * route can't call Apple either — Apple 403s the shared Workers egress IP
 * (2a06:98c0:3600::103) regardless of headers, and 429s /search on the same
 * basis. Headers, retries and backoff are all useless against an IP block.
 *
 * So the list is resolved ahead of time by scripts/refresh-tracks.mjs and
 * committed as src/data/tracks.json. The playlist is four pinned track IDs
 * that change maybe never, so there was little point asking Apple at runtime
 * even when it worked. Re-run that script when the track list changes.
 */
const CACHE_OK =
  'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800';

export const GET: APIRoute = async () =>
  new Response(JSON.stringify({ tracks: tracks as Track[] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': CACHE_OK },
  });
