/**
 * Lazy Media Loader v2
 * Zero-dependency, IntersectionObserver-based lazy loading for images, videos, and iframes.
 *
 * Works in tandem with the early <head> interceptor that strips sources from
 * videos and adds loading="lazy" to images as the DOM is parsed. This script
 * then uses IntersectionObserver to:
 *   - Load video sources and autoplay only when scrolled into view
 *   - Pause videos when scrolled away (saves CPU/memory)
 *   - Load images via data-src swap when scrolled into view (for IO-based images)
 *   - Add loading="lazy" + decoding="async" to any images the head script missed
 *   - Lazy-load iframes
 *
 * No external dependencies. GitHub Pages compatible.
 */
(function () {
  'use strict';

  var ROOT_MARGIN = '300px 0px'; // pre-fetch 300px ahead of viewport
  var THRESHOLD   = 0.01;
  var hasIO       = 'IntersectionObserver' in window;

  // ── Disconnect early interceptor ───────────────────────────────────────
  // The <head> MutationObserver has done its job; disconnect to save cycles.
  if (window.__lazyMediaEarlyMO) {
    window.__lazyMediaEarlyMO.disconnect();
    delete window.__lazyMediaEarlyMO;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // VIDEO: IntersectionObserver — load on scroll, play/pause on visibility
  // ═══════════════════════════════════════════════════════════════════════

  function loadVideo(video) {
    if (video.classList.contains('lazy-loaded')) return;

    video.querySelectorAll('source[data-src]').forEach(function (s) {
      s.src = s.getAttribute('data-src');
      s.removeAttribute('data-src');
    });
    if (video.hasAttribute('data-video-src')) {
      video.src = video.getAttribute('data-video-src');
      video.removeAttribute('data-video-src');
    }
    video.load();
    video.classList.add('lazy-loaded');
  }

  function onVideoIntersection(entries) {
    entries.forEach(function (entry) {
      var v = entry.target;
      if (entry.isIntersecting) {
        if (!v.classList.contains('lazy-loaded')) loadVideo(v);
        if (v.paused && v.hasAttribute('data-autoplay')) {
          v.play().catch(function () {});
        }
      } else {
        if (!v.paused) v.pause();
      }
    });
  }

  var videoObs = hasIO
    ? new IntersectionObserver(onVideoIntersection, { rootMargin: ROOT_MARGIN, threshold: THRESHOLD })
    : null;

  function observeVideo(v) {
    if (videoObs) videoObs.observe(v);
    else loadVideo(v); // fallback: just load
  }

  // ═══════════════════════════════════════════════════════════════════════
  // IMAGE: IntersectionObserver — true scroll-triggered loading
  // For images that use data-src (template pattern) or haven't loaded yet
  // ═══════════════════════════════════════════════════════════════════════

  function loadImage(img) {
    if (img.hasAttribute('data-src')) {
      img.src = img.getAttribute('data-src');
      img.removeAttribute('data-src');
    }
    img.classList.add('lazy-loaded');
  }

  function onImageIntersection(entries, observer) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        loadImage(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }

  var imgObs = hasIO
    ? new IntersectionObserver(onImageIntersection, { rootMargin: ROOT_MARGIN, threshold: THRESHOLD })
    : null;

  function observeImage(img) {
    // Only IO-observe images that have a data-src to swap
    if (img.hasAttribute('data-src') && imgObs) {
      imgObs.observe(img);
    } else if (img.hasAttribute('data-src')) {
      loadImage(img); // fallback
    }
    // Always ensure native lazy attrs are set
    if (!img.hasAttribute('loading'))  img.setAttribute('loading', 'lazy');
    if (!img.hasAttribute('decoding')) img.setAttribute('decoding', 'async');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // IFRAME: just ensure loading="lazy"
  // ═══════════════════════════════════════════════════════════════════════

  function optimizeIframe(iframe) {
    if (!iframe.hasAttribute('loading')) iframe.setAttribute('loading', 'lazy');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // INIT: process existing DOM
  // ═══════════════════════════════════════════════════════════════════════

  function processAll() {
    // All lazy-video elements (set by templates or by the early interceptor)
    document.querySelectorAll('video.lazy-video').forEach(observeVideo);

    // All images inside content areas
    document.querySelectorAll(
      '.page-content img, .article-post img, .blog-featured-image img, ' +
      '.blog-card-image img, .featured-card-image img, ' +
      '.publication-card-image img, .featured-image-wrapper img'
    ).forEach(observeImage);

    // iframes
    document.querySelectorAll('iframe').forEach(optimizeIframe);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', processAll);
  } else {
    processAll();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MUTATION OBSERVER: handle dynamically inserted content
  // ═══════════════════════════════════════════════════════════════════════

  if ('MutationObserver' in window) {
    new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        m.addedNodes.forEach(function (n) {
          if (n.nodeType !== 1) return;
          if (n.tagName === 'VIDEO' && n.classList.contains('lazy-video')) observeVideo(n);
          if (n.tagName === 'IMG') observeImage(n);
          if (n.tagName === 'IFRAME') optimizeIframe(n);
          if (n.querySelectorAll) {
            n.querySelectorAll('video.lazy-video').forEach(observeVideo);
            n.querySelectorAll('img').forEach(observeImage);
            n.querySelectorAll('iframe').forEach(optimizeIframe);
          }
        });
      });
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
})();
