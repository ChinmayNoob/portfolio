const SEARCH_URL = 'https://itunes.apple.com/search';
const LOOKUP_URL = 'https://itunes.apple.com/lookup';

/**
 * Pinned so the result does not drift with whichever Vercel region serves the
 * request. Apple resolves the storefront from the caller's IP otherwise, and a
 * track missing from that storefront comes back with no `previewUrl`.
 */
const COUNTRY = 'us';

const TIMEOUT_MS = 5000;

export interface TrackInput {
  term?: string;
  trackId?: number;
}

export interface Track {
  title: string;
  artist: string;
  album: string;
  year: string;
  artwork: string;
  preview: string;
  url: string;
}

interface ItunesResult {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  releaseDate?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  trackViewUrl?: string;
}

const toTrack = (result: ItunesResult | undefined): Track | null => {
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

/**
 * Throws on transport or HTTP failure so the caller can tell "Apple is down or
 * throttling us" apart from "Apple answered, nothing matched" — the two want
 * very different cache lifetimes.
 */
const getJson = async (url: string): Promise<ItunesResult[]> => {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    // Apple 403s some datacenter traffic that arrives without a User-Agent.
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  if (!response.ok) {
    throw new Error(`iTunes responded ${response.status} for ${url}`);
  }
  const body = (await response.json()) as { results?: ItunesResult[] };
  return body.results ?? [];
};

/**
 * Resolves the configured list, preserving its order.
 *
 * All the `trackId` entries go out as ONE batched lookup — iTunes throttles
 * bursts, and firing a request per track meant some silently came back
 * empty. `term` entries still need a search each, so they run sequentially.
 */
export const resolveTracks = async (inputs: TrackInput[]): Promise<Track[]> => {
  const ids = inputs
    .map((input) => input.trackId)
    .filter((id): id is number => typeof id === 'number');

  const byId = new Map<number, ItunesResult>();
  if (ids.length) {
    const results = await getJson(
      `${LOOKUP_URL}?id=${ids.join(',')}&country=${COUNTRY}`,
    );
    for (const result of results) {
      if (typeof result.trackId === 'number') byId.set(result.trackId, result);
    }
  }

  const tracks: Track[] = [];
  for (const input of inputs) {
    if (typeof input.trackId === 'number') {
      const track = toTrack(byId.get(input.trackId));
      if (track) tracks.push(track);
      continue;
    }
    if (!input.term) continue;
    const results = await getJson(
      `${SEARCH_URL}?term=${encodeURIComponent(input.term)}&entity=song&limit=1&country=${COUNTRY}`,
    );
    const track = toTrack(results.find((r) => r.previewUrl));
    if (track) tracks.push(track);
  }
  return tracks;
};
