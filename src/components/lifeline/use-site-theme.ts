import { useCallback, useEffect, useState } from "react"
import { STORAGE_THEME_KEY, THEME_MAP } from "~/lib/theme"

type SiteTheme = keyof typeof THEME_MAP

const THEMES = Object.keys(THEME_MAP) as SiteTheme[]

/**
 * The site's theme, read and written the way `ui/theme-toggle.astro` does it:
 * a class on `<html>`, the same `localStorage` key, and a view transition
 * around the swap.
 *
 * This exists instead of `next-themes` because nothing in the app mounts a
 * `ThemeProvider` — `useTheme()` returned an undefined theme and a no-op
 * setter, so anything depending on it silently did nothing. And it exists
 * instead of reusing the Astro toggle because that component binds its click
 * handler on `DOMContentLoaded` / `astro:page-load`, which races a
 * `client:load` island's mount.
 */
export function useSiteTheme() {
  // `null` until mounted: the class lives on the server-rendered document, so
  // guessing here would flash the wrong icon on hydration.
  const [theme, setThemeState] = useState<SiteTheme | null>(null)

  useEffect(() => {
    const read = () => {
      const root = document.documentElement
      const current = THEMES.find((name) => root.classList.contains(name))
      setThemeState(current ?? "light")
    }

    read()

    // The toggle may live elsewhere on the page (or in another island), so
    // follow the class rather than owning it.
    const observer = new MutationObserver(read)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })

    return () => observer.disconnect()
  }, [])

  const setTheme = useCallback((next: SiteTheme) => {
    const apply = () => {
      const root = document.documentElement
      THEMES.forEach((name) => root.classList.remove(name))
      root.classList.add(next)
      localStorage.setItem(STORAGE_THEME_KEY, next)
    }

    // The transition is the site's own crossfade. Without it the theme snaps,
    // which is jarring next to every other page.
    if (document.startViewTransition) {
      document.startViewTransition(apply)
      return
    }

    apply()
  }, [])

  const toggleTheme = useCallback(() => {
    const root = document.documentElement
    const index = THEMES.findIndex((name) => root.classList.contains(name))
    setTheme(THEMES[(index + 1) % THEMES.length])
  }, [setTheme])

  return { theme, setTheme, toggleTheme }
}
