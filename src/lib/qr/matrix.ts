import QRCode from 'qrcode';

/**
 * Every card is encoded at the same version so the four codes render an
 * identical grid. Left to itself the encoder picks the smallest version that
 * fits each payload, which would give the short `mailto:` a visibly coarser
 * grid than the long LinkedIn URL and make the row look accidental.
 *
 * v6 is the smallest version that fits all four payloads at ECC level H
 * (the LinkedIn URL, at 47 characters, is what sets the floor).
 */
export const QR_VERSION = 6;

/**
 * Level H recovers 30% of codewords. This is not a style choice: it is what
 * funds the occlusion budget in `render.ts`, where modules under the artwork
 * are removed outright.
 */
export const QR_ECC = 'H' as const;

/** Modules per side for {@link QR_VERSION}. */
export const QR_SIZE = 17 + QR_VERSION * 4;

/** Quiet zone, in modules, on each side. The spec's minimum is 4; 3 reads
 * tighter and still scans, which the build-time check in `verify.ts` proves. */
export const QR_QUIET = 3;

export type QrMatrix = {
  /** Modules per side, excluding the quiet zone. */
  readonly size: number;
  /** True when the module is dark. */
  isDark(x: number, y: number): boolean;
  /**
   * True for structural modules: the three finder patterns and their
   * separators, both timing patterns, the alignment pattern, and the format
   * information areas. These are never removed and never recoloured in a way
   * that lowers contrast.
   */
  isReserved(x: number, y: number): boolean;
};

export type MatrixOptions = {
  /**
   * Pinned version, or null to let the encoder pick the smallest that fits.
   *
   * Pinning matters when several codes sit side by side and must share a grid.
   * A lone code — the printable card, say — has nothing to match, so auto is
   * right there: it keeps the grid as coarse as the payload allows.
   */
  version?: number | null;
};

export function toMatrix(
  url: string,
  { version = QR_VERSION }: MatrixOptions = {},
): QrMatrix {
  let qr: ReturnType<typeof QRCode.create>;
  try {
    qr = QRCode.create(url, {
      errorCorrectionLevel: QR_ECC,
      ...(version === null ? {} : { version }),
    });
  } catch (cause) {
    // Bumping the version silently would break the visual consistency the
    // pin exists to guarantee, so fail loudly instead.
    const needed = QRCode.create(url, { errorCorrectionLevel: QR_ECC }).version;
    throw new Error(
      `QR payload does not fit version v${version} at ECC ${QR_ECC}: ` +
        `${url.length} chars needs v${needed}. Either shorten the payload or ` +
        `raise the pinned version (which changes the grid of every code ` +
        `sharing that pin).`,
      { cause },
    );
  }

  const { size, data, reservedBit } = qr.modules;
  const inBounds = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < size && y < size;

  return {
    size,
    isDark: (x, y) => inBounds(x, y) && Boolean(data[y * size + x]),
    isReserved: (x, y) => inBounds(x, y) && Boolean(reservedBit[y * size + x]),
  };
}
