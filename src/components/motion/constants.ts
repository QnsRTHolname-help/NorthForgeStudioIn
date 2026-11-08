/**
 * Motion constants (spec §8).
 *
 * One place to tune the feel of the site. Every component reads from here
 * instead of scattering magic numbers, so a single change ripples through.
 *
 * All values are tuned for the editorial / glassmorphism direction on this
 * site. They are deliberately conservative — the site should feel premium,
 * not noisy.
 */

/** Easing curves used across the motion system (spec §2, §8). */
export const EASE = {
  entrance: 'power3.out',
  editorial: 'power4.out',
  cinematic: 'expo.out',
  fluid: 'power2.out',
  scrub: 'none',
  snap: 'power2.out',
  gentle: 'power2.out',
  expressive: 'expo.out',
  spring: 'back.out(1.2)',
  /** Standard CSS cubic bezier strings matching the GSAP curves */
  cssCinematic: 'cubic-bezier(0.16, 1, 0.3, 1)',
  cssEditorial: 'cubic-bezier(0.22, 1, 0.36, 1)',
  cssSpring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const;

/** Durations (seconds). */
export const DURATION = {
  instant: 0.1,
  fast: 0.2,
  ui: 0.35,
  section: 0.75,
  panel: 1.15,
  slow: 1.5,
  atmospheric: 2.2,
} as const;

/** Stagger intervals (seconds). */
export const STAGGER = {
  micro: 0.03,
  tight: 0.05,
  standard: 0.08,
  relaxed: 0.12,
  proof: 0.1,
} as const;

/** Movement distances (px). */
export const DISTANCE = {
  micro: 6,
  ui: 14,
  section: 24,
  headline: 20,
  card: 16,
} as const;

/** ScrollTrigger start positions (shared so sections feel consistent). */
export const START = {
  enter: 'top 85%',
  early: 'top 90%',
  mid: 'top 75%',
  late: 'top 65%',
} as const;

/** Scroll scrub smoothing. With Lenis smooth scrolling active, scrub: true
 * binds animations 1:1 to the scroll position without double-smoothing input lag (spec §3). */
export const SCRUB: boolean | number = true;