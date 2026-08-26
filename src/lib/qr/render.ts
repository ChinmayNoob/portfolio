import { artInnerMarkup, artMask } from './art';
import { QR_QUIET, QR_SIZE, ringIndex, toMatrix } from './matrix';

/**
 * Coverage at or above this removes the module outright, letting the artwork
 * read at full strength. Below it, but above {@link TINT_AT}, the module stays
 * put and is only recoloured.
 */
const OCCLUDE_AT = 0.55;

/** Coverage at or above this recolours the module. */
const TINT_AT = 0.06;

/**
 * Ceiling on removed modules, as a fraction of the symbol. ECC level H recovers
 * 30%; staying well under that leaves headroom for print, screen glare and
 * cheap scanners. Exceeding it fails the build rather than shipping a code that
 * scans on the developer's phone and nothing else.
 */
const MAX_OCCLUSION = 0.16;

/**
 * Default height of the artwork, in modules.
 *
 * Chosen empirically, not by taste. Sweeping the four cards, every one decodes
 * at 26 and every one fails at 28 — a sharp error-correction cliff rather than
 * a gradual decline. 22 sits two steps back from it, which is the margin that
 * keeps a later art tweak from silently landing on the edge.
 */
const ART_HEIGHT = 22;

/** Per-ring animation delay, in milliseconds. */
const RING_MS = 15;

export type QrSvgOptions = {
  /**
   * SVG source of the artwork to embed, or null for a plain code. Source text
   * rather than a path so it survives bundling — import it with Vite's `?raw`.
   */
  art?: string | null;
  /** Accessible name for the rendered code. */
  title: string;
  /** Height of the artwork in modules; defaults to {@link ART_HEIGHT}. */
  artHeight?: number;
};

export type QrSvgResult = {
  svg: string;
  /** Fraction of the symbol removed under the artwork. */
  occlusionRatio: number;
  /** Longest animation delay in ms, so callers can size a settle timeout. */
  settleMs: number;
};

export async function renderQrSvg(
  url: string,
  { art: artSource = null, title, artHeight = ART_HEIGHT }: QrSvgOptions,
): Promise<QrSvgResult> {
  const matrix = toMatrix(url);
  const { size } = matrix;

  const mask =
    artSource && artHeight > 0
      ? await artMask(artSource, { size, heightInModules: artHeight })
      : null;

  const ink: string[] = [];
  const tint: string[] = [];
  let occluded = 0;
  let maxRing = 0;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!matrix.isDark(x, y)) continue;

      const cover = mask ? mask.at(x, y) : 0;
      const reserved = matrix.isReserved(x, y);

      // Structural modules are never removed, whatever the artwork wants.
      if (!reserved && cover >= OCCLUDE_AT) {
        occluded++;
        continue;
      }

      const ring = ringIndex(x, y, size);
      if (ring > maxRing) maxRing = ring;

      // Reserved modules keep full contrast; tinting them would put the
      // finder and timing patterns at risk for a purely cosmetic gain.
      const target = !reserved && cover >= TINT_AT ? tint : ink;
      target.push(
        `<rect x="${x}" y="${y}" width="1.02" height="1.02" style="--i:${ring}"/>`,
      );
    }
  }

  const occlusionRatio = occluded / (size * size);
  if (occlusionRatio > MAX_OCCLUSION) {
    throw new Error(
      `Artwork removes ${(occlusionRatio * 100).toFixed(1)}% of the symbol, ` +
        `over the ${(MAX_OCCLUSION * 100).toFixed(0)}% ceiling ` +
        `for "${title}". Shrink ART_HEIGHT or simplify the artwork.`,
    );
  }

  const min = -QR_QUIET;
  const span = size + QR_QUIET * 2;

  const art = mask
    ? `<svg class="qr-art" x="${mask.rect.x}" y="${mask.rect.y}" ` +
      `width="${mask.rect.w}" height="${mask.rect.h}" ` +
      `viewBox="${fmt(mask.viewBox.x)} ${fmt(mask.viewBox.y)} ${fmt(mask.viewBox.w)} ${fmt(mask.viewBox.h)}" ` +
      // fill="none" is not decoration: the artwork's stroke-only paths (mouths,
      // the envelope flap, the terminal chevron) inherit it from the wrapper
      // that artInnerMarkup strips. Without it they fall back to solid black.
      `fill="none" overflow="visible">${artInnerMarkup(artSource!)}</svg>`
    : '';

  const svg =
    `<svg class="qr" viewBox="${min} ${min} ${span} ${span}" ` +
    `role="img" aria-label="${escapeAttr(title)}" ` +
    `xmlns="http://www.w3.org/2000/svg">` +
    `<rect class="qr-paper" x="${min}" y="${min}" width="${span}" height="${span}" fill="var(--qr-paper)"/>` +
    art +
    `<g class="qr-ink" fill="var(--qr-ink)">${ink.join('')}</g>` +
    (tint.length
      ? `<g class="qr-tint" fill="var(--qr-tint)">${tint.join('')}</g>`
      : '') +
    `</svg>`;

  return {
    svg,
    occlusionRatio,
    settleMs: maxRing * RING_MS + 260,
  };
}

/** Modules per side, including the quiet zone. Exported for the verifier. */
export const QR_SPAN = QR_SIZE + QR_QUIET * 2;

const fmt = (n: number) => Number(n.toFixed(3)).toString();

const escapeAttr = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
