import { cfg } from '~/cfg';

const link = (label: string) =>
  cfg.bio.links.find((l) => l.label === label)?.url ?? '';

/** Title line on the printed card. Not part of the encoded contact. */
export const CARD_ROLE = 'Software engineer';

/** Display name, shared by the card and the encoded record. */
export const cardName = () => titleCase(cfg.bio.name);

/**
 * The contact record, built from site config so there is no second copy of the
 * email or the URLs.
 *
 * This exact string is what the card's QR encodes, and what `/card.vcf` serves.
 * A printed card outlives its hosting, so the code carries the whole record
 * rather than a link to one: if the site moves or goes away, a card already in
 * someone's wallet still scans and still yields a name and an email.
 *
 * It is kept deliberately lean, because every field lengthens the payload and
 * pushes the QR to a denser version, which shrinks the embedded figure. Two
 * concrete trims: EMAIL carries no `;TYPE=INTERNET` (that is the default, and it
 * costs 14 characters), and there is no LinkedIn profile field, which on its own
 * pushed the code four versions denser and left the artwork unreadable.
 *
 * N is kept even though FN alone would satisfy modern clients: it is what lets a
 * contacts app split the name into first and last, which is the whole point of
 * scanning a business card.
 *
 * CRLF line endings and the escaping below are required by RFC 6350; commas,
 * semicolons and backslashes are structural in vCard and must be escaped in
 * values.
 */
export function buildVcard(): string {
  const esc = (v: string) => v.replace(/([\\,;])/g, '\\$1');
  const [first = '', ...rest] = titleCase(cfg.bio.name).split(' ');
  const last = rest.join(' ');
  const email = link('mail').replace(/^mailto:/, '');

  return [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${esc(last)};${esc(first)};;;`,
    `FN:${esc(titleCase(cfg.bio.name))}`,
    `EMAIL:${esc(email)}`,
    `URL:${esc(cfg.siteUrl.replace(/\/$/, ''))}`,
    'END:VCARD',
    // RFC 6350 wants a trailing CRLF after END:VCARD. Lenient parsers cope
    // without it; strict ones do not.
    '',
  ].join('\r\n');
}

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

/** Rows printed on the card, in reading order. */
export function cardLines() {
  return [
    { label: 'Email', value: link('mail').replace(/^mailto:/, '') },
    {
      label: 'Web',
      value: cfg.siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, ''),
    },
    { label: 'GitHub', value: shortHandle(link('github')) },
    { label: 'LinkedIn', value: shortHandle(link('linkedin')) },
  ].filter((r) => r.value);
}

const shortHandle = (url: string) => {
  if (!url) return '';
  const seg = new URL(url).pathname.split('/').filter(Boolean).pop() ?? '';
  return seg;
};
