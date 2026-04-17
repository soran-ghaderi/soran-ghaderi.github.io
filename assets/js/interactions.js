/* =====================================================
   INTERACTIONS
   - Reading-progress bar (posts only, rAF-throttled)
   - Scroll-reveal for cards & sections (IntersectionObserver)
   - Copy-code success pulse hook
   All features progressive: absent targets = no-op.
   Motion-safe via prefers-reduced-motion.
   ===================================================== */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia &&
                     window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- Reading progress bar -----------------------------------------------
  function initReadingProgress() {
    var bar = document.querySelector('.reading-progress');
    if (!bar) return;
    var article = document.querySelector('.blog-post-content') ||
                  document.querySelector('.article-post');
    if (!article) { bar.style.display = 'none'; return; }

    function update() {
      var rect = article.getBoundingClientRect();
      var total = rect.height - window.innerHeight;
      if (total <= 0) { bar.style.width = '100%'; return; }
      var scrolled = Math.min(Math.max(-rect.top, 0), total);
      bar.style.width = ((scrolled / total) * 100).toFixed(2) + '%';
    }

    if (reduceMotion) { update(); return; }

    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { update(); ticking = false; });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
  }

  // --- Scroll-reveal (IntersectionObserver) -------------------------------
  function initScrollReveal() {
    if (reduceMotion) return;
    if (!('IntersectionObserver' in window)) return;

    var targets = document.querySelectorAll(
      '.row.layout, .publication-card, .intro-container section, .post-box'
    );
    if (!targets.length) return;

    targets.forEach(function (el) { el.classList.add('reveal'); });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    targets.forEach(function (el) { io.observe(el); });
  }

  // --- Copy-code success pulse (hooks existing .copied class flip) --------
  function initCopyPulse() {
    if (reduceMotion) return;
    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        if (m.type === 'attributes' && m.attributeName === 'class') {
          var el = m.target;
          if (el.classList && el.classList.contains('copied')) {
            el.classList.remove('copy-pulse');
            // force reflow so the animation restarts reliably
            void el.offsetWidth;
            el.classList.add('copy-pulse');
          }
        }
      });
    });
    document.querySelectorAll('.code-copy-button, .copy-button').forEach(function (btn) {
      observer.observe(btn, { attributes: true, attributeFilter: ['class'] });
    });
  }

  // --- Bootstrap on DOM ready ---------------------------------------------
  function start() {
    initReadingProgress();
    initScrollReveal();
    initCopyPulse();
    initBackToTop();
  }

  // --- Back-to-top link ----------------------------------------------------
  function initBackToTop() {
    var links = document.querySelectorAll('.site-footer__top, a[href="#top"]');
    if (!links.length) return;
    links.forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        var behavior = reduceMotion ? 'auto' : 'smooth';
        try {
          window.scrollTo({ top: 0, left: 0, behavior: behavior });
        } catch (err) {
          window.scrollTo(0, 0);
        }
        // Move focus to a sensible top landmark for keyboard users.
        var target = document.querySelector('main, [role="main"], header, body');
        if (target && target.focus) {
          var hadTabindex = target.hasAttribute('tabindex');
          if (!hadTabindex) target.setAttribute('tabindex', '-1');
          target.focus({ preventScroll: true });
          if (!hadTabindex) {
            setTimeout(function () { target.removeAttribute('tabindex'); }, 100);
          }
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
