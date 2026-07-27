import type { APIRoute } from 'astro';
import { BENTO } from '~/data/bento';
import { resolveTracks } from '~/lib/itunes';

/** Required so this route runs on the server at request time (calls iTunes). */
export const prerender = false;

/**
 * The music tile used to call itunes.apple.com straight from the browser, which
 * prod blocked as a cross-origin request. Resolving here makes the tile's fetch
 * same-origin, and the shared edge cache below means Apple sees roughly one
 * request a day for the whole site rather than one per cold visitor — which also
 * keeps us clear of its per-IP rate limit.
 */
const CACHE_OK =
  'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800';

/**
 * Short, so a transient Apple failure is not pinned at the edge for a day. The
 * `stale-while-revalidate` above means a previous good response keeps serving
 * for up to a week regardless, so a blip is usually invisible to visitors.
 */
const CACHE_ERROR = 'public, max-age=0, s-maxage=60';

const json = (body: unknown, status: number, cache: string) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': cache },
  });

export const GET: APIRoute = async () => {
  try {
    const tracks = await resolveTracks([...BENTO.music.tracks]);
    // An empty list means every configured track is absent from the catalogue —
    // a config problem, not an outage, so it is safe to cache normally.
    return json({ tracks }, 200, CACHE_OK);
  } catch (error) {
    console.error('[api/music] failed to resolve tracks', error);
    return json({ tracks: [], error: 'upstream_failed' }, 502, CACHE_ERROR);
  }
};
