/**
 * Shape of a resolved iTunes track, shared by the /api/music route and the
 * music tile's client script.
 *
 * The fetching logic that used to live here is gone: Apple blocks Cloudflare's
 * shared Workers egress IP, so nothing running on the edge can resolve tracks.
 * That work moved to scripts/refresh-tracks.mjs, which runs on a normal network
 * and commits its output to src/data/tracks.json.
 */
export interface Track {
  title: string;
  artist: string;
  album: string;
  year: string;
  artwork: string;
  preview: string;
  url: string;
}
