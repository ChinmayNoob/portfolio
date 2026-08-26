import githubArt from '~/assets/bento/github-character-light.svg?raw';
import linkedinArt from '~/assets/bento/linkedin-character-light.svg?raw';
import mailArt from '~/assets/bento/mail-character-light.svg?raw';
import xArt from '~/assets/bento/x-character-light.svg?raw';

/**
 * Presentation for the /contact cards. URLs are NOT repeated here — they come
 * from `cfg.bio.links` in site.config.ts, and the handle is derived from the
 * URL so the two can never drift apart.
 */
export type ContactArt = {
  /** Card heading. */
  display: string;
  /**
   * SVG source of the figure embedded in the code. Imported `?raw` rather than
   * read from disk: `import.meta.url` points at a bundled chunk in the built
   * output, not the source tree, so a path would resolve in dev and fail at
   * build time.
   */
  art: string;
  /** Pulls the display handle out of the configured URL. */
  handle: (url: string) => string;
};

/** Last non-empty path segment of a URL. */
const lastSegment = (url: string) =>
  new URL(url).pathname.split('/').filter(Boolean).pop() ?? '';

export const CONTACT_ART: Record<string, ContactArt> = {
  github: {
    display: 'GitHub',
    art: githubArt,
    handle: (url) => `@${lastSegment(url)}`,
  },
  x: {
    display: 'X',
    art: xArt,
    handle: (url) => `@${lastSegment(url)}`,
  },
  linkedin: {
    display: 'LinkedIn',
    art: linkedinArt,
    handle: (url) => lastSegment(url),
  },
  mail: {
    display: 'Email',
    art: mailArt,
    handle: (url) => url.replace(/^mailto:/, ''),
  },
};
