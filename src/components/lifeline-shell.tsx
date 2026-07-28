import { useEffect, useState, type MouseEvent, type ReactNode } from "react"
import { useSiteTheme } from "~/components/lifeline/use-site-theme"
import { cn } from "~/lib/utils"

/**
 * The page framing the Lifeline expects.
 *
 * The rail is not sized by CSS — on desktop it measures where to start
 * and end from the nav: `data-site-nav-logo` gives it the start (it sits
 * on the header's whole left group, so the rail lines up with the
 * leftmost chrome rather than with the wordmark alone), and the right
 * edge of `data-site-nav-inner` gives it the end. That is what keeps the
 * timeline inset from the viewport and aligned with the rest of the
 * page, and it's the span the intro animation draws across.
 *
 * Both attributes are load-bearing: drop them and `measureLayout` falls
 * back to a default inset, which reads as the timeline losing its margins.
 *
 * Change `containerClassName` on both the nav and the footer together
 * and the rail follows. Drop the nav entirely and the rail falls back
 * to filling its own container, edge to edge.
 */

const CONTAINER = "mx-auto flex w-full max-w-5xl items-center px-6"

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/projects", label: "Projects" },
  { href: "/posts", label: "Posts" },
]

export function LifelineShell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex h-dvh flex-col overflow-hidden bg-bg text-text-1 antialiased transition-colors duration-300",
        className,
      )}
    >
      {children}
    </div>
  )
}

/**
 * Returns to wherever the reader came from, falling back to home.
 *
 * Rendered as a real anchor so it works without JS, survives a
 * middle-click, and offers a sane target in the status bar. The handler
 * only takes over when there is genuinely a same-origin page behind us —
 * `history.back()` on a cold tab would leave the reader stranded.
 */
function LifelineBackLink() {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) {
      return
    }

    const referrer = document.referrer
    if (!referrer) return

    try {
      if (new URL(referrer).origin !== window.location.origin) return
    } catch {
      return
    }

    event.preventDefault()
    window.history.back()
  }

  return (
    <a
      href="/"
      onClick={onClick}
      aria-label="Go back"
      className="-ml-1 flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[13px] text-text-3 transition hover:text-text-1 active:scale-95"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M19 12H5" />
        <path d="m12 19-7-7 7-7" />
      </svg>
      <span>Back</span>
    </a>
  )
}

/**
 * A React port of `ui/theme-toggle.astro`, not a reuse of it: that
 * component binds its click handler on `DOMContentLoaded` /
 * `astro:page-load`, which races a `client:load` island's mount. Same
 * storage key, same icon, same view transition.
 */
function LifelineThemeToggle() {
  const { theme, toggleTheme } = useSiteTheme()

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex items-center rounded-md p-1 text-text-2 transition hover:bg-gray-soft hover:text-text-1 active:scale-95"
    >
      <span className="sr-only">
        {theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      </span>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          fill="currentColor"
          d="M16.286 20C19.442 20 22 17.472 22 14.353c0-2.472-1.607-4.573-3.845-5.338C17.837 6.194 15.415 4 12.476 4C9.32 4 6.762 6.528 6.762 9.647c0 .69.125 1.35.354 1.962a4.4 4.4 0 0 0-.83-.08C3.919 11.53 2 13.426 2 15.765S3.919 20 6.286 20z"
        />
      </svg>
    </button>
  )
}

export function LifelineNav({
  logo,
  logoHref = "/",
  logoLabel = "Home",
  currentPath = "/lifeline",
  showBack = true,
  showNavLinks = true,
  showThemeToggle = true,
  children,
  className,
  containerClassName,
}: {
  /** Rendered inside the marked anchor — the rail starts at its left edge. */
  logo: ReactNode
  logoHref?: string
  /** Accessible name for the logo link. */
  logoLabel?: string
  /** Drives the active-link treatment. */
  currentPath?: string
  showBack?: boolean
  showNavLinks?: boolean
  showThemeToggle?: boolean
  /** Anything extra on the right, before the theme toggle. */
  children?: ReactNode
  className?: string
  containerClassName?: string
}) {
  return (
    <nav
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b border-divider bg-bg/85 backdrop-blur-xl transition-colors duration-300",
        className,
      )}
    >
      <div
        data-site-nav-inner
        className={cn(CONTAINER, "h-16 justify-between gap-4", containerClassName)}
      >
        {/*
          `data-site-nav-logo` marks where the rail starts, so it belongs on
          the left *group*, not on the wordmark. Pinned to the wordmark, the
          back button would push the rail's left inset out by its own width
          while the right inset stayed at the container padding — the timeline
          would sit visibly off-centre.
        */}
        <div data-site-nav-logo className="flex items-center gap-3">
          {showBack && <LifelineBackLink />}

          <a
            href={logoHref}
            aria-label={logoLabel}
            className="font-editorial text-text-1 transition-[color,opacity] duration-300 hover:opacity-70"
          >
            {logo}
          </a>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {showNavLinks && (
            <div
              className="hidden items-center font-editorial text-[15px] font-semibold sm:flex"
              role="group"
              aria-label="Main navigation"
            >
              {NAV_ITEMS.map(({ href, label }) => {
                const isActive =
                  currentPath === href ||
                  (href !== "/" && currentPath.startsWith(`${href}/`))

                return (
                  <a
                    key={href}
                    href={href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-text-2 underline decoration-transparent underline-offset-[3px] transition hover:text-text-1 hover:decoration-current active:scale-95",
                      isActive && "lifeline-nav-link-active",
                    )}
                  >
                    {label}
                  </a>
                )
              })}
            </div>
          )}

          {children}

          {showThemeToggle && <LifelineThemeToggle />}
        </div>
      </div>
    </nav>
  )
}

/**
 * The stage. `pt-16` clears the fixed nav; `md:overflow-hidden` hands
 * scrolling to the horizontal scrub above the mobile breakpoint.
 */
export function LifelineStage({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <main
      className={cn(
        "flex-1 min-h-0 overflow-y-auto pt-16 md:overflow-hidden",
        className,
      )}
    >
      {children}
    </main>
  )
}

/**
 * The scrub affordance. The horizontal gesture is otherwise undiscoverable,
 * so say so once — then get out of the way the moment the reader does
 * anything at all. Listens on `window` rather than taking a prop so the
 * shell needs no wiring to the scroll hook.
 */
export function LifelineHint({ className }: { className?: string }) {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (dismissed) return

    const dismiss = () => setDismissed(true)
    const events = ["wheel", "pointerdown", "keydown", "touchstart"] as const

    events.forEach((name) =>
      window.addEventListener(name, dismiss, { passive: true, once: true }),
    )

    return () =>
      events.forEach((name) => window.removeEventListener(name, dismiss))
  }, [dismissed])

  return (
    <p
      aria-hidden="true"
      className={cn(
        "hidden items-center gap-1.5 whitespace-nowrap text-[12px] text-text-3 transition-opacity duration-500 md:flex",
        dismissed ? "opacity-0" : "opacity-100",
        className,
      )}
    >
      <span>Drag or scroll to scrub</span>
      <span className="lifeline-hint-arrow inline-block">&rarr;</span>
    </p>
  )
}

export function LifelineFooter({
  children,
  className,
  containerClassName,
}: {
  children?: ReactNode
  className?: string
  containerClassName?: string
}) {
  return (
    <footer
      className={cn(
        "shrink-0 border-t border-divider bg-bg/95 backdrop-blur-sm transition-colors duration-300",
        className,
      )}
    >
      <div
        className={cn(
          CONTAINER,
          "h-16 justify-between gap-6",
          containerClassName,
        )}
      >
        {children}
      </div>
    </footer>
  )
}
