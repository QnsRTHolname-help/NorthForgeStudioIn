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

/** Easing curves used across the motion system. */
export const EASE = {
  entrance: 'power3.out',
  editorial: 'power4.out',
  scrub: 'none',
  snap: 'power2.out',
  gentle: 'power2.out',
  expressive: 'expo.out',
} as const;

/** Durations (seconds). */
export const DURATION = {
  fast: 0.18,
  ui: 0.32,
  section: 0.7,
  panel: 1.1,
  slow: 1.4,
} as const;

/** Stagger intervals (seconds). */
export const STAGGER = {
  tight: 0.04,
  standard: 0.08,
  relaxed: 0.12,
  proof: 0.1,
} as const;

/** Movement distances (px). */
export const DISTANCE = {
  micro: 6,
  ui: 14,
  section: 26,
  headline: 18,
} as const;

/** ScrollTrigger start positions (shared so sections feel consistent). */
export const START = {
  enter: 'top 82%',
  early: 'top 88%',
  mid: 'top 72%',
} as const;

/** Scroll scrub smoothing. A small value keeps the scrub locked to scroll
 * while softening the jitter of trackpads. */
export const SCRUB = 0.6;