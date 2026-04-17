/* =====================================================
   INSTANT PREFETCH
   Same-origin link prefetch on hover / focus / touchstart
   plus idle-time warm-up of top menu links. No visual change:
   pages just load instantly on click.
   Feature-detected, skips slow networks / Save-Data.
   ===================================================== */
(function () {
  'use strict';

  // -- Feature gates --------------------------------------------------------
  var supportsPrefetch = (function () {
    try {
      var l = document.createElement('link');
      return !!(l.relList && l.relList.supports && l.relList.supports('prefetch'));
    } catch (e) { return false; }
  })();
  if (!supportsPrefetch) return;

  var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (conn) {
    if (conn.saveData) return;
    if (conn.effectiveType && /^(2g|slow-2g)$/.test(conn.effectiveType)) return;
  }

  // -- State ----------------------------------------------------------------
  var prefetched = new Set();
  var MAX_PREFETCHES = 25;
  var HOVER_DELAY_MS = 65;
  var origin = location.origin;
  var skipExt = /\.(pdf|zip|tar|gz|dmg|exe|mp4|webm|png|jpe?g|gif|svg|webp|ico)(\?.*)?$/i;

  function shouldPrefetch(a) {
    if (!a || !a.href) return false;
    if (a.hasAttribute('data-no-prefetch')) return false;
    if (a.target === '_blank') return false;
    var rel = (a.getAttribute('rel') || '').toLowerCase();
    if (rel.indexOf('external') !== -1 || rel.indexOf('nofollow') !== -1) return false;
    var url;
    try { url = new URL(a.href); } catch (e) { return false; }
    if (url.origin !== origin) return false;
    if (url.pathname === location.pathname && url.search === location.search) return false;
    if (skipExt.test(url.pathname)) return false;
    var key = url.pathname + url.search;
    if (prefetched.has(key)) return false;
    if (prefetched.size >= MAX_PREFETCHES) return false;
    return key;
  }

  function prefetch(a) {
    var key = shouldPrefetch(a);
    if (!key) return;
    prefetched.add(key);
    var link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = a.href;
    link.as = 'document';
    document.head.appendChild(link);
  }

  // -- Event listeners ------------------------------------------------------
  var hoverTimer = null;
  var hoveredEl = null;

  document.addEventListener('mouseover', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a || a === hoveredEl) return;
    hoveredEl = a;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(function () { prefetch(a); }, HOVER_DELAY_MS);
  }, { passive: true });

  document.addEventListener('mouseout', function (e) {
    if (hoveredEl && e.target === hoveredEl) {
      hoveredEl = null;
      clearTimeout(hoverTimer);
    }
  }, { passive: true });

  document.addEventListener('focusin', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (a) prefetch(a);
  }, { passive: true });

  document.addEventListener('touchstart', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (a) prefetch(a);
  }, { passive: true, capture: true });

  // -- Idle warm-up of primary nav -----------------------------------------
  function idleWarmup() {
    var warm = function () {
      var links = document.querySelectorAll('.navbar-nav a[href], .nav-link[href]');
      var n = Math.min(links.length, 4);
      for (var i = 0; i < n; i++) prefetch(links[i]);
    };
    if ('requestIdleCallback' in window) {
      requestIdleCallback(warm, { timeout: 2500 });
    } else {
      setTimeout(warm, 1200);
    }
  }

  if (document.readyState === 'complete') {
    idleWarmup();
  } else {
    window.addEventListener('load', idleWarmup, { once: true });
  }

  // Expose for other modules to share the HTML cache
  window.__prefetchCache = prefetched;
})();
