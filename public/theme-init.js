/**
 * Theme bootstrap — runs before first paint to avoid a flash of the wrong surface.
 *
 * Kept as a separate file (rather than inlined in index.html) so the app can
 * run under a strict Content-Security-Policy with no 'unsafe-inline' scripts.
 */
(function () {
  try {
    // Default is the warm cream theme — the public site is always cream and
    // dashboard users who want dark pick it once (stored, then honoured).
    var stored = localStorage.getItem('nf.theme') || 'light';
    var resolved =
      stored === 'system'
        ? window.matchMedia('(prefers-color-scheme: light)').matches
          ? 'light'
          : 'dark'
        : stored;
    document.documentElement.setAttribute('data-theme', resolved);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
