import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import {
  LIFELINE_STICKY_LEFT,
  LIFELINE_STICKY_SHIELD_WIDTH,
} from "./lifeline-labels"
import { clamp } from "./lifeline-utils"
import type { LifelineMode } from "./types"

const FADE_ZONE = 200
const FADE_ZONE_COARSE = 72
const LEFT_EXIT_FADE_ZONE = 400
const LEFT_EXIT_FADE_ZONE_COARSE = 160
const WHEEL_SPEED = 1.4
const WHEEL_VELOCITY_FRAME_MS = 16.67
const DRAG_SPEED = 1
const TOUCH_DRAG_SPEED = 1.15
const TOUCH_GESTURE_LOCK_PX = 8
const NAV_HORIZONTAL_PADDING = 24
const MOMENTUM_FRICTION = 0.94
const MOMENTUM_MIN_VELOCITY = 0.025
const MOMENTUM_MIN_START = 0.08

/**
 * How hard the rail chases the wheel's target, per 60Hz frame. The wheel used
 * to be applied to the transform 1:1, which makes a trackpad's discrete deltas
 * read as steps; easing toward a target turns the same stream into a glide.
 * Normalized by frame time below so a 120Hz display travels the same distance
 * in the same wall-clock time.
 *
 * A pointer drag deliberately does NOT go through this — direct manipulation
 * must not lag the finger.
 */
const GLIDE_DAMPING = 0.18
/** Close enough to the target to stop easing and snap. */
const GLIDE_EPSILON = 0.1

/** Where the track starts when there is no host nav to align with. */
const LIFELINE_DEFAULT_START_INSET = 24

/** Page mode needs the stage to cover at least this much of the viewport. */
const PAGE_MODE_VIEWPORT_COVERAGE = 0.5
/** Scroll heights within this many px of the client height aren't scrollable. */
const PAGE_MODE_SCROLL_SLOP = 4
/** How long a resolved mode is trusted before it is measured again. */
const MODE_RESOLVE_STALE_MS = 250

/** A gap this long in the wheel stream ends one gesture and starts the next. */
const WHEEL_GESTURE_QUIET_MS = 120
/**
 * Embedded: once the rail bottoms out, the wheel keeps being swallowed
 * until the stream has been quiet this long. Trackpad inertia arrives as
 * one unbroken stream, so a fast flick that eats the last of the rail
 * dies here instead of spilling into the page behind it.
 */
const EMBED_BOUNDARY_QUIET_MS = 260
/**
 * …but never hold longer than this. Inertia decays; a finger or a wheel
 * that is still going does not, so a sustained scroll gets through.
 */
const EMBED_BOUNDARY_MAX_HOLD_MS = 900

/**
 * How early the sweep is armed, relative to the module entering view. A
 * couple of hundred pixels means it is already moving by the time it is
 * properly on screen, rather than starting cold under the reader's eyes.
 */
const EMBED_INTRO_ARM_MARGIN = "0px 0px 200px 0px"

function normalizeWheelDelta(event: WheelEvent) {
  let delta = Math.abs(event.deltaX) > Math.abs(event.deltaY)
    ? event.deltaX
    : event.deltaY

  if (event.deltaMode === 1) delta *= 16
  if (event.deltaMode === 2) delta *= window.innerHeight

  return delta
}

function isInteractiveTarget(target: EventTarget | null) {
  // Pointer capture during drag retargets clicks to the section, so
  // anything clickable must opt out of drag-start here.
  return (
    target instanceof Element &&
    Boolean(target.closest("a, button, [data-lifeline-interactive]"))
  )
}

function isEditableTarget(target: EventTarget | null) {
  return (
    target instanceof Element &&
    Boolean(target.closest("input, textarea, select, [contenteditable]"))
  )
}

/** How much of the viewport this element currently covers, 0..1. */
function getViewportCoverage(element: HTMLElement) {
  const rect = element.getBoundingClientRect()
  const visibleX =
    Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0)
  const visibleY =
    Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0)
  if (visibleX <= 0 || visibleY <= 0) return 0

  return (visibleX * visibleY) / (window.innerWidth * window.innerHeight)
}

/**
 * Is there a vertical scroll behind this element for a released wheel to
 * drive? Walks out to the document, stopping at the first ancestor that
 * clips — a `LifelineShell` is `overflow-hidden`, so nothing escapes it.
 */
function hasReleasableScroll(section: HTMLElement) {
  let node = section.parentElement

  while (node) {
    const { overflowY } = window.getComputedStyle(node)

    if (overflowY === "hidden" || overflowY === "clip") return false

    if (
      (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") &&
      node.scrollHeight > node.clientHeight + PAGE_MODE_SCROLL_SLOP
    ) {
      return true
    }

    node = node.parentElement
  }

  const doc = document.scrollingElement
  return Boolean(doc && doc.scrollHeight > doc.clientHeight + PAGE_MODE_SCROLL_SLOP)
}

interface LifelineScrollOptions {
  mode?: LifelineMode
  isCoarsePointer?: boolean
  introLocked?: boolean
  introAnimating?: boolean
  introSkipped?: boolean
  introRailMs?: number
  introGetTrackProgress?: (elapsedMs: number) => number
  onIntroSettleComplete?: () => void
  onIntroScrollStart?: () => void
}

export function useLifelineScroll(
  markerCount: number,
  options: LifelineScrollOptions = {},
) {
  const sectionRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const labelsRef = useRef<HTMLDivElement>(null)
  const markerRefs = useRef<(HTMLDivElement | null)[]>([])
  /**
   * Each marker's position within the track, and the stage's width, as of the
   * last measure. Static between measures — which is what makes the per-frame
   * `getBoundingClientRect()` calls this replaces avoidable. Reading layout
   * inside a wheel handler that also writes transforms is read-after-write
   * thrash, and trackpads fire faster than one event per frame.
   */
  const markerGeom = useRef<{ left: number; width: number }[]>([])
  const stageWidth = useRef(0)
  const maxTranslate = useRef(0)
  const startInset = useRef(LIFELINE_DEFAULT_START_INSET)
  const endInset = useRef(0)
  const translatePx = useRef(0)
  const initialized = useRef(false)
  const dragging = useRef(false)
  const gestureAxis = useRef<"x" | "y" | null>(null)
  const gestureStart = useRef({ x: 0, y: 0 })
  const dragOrigin = useRef({ x: 0, translate: 0 })
  const dragVelocity = useRef(0)
  const lastPointerSample = useRef({ x: 0, t: 0 })
  const activePointerId = useRef<number | null>(null)
  const isCoarsePointerRef = useRef(options.isCoarsePointer ?? false)
  const momentumId = useRef(0)
  const settleId = useRef(0)
  /** Where the wheel wants the rail; the glide loop closes the gap. */
  const targetTranslate = useRef(0)
  const glideId = useRef(0)
  const commitId = useRef(0)
  /** The translate the DOM currently reflects; `NaN` until the first commit. */
  const committedPx = useRef(Number.NaN)
  const introLockedRef = useRef(options.introLocked ?? false)
  const introAnimatingRef = useRef(options.introAnimating ?? false)
  const introSkippedRef = useRef(options.introSkipped ?? false)
  const onIntroSettleCompleteRef = useRef(options.onIntroSettleComplete)
  const onIntroScrollStartRef = useRef(options.onIntroScrollStart)
  const settlingRef = useRef(false)
  const introWasAnimatingRef = useRef(false)
  const introScrollId = useRef(0)
  const introScrollStart = useRef(0)
  const introStartedRef = useRef(false)
  const introGetTrackProgressRef = useRef(options.introGetTrackProgress)
  const applyTranslateRef = useRef<(value: number) => void>(() => {})
  const scheduleMeasureRef = useRef<() => void>(() => {})
  const modeRef = useRef<LifelineMode>(options.mode ?? "auto")
  const isEmbedRef = useRef(false)
  const modeResolvedAt = useRef(0)
  const prefersReducedMotionRef = useRef(false)
  const wheelStreamAt = useRef(0)
  const wheelGapMs = useRef(Number.POSITIVE_INFINITY)
  const gestureStartedHere = useRef(false)
  const gestureReleased = useRef(false)
  const boundaryHitAt = useRef(0)
  const [isLayoutReady, setIsLayoutReady] = useState(false)
  const [isEmbed, setIsEmbed] = useState(false)
  const [introArmed, setIntroArmed] = useState(false)

  modeRef.current = options.mode ?? "auto"
  isCoarsePointerRef.current = options.isCoarsePointer ?? false
  introLockedRef.current = options.introLocked ?? false
  introAnimatingRef.current = options.introAnimating ?? false
  introSkippedRef.current = options.introSkipped ?? false
  onIntroSettleCompleteRef.current = options.onIntroSettleComplete
  onIntroScrollStartRef.current = options.onIntroScrollStart
  introGetTrackProgressRef.current = options.introGetTrackProgress

  const setMarkerRef = useCallback(
    (index: number, node: HTMLDivElement | null) => {
      markerRefs.current[index] = node

      if (index === markerCount - 1 && node) {
        scheduleMeasureRef.current()
      }
    },
    [markerCount],
  )

  const getLabelStageLeft = useCallback((translate: number) => {
    const section = sectionRef.current
    if (!section) return { isSticky: false, labelLeft: 0 }

    // Stage-relative: labels pin LIFELINE_STICKY_LEFT px inside the
    // section's own left edge, wherever the section sits on the page.
    const naturalLeft = startInset.current - translate
    const isSticky = naturalLeft <= LIFELINE_STICKY_LEFT

    return {
      isSticky,
      labelLeft: isSticky ? LIFELINE_STICKY_LEFT : naturalLeft,
    }
  }, [])

  const applyLabelSticky = useCallback(
    (translate: number) => {
      const labels = labelsRef.current
      const { isSticky, labelLeft } = getLabelStageLeft(translate)

      if (!labels) return { isSticky, labelLeft }

      if (isSticky) {
        const labelExtra =
          LIFELINE_STICKY_LEFT - startInset.current + translate
        labels.style.transform = `translate3d(${labelExtra}px, 0, 0)`
        labels.classList.add("is-pinned")
      } else {
        labels.style.transform = ""
        labels.classList.remove("is-pinned")
      }

      return { isSticky, labelLeft }
    },
    [getLabelStageLeft],
  )

  const isScrollLocked = useCallback(() => {
    return (
      (introLockedRef.current && introStartedRef.current) ||
      settlingRef.current
    )
  }, [])

  /**
   * Pure arithmetic over the cached geometry — no layout reads. A marker's
   * stage-relative left is its position in the track plus the track's own
   * offset, and the track's offset is exactly `startInset - translate`, which
   * is what we just wrote.
   */
  const updateFades = useCallback(() => {
    if (settlingRef.current) return

    const geom = markerGeom.current
    if (geom.length === 0) return

    const width = stageWidth.current
    const translate = translatePx.current
    const trackOffset = startInset.current - translate
    const isCoarse = isCoarsePointerRef.current
    const fadeZone = isCoarse ? FADE_ZONE_COARSE : FADE_ZONE
    const leftFadeZone = isCoarse
      ? LEFT_EXIT_FADE_ZONE_COARSE
      : LEFT_EXIT_FADE_ZONE
    const readableRight = width - 12

    for (let index = 0; index < markerRefs.current.length; index += 1) {
      const marker = markerRefs.current[index]
      const box = geom[index]
      if (!marker || !box) continue

      const markerLeft = box.left + trackOffset
      const center = markerLeft + box.width / 2

      let opacity = 1

      // Fade a marker out only as scrubbing carries it left of where
      // it rests at translate 0 — the first markers naturally live
      // inside the fade zone and must not open dimmed.
      const naturalLeft = markerLeft + translate
      const restLeft = Math.min(naturalLeft, leftFadeZone)
      if (markerLeft < restLeft) {
        opacity = markerLeft <= 0 ? 0 : markerLeft / restLeft
      }

      if (center > width - fadeZone) {
        opacity = Math.min(opacity, (width - center) / fadeZone)
      }

      if (isCoarse) {
        const markerRight = markerLeft + box.width
        const visibleWidth =
          Math.min(markerRight, readableRight) -
          Math.max(markerLeft, LIFELINE_STICKY_SHIELD_WIDTH)
        const visibility = box.width > 0 ? visibleWidth / box.width : 0

        if (visibility >= 0.5) {
          opacity = 1
        }
      }

      marker.style.opacity = String(clamp(opacity, 0, 1))
    }
  }, [])

  /**
   * Every DOM write for a given translate, in one place. Called at most once
   * per frame by `applyTranslate`; called directly by the intro and measure
   * paths, which already run inside a frame.
   */
  const commitTranslate = useCallback(() => {
    const next = translatePx.current
    committedPx.current = next

    if (trackRef.current) {
      trackRef.current.style.transform = `translate3d(${startInset.current - next}px, 0, 0)`
    }

    applyLabelSticky(next)
    updateFades()
  }, [applyLabelSticky, updateFades])

  /**
   * Records the new translate and coalesces the write into the next frame.
   * Several wheel events inside one frame therefore cost one write instead of
   * one write each — and, with the geometry cached, none of them read layout.
   */
  const applyTranslate = useCallback(
    (value: number) => {
      const next = clamp(value, 0, maxTranslate.current)
      translatePx.current = next

      // Already pending: that commit will pick up the value just written.
      if (commitId.current !== 0) return
      // Already on screen: nothing to write. Checked against what was last
      // committed rather than against the incoming value, because a caller
      // that re-sends the current position still needs a commit if the last
      // one was pre-empted.
      if (next === committedPx.current) return

      commitId.current = requestAnimationFrame(() => {
        commitId.current = 0
        commitTranslate()
      })
    },
    [commitTranslate],
  )

  /** Bypasses the frame batch — for callers already inside one. */
  const applyTranslateNow = useCallback(
    (value: number) => {
      translatePx.current = clamp(value, 0, maxTranslate.current)
      commitTranslate()
    },
    [commitTranslate],
  )

  applyTranslateRef.current = applyTranslateNow

  /**
   * Page mode or embedded? An explicit `mode` decides it outright.
   * `"auto"` measures: the timeline is the page only when it covers most
   * of the viewport *and* there is nothing behind it left to scroll.
   * Both halves matter — a full-bleed hero section on a long landing page
   * covers the viewport but must still hand the wheel back at the ends.
   *
   * Cached for MODE_RESOLVE_STALE_MS because this reads layout and the
   * wheel path calls it. `force` is for measure passes, which are already
   * doing layout work.
   */
  const resolveMode = useCallback((force = false) => {
    const section = sectionRef.current
    if (!section) return isEmbedRef.current

    const mode = modeRef.current

    if (mode !== "auto") {
      const embed = mode === "embed"
      if (embed !== isEmbedRef.current) {
        isEmbedRef.current = embed
        setIsEmbed(embed)
      }
      return embed
    }

    const now = performance.now()
    if (!force && now - modeResolvedAt.current < MODE_RESOLVE_STALE_MS) {
      return isEmbedRef.current
    }
    modeResolvedAt.current = now

    const isPage =
      getViewportCoverage(section) >= PAGE_MODE_VIEWPORT_COVERAGE &&
      !hasReleasableScroll(section)

    if (isPage === !isEmbedRef.current) return isEmbedRef.current

    isEmbedRef.current = !isPage
    setIsEmbed(!isPage)
    return isEmbedRef.current
  }, [])

  const measureLayout = useCallback(() => {
    const track = trackRef.current
    const section = sectionRef.current
    if (!track || !section) return 0

    const embed = resolveMode(true)
    const stageRect = section.getBoundingClientRect()

    const navLogo = document.querySelector("[data-site-nav-logo]")
    const navInner = document.querySelector("[data-site-nav-inner]")

    const logoLeft = navLogo
      ? navLogo.getBoundingClientRect().left - stageRect.left
      : null
    const navRight = navInner
      ? navInner.getBoundingClientRect().right -
        stageRect.left -
        NAV_HORIZONTAL_PADDING
      : null

    /**
     * A full-page lifeline always follows the host chrome. An embedded one
     * follows it only when the module actually spans it — a full-bleed
     * module lines its rail up with the logo and the container's right edge,
     * exactly as the full-page version does, while a timeline in a narrow
     * card has nothing to align to a nav sitting outside its own box and
     * measures itself instead.
     */
    const followChrome =
      !embed ||
      (logoLeft !== null &&
        navRight !== null &&
        logoLeft >= 0 &&
        navRight <= stageRect.width &&
        navRight > logoLeft)

    if (followChrome && logoLeft !== null) {
      startInset.current = logoLeft
    } else {
      startInset.current = LIFELINE_DEFAULT_START_INSET
    }

    if (followChrome && navRight !== null) {
      endInset.current = navRight
    } else {
      // No chrome to align with, or none this module spans — end the track
      // at the stage's own right edge instead.
      endInset.current = stageRect.width - NAV_HORIZONTAL_PADDING
    }

    stageWidth.current = stageRect.width

    /*
     * Cache every marker's slot in the track while we are already doing layout
     * work. `offsetLeft` is relative to the positioned ancestor inside the
     * track, so it needs the same shield offset the max-translate math uses
     * below — the two must agree or the fades drift from the transform.
     */
    const geom: { left: number; width: number }[] = []
    for (let index = 0; index < markerCount; index += 1) {
      const marker = markerRefs.current[index]
      if (!marker) continue

      geom[index] = {
        left: LIFELINE_STICKY_SHIELD_WIDTH + marker.offsetLeft,
        width: marker.offsetWidth,
      }
    }
    markerGeom.current = geom

    const lastMarker = markerRefs.current[markerCount - 1]
    const lastMarkerRight = lastMarker
      ? LIFELINE_STICKY_SHIELD_WIDTH +
        lastMarker.offsetLeft +
        lastMarker.offsetWidth
      : track.scrollWidth

    const max = Math.max(
      0,
      startInset.current + lastMarkerRight - endInset.current,
    )
    maxTranslate.current = max
    targetTranslate.current = clamp(targetTranslate.current, 0, max)

    return max
  }, [markerCount, resolveMode])

  useLayoutEffect(() => {
    markerRefs.current.length = markerCount
  }, [markerCount])

  useLayoutEffect(() => {
    // A timeline short enough to fit its stage measures max = 0. It still has
    // to be shown — gating readiness on a scrollable track left any small
    // timeline permanently `invisible`.
    const max = measureLayout()

    if (!initialized.current) {
      // A skipped intro parks the rail where the intro would have settled
      // it — its end, the present. Embedded is no different: it is the same
      // intro and the same resting place.
      translatePx.current = introSkippedRef.current ? max : 0
      initialized.current = true
    }

    // Unbatched: this runs before first paint, so the rail must already be
    // where it belongs rather than waiting a frame to get there.
    applyTranslateNow(translatePx.current)
    targetTranslate.current = translatePx.current
    setIsLayoutReady(true)
    // Sync initial position once before first paint; resize uses measure().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * A full-page lifeline opens as the page opens, so its intro needs no
   * cue. An embedded one can be anywhere, including far below the fold —
   * playing there would spend the sweep on nobody. So it waits until the
   * module is about to come into view.
   */
  useEffect(() => {
    if (!isEmbed) return

    const section = sectionRef.current
    if (!section || introArmed) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        setIntroArmed(true)
        observer.disconnect()
      },
      { rootMargin: EMBED_INTRO_ARM_MARGIN },
    )

    observer.observe(section)
    return () => observer.disconnect()
  }, [isEmbed, introArmed])

  useEffect(() => {
    if (!isLayoutReady) return
    // Embedded, hold the sweep until the module is in view. `isLayoutReady`
    // and `isEmbed` are set in the same commit, so by the time this runs for
    // real the mode is already known and an embedded instance cannot slip
    // through and start early.
    if (isEmbed && !introArmed) return
    if (options.introSkipped || !options.introAnimating) {
      cancelAnimationFrame(introScrollId.current)
      introScrollId.current = 0
      introStartedRef.current = false
      return
    }

    introWasAnimatingRef.current = true
    const railMs = options.introRailMs ?? 3200

    const step = (now: number) => {
      const max = maxTranslate.current

      if (max <= 0) {
        // Nothing to travel: a timeline that fits its stage has no rail to
        // sweep. Waiting for one spun this loop forever and left the intro
        // lock on, so run the intro out where it already is — the markers
        // and labels still get their fade, there is just no journey.
        if (!introStartedRef.current) {
          introStartedRef.current = true
          introScrollStart.current = now
          onIntroScrollStartRef.current?.()
        }
        sectionRef.current?.style.setProperty("--lifeline-intro-progress", "1")
        introScrollId.current = 0
        return
      }

      if (!introStartedRef.current) {
        introStartedRef.current = true
        introScrollStart.current = now
        onIntroScrollStartRef.current?.()
        sectionRef.current?.style.setProperty("--lifeline-intro-progress", "0")
        applyTranslateRef.current(0)
        targetTranslate.current = 0
      }

      const elapsed = now - introScrollStart.current
      const progress = introGetTrackProgressRef.current
        ? clamp(introGetTrackProgressRef.current(elapsed), 0, 1)
        : clamp(elapsed / railMs, 0, 1)

      sectionRef.current?.style.setProperty(
        "--lifeline-intro-progress",
        String(progress),
      )
      applyTranslateRef.current(progress * max)
      // The sweep owns the position outright, so the glide target has to
      // follow it. Leave it at 0 and the first wheel after the intro would
      // ease all the way back to the start instead of nudging from the
      // present.
      targetTranslate.current = translatePx.current

      if (progress < 1) {
        introScrollId.current = requestAnimationFrame(step)
        return
      }

      sectionRef.current?.style.setProperty("--lifeline-intro-progress", "1")
      applyTranslateRef.current(max)
      targetTranslate.current = translatePx.current
      introScrollId.current = 0
    }

    introScrollId.current = requestAnimationFrame(step)

    return () => {
      cancelAnimationFrame(introScrollId.current)
      introScrollId.current = 0
      introStartedRef.current = false
    }
  }, [
    introArmed,
    isEmbed,
    isLayoutReady,
    options.introAnimating,
    options.introRailMs,
    options.introSkipped,
  ])

  useEffect(() => {
    if (options.introSkipped) return

    if (options.introAnimating) return

    if (!introWasAnimatingRef.current) return
    introWasAnimatingRef.current = false

    sectionRef.current?.style.removeProperty("--lifeline-intro-progress")
    markerRefs.current.forEach((marker) => {
      if (marker) marker.style.opacity = ""
    })
    updateFades()
    onIntroSettleCompleteRef.current?.()
  }, [
    options.introAnimating,
    options.introSkipped,
    updateFades,
  ])

  useEffect(() => {
    return () => {
      initialized.current = false
      // A remount paints a fresh track, so nothing is committed to it yet.
      committedPx.current = Number.NaN
    }
  }, [])

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    let frameId = 0
    let resizeObserver: ResizeObserver | null = null

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const onMotionChange = () => {
      prefersReducedMotionRef.current = motionQuery.matches
    }
    prefersReducedMotionRef.current = motionQuery.matches
    motionQuery.addEventListener("change", onMotionChange)

    const stopMomentum = () => {
      cancelAnimationFrame(momentumId.current)
      momentumId.current = 0
    }

    const stopGlide = () => {
      cancelAnimationFrame(glideId.current)
      glideId.current = 0
    }

    /** Keeps the glide target pinned to a directly-manipulated position. */
    const syncTarget = () => {
      targetTranslate.current = translatePx.current
    }

    /**
     * Closes the gap between where the rail is and where the wheel asked it to
     * be, easing rather than jumping. Damping is normalized to a 60Hz frame so
     * the travel takes the same wall-clock time on a 120Hz display.
     *
     * Only the wheel and the keyboard drive this. A pointer drag sets position
     * directly and a released drag throws via `startMomentum` — running either
     * through here would put lag between the finger and the rail.
     */
    const startGlide = () => {
      if (glideId.current !== 0) return

      let lastFrameTime = performance.now()

      const step = (now: number) => {
        const dt = Math.min(now - lastFrameTime, 32)
        lastFrameTime = now

        const target = clamp(targetTranslate.current, 0, maxTranslate.current)
        targetTranslate.current = target
        const current = translatePx.current
        const gap = target - current

        if (Math.abs(gap) <= GLIDE_EPSILON) {
          glideId.current = 0
          if (current !== target) applyTranslateNow(target)
          return
        }

        // 1 - (1 - k)^(dt/frame): the same easing whatever the frame rate.
        const factor = 1 - Math.pow(1 - GLIDE_DAMPING, dt / WHEEL_VELOCITY_FRAME_MS)
        applyTranslateNow(current + gap * factor)

        // Easing into an end counts as reaching it, so an embedded rail starts
        // its release hold from the moment of contact.
        if (
          isEmbedRef.current &&
          boundaryHitAt.current === 0 &&
          (target <= 0 || target >= maxTranslate.current) &&
          Math.abs(target - translatePx.current) <= GLIDE_EPSILON
        ) {
          boundaryHitAt.current = performance.now()
        }

        glideId.current = requestAnimationFrame(step)
      }

      glideId.current = requestAnimationFrame(step)
    }

    const startMomentum = () => {
      if (Math.abs(dragVelocity.current) < MOMENTUM_MIN_START) return

      stopMomentum()
      let lastFrameTime = performance.now()

      const step = (now: number) => {
        const dt = Math.min(now - lastFrameTime, 32)
        lastFrameTime = now

        const velocity = dragVelocity.current
        if (Math.abs(velocity) < MOMENTUM_MIN_VELOCITY) {
          dragVelocity.current = 0
          momentumId.current = 0
          return
        }

        const max = maxTranslate.current
        const next = clamp(translatePx.current + velocity * dt, 0, max)

        if (next !== translatePx.current) {
          applyTranslateNow(next)
          syncTarget()
        }

        if (next <= 0 || next >= max) {
          // Coasting into an end counts as hitting it, so the next wheel
          // event starts its hold from the moment of contact rather than
          // restarting the clock.
          if (isEmbedRef.current && boundaryHitAt.current === 0) {
            boundaryHitAt.current = performance.now()
          }
          dragVelocity.current = 0
          momentumId.current = 0
          return
        }

        dragVelocity.current =
          velocity * Math.pow(MOMENTUM_FRICTION, dt / 16.67)
        momentumId.current = requestAnimationFrame(step)
      }

      momentumId.current = requestAnimationFrame(step)
    }

    const measure = () => {
      // max === 0 is a legitimate measurement — a timeline that fits — so it
      // must not skip the ready flag either.
      const max = measureLayout()

      translatePx.current = clamp(translatePx.current, 0, max)

      // During intro scroll, the rAF loop owns translate — only refresh bounds.
      if (!(introAnimatingRef.current && introStartedRef.current)) {
        applyTranslateNow(translatePx.current)
        // A resize that shortens the rail must not leave the glide chasing a
        // target past the new end.
        if (glideId.current === 0) syncTarget()
      }

      setIsLayoutReady(true)
    }

    const scheduleMeasure = () => {
      cancelAnimationFrame(frameId)
      frameId = requestAnimationFrame(measure)
    }

    scheduleMeasureRef.current = scheduleMeasure

    scheduleMeasure()
    frameId = requestAnimationFrame(() => {
      measure()
      requestAnimationFrame(measure)
    })

    resizeObserver = new ResizeObserver(scheduleMeasure)
    if (trackRef.current) resizeObserver.observe(trackRef.current)

    window.addEventListener("resize", scheduleMeasure)

    /**
     * The wheel moves the *target*; the glide loop moves the rail. A trackpad
     * emits several deltas per frame, and applying each to the transform
     * directly is what made the scrub read as steps.
     *
     * The wheel does not feed `startMomentum` any more: a wheel stream already
     * carries the OS's own inertia, so layering a second coast on top of the
     * glide meant two easing systems fighting over the same value. Momentum is
     * now purely what a released finger throws.
     */
    const scrub = (target: number) => {
      stopMomentum()
      dragVelocity.current = 0
      targetTranslate.current = clamp(target, 0, maxTranslate.current)

      // Reduced motion asks for no inertia, and the glide is inertia: land on
      // the target this frame instead of easing toward it.
      if (prefersReducedMotionRef.current) {
        stopGlide()
        applyTranslate(targetTranslate.current)
        return
      }

      startGlide()
    }

    const release = () => {
      gestureReleased.current = true
      stopMomentum()
      dragVelocity.current = 0
    }

    /**
     * Segments the wheel stream into gestures, before the section's own
     * handler sees the event — a capture listener on the window runs ahead
     * of the target. The section alone cannot tell a gesture that started
     * on it from a page-scroll gesture that merely arrived on it, because
     * it only sees events once it is under the pointer.
     */
    const onWheelStream = (event: WheelEvent) => {
      const now = performance.now()
      wheelGapMs.current = now - wheelStreamAt.current
      wheelStreamAt.current = now

      if (wheelGapMs.current <= WHEEL_GESTURE_QUIET_MS) return

      gestureStartedHere.current =
        event.target instanceof Node && section.contains(event.target)
      gestureReleased.current = false
      boundaryHitAt.current = 0
    }

    const onWheel = (event: WheelEvent) => {
      if (isScrollLocked()) return

      if (maxTranslate.current <= 0) {
        scheduleMeasure()
        return
      }

      // A sideways swipe is never a request to scroll the page, so it
      // scrubs at the rail ends too and never releases.
      const horizontalIntent = Math.abs(event.deltaX) > Math.abs(event.deltaY)

      const delta = normalizeWheelDelta(event)
      /**
       * The two axes are not the same gesture and do not share a sign.
       *
       * Vertical is page scrolling: the intro leaves the rail at the
       * present, and scrolling down walks back through it — the same in both
       * modes. Embedding changes where the wheel *goes* at the ends of the
       * rail, not which way the rail travels.
       *
       * Horizontal is a drag by another name, so it has to match the pointer
       * drag below: the rail follows the fingers. Swiping left (deltaX > 0)
       * carries the timeline left, into the future, exactly as grabbing it
       * and pulling left does.
       */
      const movement = (horizontalIntent ? delta : -delta) * WHEEL_SPEED

      if (!resolveMode()) {
        // Page mode: the lifeline is the page and every wheel is ours.
        event.preventDefault()
        // Accumulate onto the target, not the current position — otherwise
        // each event in a stream discards the travel the glide has not
        // performed yet, and a fast flick loses most of its distance.
        scrub(targetTranslate.current + movement)
        return
      }

      if (!horizontalIntent) {
        // A gesture already in flight when it reached us belongs to the
        // page: the flick carries past, and the next scroll scrubs.
        if (!gestureStartedHere.current) return
        if (gestureReleased.current) return
      }

      const target = clamp(
        targetTranslate.current + movement,
        0,
        maxTranslate.current,
      )

      // Compared against the target, not the live position: mid-glide the rail
      // is still short of an end it has already been asked to reach, and
      // comparing positions would read that as "still travelling" and keep
      // swallowing the wheel.
      if (target === targetTranslate.current && !horizontalIntent) {
        // At an end of the rail, still being pushed further out. Hold the
        // wheel until the stream goes quiet, then hand it to the page.
        const now = performance.now()
        if (boundaryHitAt.current === 0) boundaryHitAt.current = now

        if (
          wheelGapMs.current < EMBED_BOUNDARY_QUIET_MS &&
          now - boundaryHitAt.current < EMBED_BOUNDARY_MAX_HOLD_MS
        ) {
          event.preventDefault()
          stopMomentum()
          dragVelocity.current = 0
          return
        }

        release()
        return
      }

      // Moving again — a reversal re-arms the hold at the other end.
      boundaryHitAt.current = 0
      event.preventDefault()
      scrub(target)
    }

    // The rail moves by transform; any native scroll on the section is the
    // browser chasing a focused link deep in the track, and would leave the
    // transform and the layout disagreeing about where the rail is.
    const onSectionScroll = () => {
      if (section.scrollLeft !== 0) section.scrollLeft = 0
      if (section.scrollTop !== 0) section.scrollTop = 0
    }

    const beginDrag = (event: PointerEvent) => {
      stopMomentum()
      // A finger on the rail takes it over outright — no easing between the
      // two, or the grab starts by fighting a glide already in flight.
      stopGlide()
      syncTarget()
      dragVelocity.current = 0
      dragging.current = true
      activePointerId.current = event.pointerId
      dragOrigin.current = { x: event.clientX, translate: translatePx.current }
      lastPointerSample.current = {
        x: event.clientX,
        t: performance.now(),
      }

      if (section.setPointerCapture) {
        section.setPointerCapture(event.pointerId)
      }

      section.style.cursor = "grabbing"
      section.style.touchAction = "none"
    }

    const onPointerDown = (event: PointerEvent) => {
      if (isScrollLocked()) return
      if (isInteractiveTarget(event.target)) return
      if (maxTranslate.current <= 0) return
      if (activePointerId.current !== null) return

      gestureAxis.current = null
      gestureStart.current = { x: event.clientX, y: event.clientY }

      if (event.pointerType === "touch") {
        activePointerId.current = event.pointerId
        return
      }

      beginDrag(event)
    }

    const onPointerMove = (event: PointerEvent) => {
      if (activePointerId.current !== null && event.pointerId !== activePointerId.current) {
        return
      }

      if (!dragging.current && event.pointerType === "touch") {
        const deltaX = event.clientX - gestureStart.current.x
        const deltaY = event.clientY - gestureStart.current.y

        if (gestureAxis.current === null) {
          if (
            Math.abs(deltaX) < TOUCH_GESTURE_LOCK_PX &&
            Math.abs(deltaY) < TOUCH_GESTURE_LOCK_PX
          ) {
            return
          }

          gestureAxis.current =
            Math.abs(deltaX) >= Math.abs(deltaY) ? "x" : "y"

          if (gestureAxis.current === "y") {
            activePointerId.current = null
            return
          }

          beginDrag(event)
        }
      }

      if (!dragging.current) return

      if (event.pointerType === "touch") {
        event.preventDefault()
      }

      const now = performance.now()
      const sample = lastPointerSample.current
      const elapsed = now - sample.t
      const dragSpeed = event.pointerType === "touch" ? TOUCH_DRAG_SPEED : DRAG_SPEED

      if (elapsed > 0 && elapsed < 80) {
        const instantVelocity =
          (-(event.clientX - sample.x) / elapsed) * dragSpeed
        dragVelocity.current =
          instantVelocity * 0.65 + dragVelocity.current * 0.35
      }

      lastPointerSample.current = { x: event.clientX, t: now }

      // 1:1 with the pointer, batched to one write per frame. Batching does
      // not soften the mapping — the rail still lands exactly where the finger
      // puts it, just once per frame rather than once per event.
      const deltaX = event.clientX - dragOrigin.current.x
      applyTranslate(dragOrigin.current.translate - deltaX * dragSpeed)
      syncTarget()
    }

    const endDrag = (event: PointerEvent) => {
      if (activePointerId.current !== null && event.pointerId !== activePointerId.current) {
        return
      }

      const wasDragging = dragging.current

      dragging.current = false
      gestureAxis.current = null
      activePointerId.current = null

      if (section.hasPointerCapture(event.pointerId)) {
        section.releasePointerCapture(event.pointerId)
      }

      section.style.cursor = ""
      section.style.touchAction = ""

      if (wasDragging) {
        startMomentum()
      }
    }

    // Arrow keys scrub only when the lifeline effectively is the page, or
    // when focus is inside it. An embedded instance must not capture host
    // keyboard scrolling until the reader has tabbed into it.
    const ownsKeyboard = () => {
      const active = document.activeElement
      if (active && section.contains(active)) return true

      return !resolveMode()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (maxTranslate.current <= 0) return
      if (isScrollLocked()) return
      if (isEditableTarget(event.target)) return
      if (!ownsKeyboard()) return

      stopMomentum()
      dragVelocity.current = 0

      // Through the glide, so a held arrow key reads as travel rather than a
      // sequence of jumps.
      const step = maxTranslate.current * 0.05

      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault()
        scrub(targetTranslate.current - step)
      }

      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault()
        scrub(targetTranslate.current + step)
      }
    }

    window.addEventListener("wheel", onWheelStream, {
      passive: true,
      capture: true,
    })
    section.addEventListener("scroll", onSectionScroll, { passive: true })
    section.addEventListener("wheel", onWheel, { passive: false })
    section.addEventListener("pointerdown", onPointerDown)
    section.addEventListener("pointermove", onPointerMove, { passive: false })
    section.addEventListener("pointerup", endDrag)
    section.addEventListener("pointercancel", endDrag)
    window.addEventListener("keydown", onKeyDown)

    return () => {
      cancelAnimationFrame(frameId)
      stopMomentum()
      stopGlide()
      cancelAnimationFrame(commitId.current)
      commitId.current = 0
      cancelAnimationFrame(settleId.current)
      settlingRef.current = false
      resizeObserver?.disconnect()
      motionQuery.removeEventListener("change", onMotionChange)
      window.removeEventListener("resize", scheduleMeasure)
      window.removeEventListener("wheel", onWheelStream, { capture: true })
      section.removeEventListener("scroll", onSectionScroll)
      section.removeEventListener("wheel", onWheel)
      section.removeEventListener("pointerdown", onPointerDown)
      section.removeEventListener("pointermove", onPointerMove)
      section.removeEventListener("pointerup", endDrag)
      section.removeEventListener("pointercancel", endDrag)
      window.removeEventListener("keydown", onKeyDown)
      dragging.current = false
      gestureAxis.current = null
      activePointerId.current = null
      // A remount must not start out believing it is mid-release.
      gestureStartedHere.current = false
      gestureReleased.current = false
      boundaryHitAt.current = 0
      wheelGapMs.current = Number.POSITIVE_INFINITY
      section.style.cursor = ""
      section.style.touchAction = ""
    }
  }, [
    applyTranslate,
    applyTranslateNow,
    isScrollLocked,
    markerCount,
    measureLayout,
    resolveMode,
  ])

  return {
    sectionRef,
    trackRef,
    labelsRef,
    setMarkerRef,
    isLayoutReady,
    isEmbed,
    /**
     * Embedded only: whether the module has come into view and the intro is
     * cleared to play. Page mode never waits, so this stays false there and
     * callers should read it as `!isEmbed || introArmed`.
     */
    introArmed,
  }
}