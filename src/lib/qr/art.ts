import sharp from 'sharp';

/**
 * Resolution the artwork is rasterised at when measuring coverage. Well above
 * the module grid so each module averages many source pixels and the silhouette
 * edge comes out smooth rather than aliased.
 */
const PROBE_PX = 1024;

export type ArtMask = {
  /** Placement rect in module units, aspect-preserved. */
  rect: { x: number; y: number; w: number; h: number };
  /**
   * The artwork's tight bounding box in its own user units. Used as the
   * viewBox of the nested `<svg>` so the drawing lands exactly on `rect`
   * without any hand-computed transform.
   */
  viewBox: { x: number; y: number; w: number; h: number };
  /** Fraction of each module covered by artwork, row-major over `rect`. */
  coverage: Float32Array;
  /** Coverage at an absolute module position; 0 outside `rect`. */
  at(x: number, y: number): number;
};

/**
 * Measures how much of each module the artwork covers.
 *
 * Takes the SVG source rather than a path. Reading from disk would work in dev
 * and break in the bundled build, where `import.meta.url` points at a chunk
 * instead of the source tree — so callers hand over the text, obtained with
 * Vite's `?raw` import.
 *
 * The artwork is authored against the bento palette, so its fills are
 * `var(--*)` references that a standalone rasteriser cannot resolve. Coverage
 * only needs the alpha channel, so every token is replaced with opaque black
 * and the colour is discarded.
 */
export async function artMask(
  source: string,
  opts: { size: number; heightInModules: number },
): Promise<ArtMask> {
  const flattened = source.replace(/var\(--[a-z0-9-]+\)/gi, '#000');

  assertNoDoubleHyphenComment(source);

  const { data, info } = await sharp(Buffer.from(flattened))
    .resize({ width: PROBE_PX, height: PROBE_PX, fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width: pw, height: ph, channels } = info;
  const alphaAt = (px: number, py: number) =>
    data[(py * pw + px) * channels + (channels - 1)] / 255;

  // Tight bounding box of anything drawn, so the placement is driven by the
  // figure itself rather than by whatever padding the viewBox happens to have.
  let minX = pw;
  let minY = ph;
  let maxX = -1;
  let maxY = -1;
  for (let py = 0; py < ph; py++) {
    for (let px = 0; px < pw; px++) {
      if (alphaAt(px, py) > 0.02) {
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
      }
    }
  }
  if (maxX < 0) throw new Error('Artwork rasterised to nothing');

  const boxW = maxX - minX + 1;
  const boxH = maxY - minY + 1;

  // Placement: fit the requested height, preserve aspect, centre on the grid.
  const h = opts.heightInModules;
  const w = Math.max(1, Math.round((h * boxW) / boxH));
  const rect = {
    x: Math.round((opts.size - w) / 2),
    y: Math.round((opts.size - h) / 2),
    w,
    h,
  };

  // Average alpha per module over the bounding box.
  const coverage = new Float32Array(w * h);
  for (let my = 0; my < h; my++) {
    const y0 = minY + (my * boxH) / h;
    const y1 = minY + ((my + 1) * boxH) / h;
    for (let mx = 0; mx < w; mx++) {
      const x0 = minX + (mx * boxW) / w;
      const x1 = minX + ((mx + 1) * boxW) / w;
      let sum = 0;
      let n = 0;
      for (let py = Math.floor(y0); py < Math.ceil(y1); py++) {
        for (let px = Math.floor(x0); px < Math.ceil(x1); px++) {
          if (px < 0 || py < 0 || px >= pw || py >= ph) continue;
          sum += alphaAt(px, py);
          n++;
        }
      }
      coverage[my * w + mx] = n ? sum / n : 0;
    }
  }

  // The rasteriser fit the 1:1 artwork into PROBE_PX, so user units per pixel
  // is the source viewBox side over the rendered side.
  const userPerPx = svgUserSize(source) / Math.max(pw, ph);

  return {
    rect,
    viewBox: {
      x: minX * userPerPx,
      y: minY * userPerPx,
      w: boxW * userPerPx,
      h: boxH * userPerPx,
    },
    coverage,
    at(x, y) {
      const mx = x - rect.x;
      const my = y - rect.y;
      if (mx < 0 || my < 0 || mx >= rect.w || my >= rect.h) return 0;
      return coverage[my * rect.w + mx];
    },
  };
}

/**
 * XML forbids a double hyphen inside a comment, and the artwork is full of
 * palette token names that start with one. The rasteriser's own message for
 * this is a generic "corrupt header", which is a slow thing to diagnose twice,
 * so the specific cause is named here instead.
 */
function assertNoDoubleHyphenComment(source: string): void {
  for (const match of source.matchAll(/<!--([\s\S]*?)-->/g)) {
    if (match[1].includes('--')) {
      throw new Error(
        'Artwork has a double hyphen inside an XML comment, which makes the ' +
          'file unparseable. Describe palette tokens in prose instead of ' +
          `writing them literally. Offending comment: ${match[0].slice(0, 80)}`,
      );
    }
  }
}

/** Longest side of the source viewBox, in user units. */
function svgUserSize(source: string): number {
  const vb = source.match(
    /viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i,
  );
  if (vb) return Math.max(Number(vb[1]), Number(vb[2]));
  const w = source.match(/\bwidth\s*=\s*["']([\d.]+)/i);
  const h = source.match(/\bheight\s*=\s*["']([\d.]+)/i);
  if (w && h) return Math.max(Number(w[1]), Number(h[1]));
  throw new Error('Artwork has neither a viewBox nor width/height');
}

/** Strips the outer `<svg>` wrapper, leaving the drawable content. */
export function artInnerMarkup(source: string): string {
  const open = source.indexOf('>', source.indexOf('<svg'));
  const close = source.lastIndexOf('</svg>');
  if (open < 0 || close < 0) throw new Error('Artwork is not an SVG');
  return source.slice(open + 1, close).trim();
}
