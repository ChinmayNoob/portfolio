/**
 * Configuration for the home page bento tiles.
 *
 * These all hit public, client-side endpoints — no secrets involved.
 * Swap the placeholders below for your own once each service is set up.
 */
export const BENTO = {
  /** GitHub username for the contribution calendar tile (f). */
  githubUsername: 'chinmaynoob',

  /**
   * Public WakaTime "share" JSON URL for the languages tile (j).
   * WakaTime → Profile → Share → Languages → Embed → copy the .json URL.
   * While this is empty the tile renders `wakatimeFallback` instead.
   */
  wakatimeShareUrl:
    'https://wakatime.com/share/@018bc742-4ceb-42a3-93ef-eb5fba9fee1e/950160c6-0c93-4550-9783-73bc2538c0c8.json',

  /**
   * Shown by the languages tile until `wakatimeShareUrl` is set (and if the
   * fetch ever fails). `[language, hours]`, highest first — the language names
   * must match the icon set in bento-wakatime-graph.astro to get a glyph
   * instead of a letter: astro, c, c++, css, figma, svelte, html, javascript,
   * tex, markdown, mdx, python, typescript, yaml, jupyter notebook.
   */
  wakatimeFallback: [
    ['TypeScript', 922],
    ['Python', 682],
    ['MDX', 565],
    ['Astro', 289],
    ['CSS', 192],
    ['YAML', 172],
  ] as [string, number][],

  /**
   * Your Discord user ID (snowflake). Drives BOTH the presence tile (d) and
   * the now-playing tile (g) — Lanyard reports Discord status, activity, and
   * Spotify playback in one payload, over one shared WebSocket.
   *
   * Two steps to enable it:
   *   1. Join https://discord.gg/lanyard with the account you want shown.
   *      Lanyard only tracks members of that server; you can leave it later
   *      but tracking stops when you do.
   *   2. In Discord, turn on Settings → Advanced → Developer Mode, then
   *      right-click your avatar → "Copy User ID" and paste it here.
   *
   * For the music tile you additionally need, in Discord:
   *   User Settings → Connections → connect Spotify, with "Display Spotify as
   *   your status" turned on. Nothing is needed from the Spotify API itself.
   *
   * Verify with: https://api.lanyard.rest/v1/users/<your-id>
   */
  lanyardUserId: '535038210976514058',

  /**
   * SSE endpoint in the event shape src/lib/discord-presence.ts parses. Only
   * needed if you self-host a relay (as enscribe does) instead of using
   * Lanyard above; Lanyard takes precedence.
   */
  discordStreamUrl: '',

  /**
   * The music tile (g). Tracks are resolved through the iTunes Search API —
   * no key, no account, no server. It supplies the title, artist, album,
   * cover art and a ~30 second preview clip.
   *
   * Give each entry a `term` (the first matching song wins) or, to pin an
   * exact recording, a `trackId` from the API. To find one:
   *   https://itunes.apple.com/search?term=<song+artist>&entity=song&limit=5
   * and read `trackId` off the result you want.
   *
   * Resolved results are cached in localStorage for a week.
   */
  music: {
    tracks: [
      { trackId: 1471277629 }, // Money Trees (feat. Jay Rock) — Kendrick Lamar
      { trackId: 1146195718 }, // Self Control — Frank Ocean
      { trackId: 1842957386 }, // Loser — Tame Impala
      { trackId: 917014903 }, // White Dress — Kanye West
      // Japanese Denim (Daniel Caesar) and Ensalada (Freddie Gibbs) are not in
      // the iTunes catalogue — see the note in the chat. Add them here if you
      // find IDs for them.
    ] as { term?: string; trackId?: number }[],
  },

  /** Shown before (or instead of) live data arrives. */
  discord: {
    avatar: '/avatar.avif',
    displayName: 'Chinmay',
    handle: '@chinmaynoob',
  },
} as const;
