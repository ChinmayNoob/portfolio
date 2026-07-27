import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export const isProd = import.meta.env.PROD
export const isDev = import.meta.env.DEV

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getRootCssVarPx(name: string, fallback = 0): number {
  if (typeof window === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  if (!raw) return fallback;
  const px = parseFloat(raw);
  return Number.isFinite(px) ? px : fallback;
}
