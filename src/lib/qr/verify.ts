import jsQR from 'jsqr';
import sharp from 'sharp';
import { QR_SPAN } from './render';

/**
 * Pixels per module when the code is rasterised for verification.
 *
 * Deliberately low. Decoding a clean, axis-aligned raster is a much easier
 * problem than a phone camera at an angle under glare, and there is no way to
 * simulate the latter in a build. Verifying at a small raster is the cheapest
 * available proxy for that headroom: it makes the check strictly harder than
 * the display case, so passing here leaves real margin.
 */
const PX_PER_MODULE = 4;

/**
 * Concrete values for the tokens the shipped SVG references. The QR panel is
 * intentionally light in both themes (see `qr.css`), so there is one palette to
 * verify rather than two.
 */
const PALETTE: Record<string, string> = {
  '--qr-paper': '#faf4ed',
  '--qr-ink': '#332b21',
  '--qr-tint': '#6f6354',
  '--accent-l0': '#faf4ed',
  '--accent-l1': '#ede7df',
  '--background-l0': '#faf4ed',
  '--background-l3': '#d4cdc5',
  '--background-l6': '#aea79e',
  '--foreground-l2': '#483f35',
};

/**
 * Rasterises a rendered code and decodes it back, so a code that cannot be
 * scanned fails the build instead of shipping.
 *
 * "It looks fine" is not evidence, and the occlusion pass in `render.ts` is
 * exactly the kind of thing that degrades quietly when the artwork is later
 * adjusted.
 */
export async function assertScannable(
  svg: string,
  expected: string,
  label: string,
): Promise<void> {
  const px = QR_SPAN * PX_PER_MODULE;
  const flattened = svg.replace(
    /var\((--[a-z0-9-]+)\)/gi,
    (whole, token: string) => PALETTE[token] ?? whole,
  );

  const { data, info } = await sharp(Buffer.from(flattened))
    .resize({ width: px, height: px, fit: 'fill' })
    .flatten({ background: PALETTE['--qr-paper'] })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const decoded = jsQR(new Uint8ClampedArray(data), info.width, info.height);

  if (!decoded) {
    throw new Error(
      `QR for ${label} did not decode at ${px}x${px}px. ` +
        `The embedded artwork is destroying too much of the symbol — ` +
        `lower ART_HEIGHT or raise OCCLUDE_AT in src/lib/qr/render.ts.`,
    );
  }
  if (decoded.data !== expected) {
    throw new Error(
      `QR for ${label} decoded to the wrong payload.\n` +
        `  expected: ${expected}\n  actual:   ${decoded.data}`,
    );
  }
}
