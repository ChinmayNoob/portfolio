import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const isProd = import.meta.env.PROD;
export const isDev = import.meta.env.DEV;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getRootCssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name);
}

/**
 * Reads a length custom property as a number of pixels.
 *
 * `getRootCssVar` returns the raw string ("56px"), which `Number()` turns into
 * NaN — use this when you need the value in arithmetic. Falls back only when
 * the property is genuinely unparseable, so a legitimate `0` is preserved.
 */
export function getRootCssVarPx(name: string, fallback: number): number {
  const value = Number.parseFloat(getRootCssVar(name));
  return Number.isFinite(value) ? value : fallback;
}
