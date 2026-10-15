/**
 * Shared scroll-progress store.
 *
 * Lenis drives the public website; `useScrollProgress` needs a single source
 * of truth for scroll position that works whether Lenis is active (smooth),
 * disabled (reduced motion / touch), or absent (admin routes).
 *
 * Publishing here — instead of reading `window.scrollY` directly — keeps the
 * hook's value frame-accurate with Lenis and lets it degrade gracefully.
 */
type Listener = (progress: number) => void;

const store = {
  progress: 0,
  listeners: new Set<Listener>(),
  subscribe(fn: Listener) {
    this.listeners.add(fn);
    fn(this.progress);
    return () => this.listeners.delete(fn);
  },
  set(next: number) {
    if (next === this.progress) return;
    this.progress = next;
    for (const fn of this.listeners) fn(next);
  },
};

export function getScrollProgress() {
  return store.progress;
}

export function setScrollProgress(progress: number) {
  store.set(progress);
}

export function subscribeScrollProgress(fn: Listener) {
  return store.subscribe(fn);
}