import { artInnerMarkup, artMask } from './art';
import { QR_QUIET, QR_SIZE, toMatrix } from './matrix';

/**
 * Coverage at or above this removes the module outright, letting the artwork
 * read at full strength. Below it, but at or above {@link TINT_AT}, the module
 * stays put and is only recoloured.
 */
const OCCLUDE_AT = 0.55;

/** Coverage at or above this recolours the module. */
const TINT_AT = 0.06;

/**
 * Ceiling on removed modules, as a fraction of the symbol.
 *
 * Necessary but NOT sufficient. This counts dark modules removed; it cannot see
 * a light module that the artwork has painted dark, which is equally
 * destructive. That blind spot is why the artwork keeps large shapes light and
 * confines dark to thin linework, and why `verify.ts` exists.
 */
const MAX_OCCLUSION = 0.16;

/**
 * Default height of the artwork, in modules.
 *
 * Chosen empirically. Sweeping the set, every card decodes at 26 and every card
 * fails at 28 — a sharp error-correction cliff rather than a gradual decline.
 * 22 sits two steps back from it, which is the margin that keeps a later art
 * tweak from silently landing on the edge.
 */
const ART_HEIGHT = 22;

/** Sweep duration in ms, and the finder-pattern snap that follows it. */
const SWEEP_MS = 900;
const FINDER_MS = 340;

export type QrSvgOptions = {
  /**
   * SVG source of the artwork to embed, or null for a plain code. Source text
   * rather than a path so it survives bundling — import it with Vite's `?raw`.
   */
  art?: string | null;
  /** Accessible name for the rendered code. */
  title: string;
  /** Unique within the page: namespaces this code's gradient ids. */
  id: string;
  /** Height of the artwork in modules; defaults to {@link ART_HEIGHT}. */
  artHeight?: number;
};

export type QrSvgResult = {
  svg: string;
  /** Fraction of the symbol removed under the artwork. */
  occlusionRatio: number;
  /** Total time to fully settle, in ms. */
  settleMs: number;
};

export async function renderQrSvg(
  url: string,
  { art: artSource = null, title, id, artHeight = ART_HEIGHT }: QrSvgOptions,
): Promise<QrSvgResult> {
  const matrix = toMatrix(url);
  const { size } = matrix;

  const mask =
    artSource && artHeight > 0
      ? await artMask(artSource, { size, heightInModules: artHeight })
      : null;

  const ink: string[] = [];
  const tint: string[] = [];
  // The three finder patterns are held back and snapped in after the sweep, so
  // they read as a reader locking onto the code.
  const finders: Record<string, string[]> = { tl: [], tr: [], bl: [] };
  let occluded = 0;

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

      const rect = `<rect x="${x}" y="${y}" width="1.02" height="1.02"/>`;

      const corner = finderCorner(x, y, size);
      if (corner) {
        finders[corner].push(rect);
        continue;
      }

      // Reserved modules keep full contrast; tinting them would put the timing
      // and alignment patterns at risk for a purely cosmetic gain.
      (!reserved && cover >= TINT_AT ? tint : ink).push(rect);
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
  const beamId = `qr-beam-${id}`;

  const artMarkup = mask
    ? `<svg class="qr-art" x="${mask.rect.x}" y="${mask.rect.y}" ` +
      `width="${mask.rect.w}" height="${mask.rect.h}" ` +
      `viewBox="${fmt(mask.viewBox.x)} ${fmt(mask.viewBox.y)} ${fmt(mask.viewBox.w)} ${fmt(mask.viewBox.h)}" ` +
      // fill="none" is not decoration: the artwork's stroke-only paths (spiral
      // eyes, squiggle mouths, envelope flap) inherit it from the wrapper that
      // artInnerMarkup strips. Without it they fall back to solid black.
      `fill="none" overflow="visible">${artInnerMarkup(artSource!)}</svg>`
    : '';

  const svg =
    `<svg class="qr" viewBox="${min} ${min} ${span} ${span}" ` +
    `role="img" aria-label="${escapeAttr(title)}" ` +
    // qr.css drives the beam's travel distance off this, so the animation stays
    // correct if the pinned QR version (and therefore the module count) changes.
    `style="--qr-span:${span}" ` +
    `xmlns="http://www.w3.org/2000/svg">` +
    `<defs><linearGradient id="${beamId}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="var(--qr-beam)" stop-opacity="0"/>` +
    `<stop offset="0.75" stop-color="var(--qr-beam)" stop-opacity="0.55"/>` +
    `<stop offset="1" stop-color="var(--qr-beam)" stop-opacity="0.95"/>` +
    `</linearGradient></defs>` +
    `<rect class="qr-paper" x="${min}" y="${min}" width="${span}" height="${span}" fill="var(--qr-paper)"/>` +
    // One clip-path on this single group performs the reveal, instead of an
    // animation on every module. The old build animated ~2900 rects at once.
    `<g class="qr-sweep">` +
    artMarkup +
    `<g class="qr-ink" fill="var(--qr-ink)">${ink.join('')}</g>` +
    (tint.length
      ? `<g class="qr-tint" fill="var(--qr-tint)">${tint.join('')}</g>`
      : '') +
    `</g>` +
    `<g class="qr-finders" fill="var(--qr-ink)">` +
    Object.entries(finders)
      .map(
        ([corner, rects]) =>
          `<g class="qr-finder" data-corner="${corner}">${rects.join('')}</g>`,
      )
      .join('') +
    `</g>` +
    `<rect class="qr-beam" x="${min}" y="${min - 6}" width="${span}" height="6" fill="url(#${beamId})"/>` +
    `</svg>`;

  return {
    svg,
    occlusionRatio,
    settleMs: SWEEP_MS + FINDER_MS,
  };
}

/**
 * Which finder pattern a module belongs to, if any. Each is a 7x7 block in a
 * corner; the bottom-right corner has none, which is how a reader works out
 * the code's orientation.
 */
function finderCorner(
  x: number,
  y: number,
  size: number,
): 'tl' | 'tr' | 'bl' | null {
  const near = 7;
  if (x < near && y < near) return 'tl';
  if (x >= size - near && y < near) return 'tr';
  if (x < near && y >= size - near) return 'bl';
  return null;
}

/** Modules per side, including the quiet zone. Exported for the verifier. */
export const QR_SPAN = QR_SIZE + QR_QUIET * 2;

const fmt = (n: number) => Number(n.toFixed(3)).toString();

const escapeAttr = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
