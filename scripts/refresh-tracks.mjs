/**
 * Resolves the tracks in src/data/bento.ts against the iTunes Search API and
 * writes the result to src/data/tracks.json, which /api/music then serves as
 * a prerendered static file.
 *
 * Why this is a script and not a request-time fetch: Apple blocks Cloudflare's
 * shared Workers egress IP outright (403 on /lookup, 429 on /search, keyed on
 * the egress address rather than any header). Nothing the Worker sends can get
 * through, so the resolution has to happen somewhere Apple will answer — your
 * machine — and the result travels in git.
 *
 * Run from a normal network connection whenever the track list changes:
 *   node scripts/refresh-tracks.mjs
 */

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const LOOKUP_URL = 'https://itunes.apple.com/lookup';
const SEARCH_URL = 'https://itunes.apple.com/search';

/** Pinned so results don't drift with the caller's storefront. */
const COUNTRY = 'us';
const TIMEOUT_MS = 10000;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'src', 'data', 'tracks.json');

/**
 * Kept in step with BENTO.music.tracks in src/data/bento.ts by hand — this
 * script is plain node and can't import the TypeScript module.
 */
const TRACKS = [
  { trackId: 1471277629 }, // Money Trees (feat. Jay Rock) — Kendrick Lamar
  { trackId: 1146195718 }, // Self Control — Frank Ocean
  { trackId: 1842957386 }, // Loser — Tame Impala
  { trackId: 917014903 }, // White Dress — Kanye West
];

const toTrack = (result) => {
  if (!result?.trackName || !result.previewUrl) return null;
  return {
    title: result.trackName,
    artist: result.artistName ?? '',
    album: result.collectionName ?? '',
    year: result.releaseDate?.slice(0, 4) ?? '',
    // The API hands back a 100px thumbnail; the URL is resizable by name.
    artwork: (result.artworkUrl100 ?? '').replace(
      /\/\d+x\d+bb\.jpg$/,
      '/600x600bb.jpg',
    ),
    preview: result.previewUrl,
    url: result.trackViewUrl ?? '',
  };
};

const getJson = async (url) => {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  if (!response.ok) {
    throw new Error(`iTunes responded ${response.status} for ${url}`);
  }
  const body = await response.json();
  return body.results ?? [];
};

const resolveTracks = async (inputs) => {
  const ids = inputs
    .map((input) => input.trackId)
    .filter((id) => typeof id === 'number');

  const byId = new Map();
  if (ids.length) {
    // One batched lookup — iTunes throttles bursts of single-id requests.
    const results = await getJson(
      `${LOOKUP_URL}?id=${ids.join(',')}&country=${COUNTRY}`,
    );
    for (const result of results) {
      if (typeof result.trackId === 'number') byId.set(result.trackId, result);
    }
  }

  const tracks = [];
  for (const input of inputs) {
    if (typeof input.trackId === 'number') {
      const track = toTrack(byId.get(input.trackId));
      if (track) tracks.push(track);
      else console.warn(`  ! ${input.trackId} did not resolve (not in catalogue?)`);
      continue;
    }
    if (!input.term) continue;
    const results = await getJson(
      `${SEARCH_URL}?term=${encodeURIComponent(input.term)}&entity=song&limit=1&country=${COUNTRY}`,
    );
    const track = toTrack(results.find((r) => r.previewUrl));
    if (track) tracks.push(track);
    else console.warn(`  ! "${input.term}" did not resolve`);
  }
  return tracks;
};

const tracks = await resolveTracks(TRACKS);

// Refuse to write an empty file — that would silently blank the tile. A failed
// run should leave the last good tracks.json in place.
if (!tracks.length) {
  console.error('Resolved 0 tracks; leaving tracks.json untouched.');
  process.exit(1);
}

await writeFile(OUT, `${JSON.stringify(tracks, null, 2)}\n`, 'utf8');
console.log(`Wrote ${tracks.length} tracks to src/data/tracks.json`);
for (const t of tracks) console.log(`  - ${t.title} — ${t.artist}`);
