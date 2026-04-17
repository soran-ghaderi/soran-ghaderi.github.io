/* =====================================================
   LINK PREVIEW POPOVERS
   On hover / focus of internal links in article/about/publication
   areas, show a small card with title, excerpt, and thumbnail.
   Fetched HTML is cached per-URL. Reuses prefetch warm-up when
   possible. Vanilla JS, feature-detected, desktop-only.
   ===================================================== */
(function () {
  'use strict';

  // -- Gates ----------------------------------------------------------------
  if (!('fetch' in window) || !('DOMParser' in window)) return;

  // Touch-only / coarse pointer devices: skip entirely.
  if (window.matchMedia && !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  var reduceMotion = window.matchMedia &&
                     window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var origin = location.origin;
  var skipExt = /\.(pdf|zip|tar|gz|dmg|exe|mp4|webm|png|jpe?g|gif|svg|webp|ico)(\?.*)?$/i;

  // URL -> Promise<{title, excerpt, thumb}>
  var cache = new Map();

  // Selectors: areas where previews are enabled.
  var SCOPE_SEL = [
    '.blog-post-content',
    '.article-post',
    '.intro-container',
    '.publications-container',
    '.projects-container',
    '.publication-card',
    '.post-box'
  ].join(',');

  var HOVER_OPEN_MS  = 140;
  var HOVER_CLOSE_MS = 120;

  // -- Popover element -----------------------------------------------------
  var pop = null;
  var popInner = null;
  var popArrow = null;

  function buildPop() {
    if (pop) return;
    pop = document.createElement('div');
    pop.className = 'link-preview';
    pop.setAttribute('role', 'tooltip');
    pop.id = 'link-preview-popover';
    pop.setAttribute('aria-hidden', 'true');

    popArrow = document.createElement('span');
    popArrow.className = 'link-preview__arrow';

    popInner = document.createElement('div');
    popInner.className = 'link-preview__inner';

    pop.appendChild(popArrow);
    pop.appendChild(popInner);
    document.body.appendChild(pop);

    // Keep open while pointer is inside popover
    pop.addEventListener('mouseenter', function () { cancelClose(); });
    pop.addEventListener('mouseleave', function () { scheduleClose(); });
  }

  function renderLoading() {
    popInner.innerHTML =
      '<div class="link-preview__title link-preview__skeleton"></div>' +
      '<div class="link-preview__excerpt link-preview__skeleton"></div>' +
      '<div class="link-preview__excerpt link-preview__skeleton link-preview__skeleton--short"></div>';
  }

  function renderData(data) {
    if (!data) { hide(); return; }

    // Cross-ref / DOM-clone preview: render the cloned node directly.
    if (data.kind === 'dom' && data.node) {
      popInner.innerHTML = '';
      var wrap = document.createElement('div');
      wrap.className = 'link-preview__body link-preview__body--xref';
      if (data.label) {
        var lab = document.createElement('div');
        lab.className = 'link-preview__kicker';
        lab.textContent = data.label;
        wrap.appendChild(lab);
      }
      var content = document.createElement('div');
      content.className = 'link-preview__xref';
      content.appendChild(data.node);
      wrap.appendChild(content);
      popInner.appendChild(wrap);

      // Re-typeset MathJax inside the popover if present (equation refs).
      if (window.MathJax && window.MathJax.typesetPromise) {
        try { window.MathJax.typesetPromise([content]); } catch (e) { /* noop */ }
      }
      return;
    }

    // Standard fetched-page preview.
    var html = '';
    if (data.thumb) {
      html += '<div class="link-preview__thumb">' +
              '<img src="' + escapeAttr(data.thumb) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.parentNode.style.display=&#39;none&#39;">' +
              '</div>';
    }
    html += '<div class="link-preview__body">';
    if (data.title)   html += '<div class="link-preview__title">' + escapeHtml(data.title) + '</div>';
    if (data.excerpt) html += '<p class="link-preview__excerpt">' + escapeHtml(data.excerpt) + '</p>';
    html += '</div>';
    popInner.innerHTML = html;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function escapeAttr(s) { return escapeHtml(s); }

  // -- Extraction ----------------------------------------------------------
  function extract(html, baseUrl) {
    var doc;
    try {
      doc = new DOMParser().parseFromString(html, 'text/html');
    } catch (e) { return null; }
    if (!doc) return null;

    // Title
    var titleEl = doc.querySelector('h1.posttitle, .post-header .posttitle, h1.page-title, h1');
    var title = (titleEl && titleEl.textContent || '').trim();
    if (!title) {
      var t = doc.querySelector('title');
      title = t ? t.textContent.trim() : '';
      // Strip " | Site Name" / " - Site Name" suffix heuristically
      title = title.replace(/\s*[\|–—\-]\s*[^|–—\-]+$/, '').trim() || title;
    }

    // Excerpt: first meaningful paragraph inside the article / post content
    var scope = doc.querySelector('.blog-post-content, .article-post, main, body');
    var excerpt = '';
    if (scope) {
      var ps = scope.querySelectorAll('p');
      for (var i = 0; i < ps.length; i++) {
        var text = (ps[i].textContent || '').trim();
        if (text.length < 40) continue;
        // Avoid picking up obvious meta rows
        if (ps[i].closest('.post-meta, .post-footer, nav')) continue;
        excerpt = text;
        break;
      }
    }
    if (excerpt.length > 180) excerpt = excerpt.slice(0, 177).replace(/\s+\S*$/, '') + '…';

    // Thumbnail: og:image -> twitter:image -> featured-image -> first "large" img
    var thumb = '';
    var og = doc.querySelector('meta[property="og:image"], meta[name="og:image"]');
    if (og && og.getAttribute('content')) thumb = og.getAttribute('content');
    if (!thumb) {
      var tw = doc.querySelector('meta[name="twitter:image"], meta[property="twitter:image"]');
      if (tw && tw.getAttribute('content')) thumb = tw.getAttribute('content');
    }
    if (!thumb) {
      var featured = doc.querySelector('.featured-image img, .featured-image, .post-thumbnail img');
      if (featured) thumb = featured.getAttribute('src') || featured.getAttribute('data-src') || '';
    }
    if (!thumb) {
      // Walk content imgs, skip ones that look like icons/badges/avatars/SVG.
      var imgs = doc.querySelectorAll('.blog-post-content img, .article-post img, main img');
      for (var k = 0; k < imgs.length; k++) {
        var im = imgs[k];
        if (im.closest('noscript, .post-meta, .post-footer, nav, header')) continue;
        var src = im.getAttribute('src') || im.getAttribute('data-src') || '';
        if (!src) continue;
        if (/^data:/.test(src)) continue;
        if (/(badge|shields\.io|avatar|icon|logo)/i.test(src)) continue;
        // Width hints (parsed from attrs only; offsetWidth is 0 in detached doc)
        var w = parseInt(im.getAttribute('width') || '0', 10);
        var h = parseInt(im.getAttribute('height') || '0', 10);
        if ((w && w < 80) || (h && h < 60)) continue;
        thumb = src;
        break;
      }
    }
    if (thumb) {
      try { thumb = new URL(thumb, baseUrl).href; } catch (e) { /* leave as-is */ }
    }

    return { title: title, excerpt: excerpt, thumb: thumb };
  }

  function fetchPreview(url) {
    if (cache.has(url)) return cache.get(url);
    var p = fetch(url, { credentials: 'same-origin' })
      .then(function (r) {
        if (!r.ok) throw new Error('bad status');
        var ct = r.headers.get('content-type') || '';
        if (ct && ct.indexOf('text/html') === -1) throw new Error('not html');
        return r.text();
      })
      .then(function (html) { return extract(html, url); })
      .catch(function () { return null; });
    cache.set(url, p);
    return p;
  }

  // -- Eligibility ---------------------------------------------------------
  // Returns the URL string if eligible, or { hash: '#id' } for same-page
  // cross-references, or false otherwise.
  function isEligible(a) {
    if (!a || !a.href) return false;
    if (a.hasAttribute('data-no-preview')) return false;
    if (a.target === '_blank') return false;
    var rel = (a.getAttribute('rel') || '').toLowerCase();
    if (rel.indexOf('external') !== -1) return false;
    var url;
    try { url = new URL(a.href); } catch (e) { return false; }
    if (url.origin !== origin) return false;

    // Same-page reference: cross-ref to fig/eq/tab/alg/bibliography/heading.
    if (url.pathname === location.pathname && url.hash && url.hash.length > 1) {
      var targetId = decodeURIComponent(url.hash.slice(1));
      var targetEl = document.getElementById(targetId);
      if (!targetEl) return false;
      // Only preview "interesting" same-page targets.
      if (targetEl.matches('.academic-figure, .academic-table, .academic-equation, .academic-algorithm, .bib-entry') ||
          a.classList.contains('ref') || a.classList.contains('eqref') || a.classList.contains('citation-link') ||
          /^(fig|tab|eq|alg|sec|thm|lem|def|ref)-/i.test(targetId)) {
        return { hash: targetId };
      }
      return false;
    }

    if (url.pathname === location.pathname) return false;
    if (skipExt.test(url.pathname)) return false;
    // Require link to be inside one of the allowed scopes
    if (!a.closest(SCOPE_SEL)) return false;
    return url.href;
  }

  // -- Same-page cross-ref preview ----------------------------------------
  function buildXrefData(targetId) {
    var el = document.getElementById(targetId);
    if (!el) return null;

    var label = '';
    var clone = null;

    if (el.matches('.academic-figure')) {
      label = 'Figure';
      var num = el.getAttribute('data-figure-number');
      if (num) label += ' ' + num;
      clone = el.cloneNode(true);
    } else if (el.matches('.academic-table')) {
      label = 'Table';
      var tnum = el.getAttribute('data-table-number');
      if (tnum) label += ' ' + tnum;
      clone = el.cloneNode(true);
    } else if (el.matches('.academic-equation')) {
      label = 'Equation';
      var enum_ = el.getAttribute('data-equation-number');
      if (enum_) label += ' (' + enum_ + ')';
      clone = el.cloneNode(true);
    } else if (el.matches('.academic-algorithm')) {
      label = 'Algorithm';
      var anum = el.getAttribute('data-algorithm-number');
      if (anum) label += ' ' + anum;
      clone = el.cloneNode(true);
    } else if (el.matches('.bib-entry')) {
      // Bibliography entry. Find its index inside the parent <ol> so we can
      // surface "Reference [3]" as the kicker, then wrap the cloned <li>
      // contents in a plain block (a bare <li> outside <ol> renders oddly).
      label = 'Reference';
      var parent = el.parentNode;
      if (parent && parent.children) {
        for (var bi = 0; bi < parent.children.length; bi++) {
          if (parent.children[bi] === el) { label += ' [' + (bi + 1) + ']'; break; }
        }
      }
      var bibWrap = document.createElement('div');
      bibWrap.className = 'link-preview__bib';
      // Move children of the cloned <li> into a div to avoid <li> rendering quirks.
      var liClone = el.cloneNode(true);
      while (liClone.firstChild) bibWrap.appendChild(liClone.firstChild);
      clone = bibWrap;
    } else if (/^h[1-6]$/i.test(el.tagName)) {
      label = 'Section';
      // Pull heading + first paragraph after it.
      var wrap = document.createElement('div');
      wrap.appendChild(el.cloneNode(true));
      var sib = el.nextElementSibling;
      var added = 0;
      while (sib && added < 2) {
        if (sib.tagName && /^H[1-6]$/i.test(sib.tagName)) break;
        wrap.appendChild(sib.cloneNode(true));
        added++;
        sib = sib.nextElementSibling;
      }
      clone = wrap;
    } else {
      // Generic anchor target: clone the element itself.
      clone = el.cloneNode(true);
    }

    if (!clone) return null;

    // Strip ids on cloned content to avoid duplicate-id collisions in DOM.
    if (clone.removeAttribute) clone.removeAttribute('id');
    var nested = clone.querySelectorAll ? clone.querySelectorAll('[id]') : [];
    for (var i = 0; i < nested.length; i++) nested[i].removeAttribute('id');

    return { kind: 'dom', label: label, node: clone };
  }

  // -- Positioning ---------------------------------------------------------
  function position(anchor) {
    var margin = 10;
    var rect = anchor.getBoundingClientRect();
    var popRect = pop.getBoundingClientRect();
    var vw = window.innerWidth;
    var vh = window.innerHeight;

    // Prefer above; flip below if not enough space
    var placeAbove = rect.top >= popRect.height + margin + 12;
    var top = placeAbove
      ? rect.top - popRect.height - margin + window.scrollY
      : rect.bottom + margin + window.scrollY;

    var left = rect.left + rect.width / 2 - popRect.width / 2 + window.scrollX;
    var minLeft = margin + window.scrollX;
    var maxLeft = vw - popRect.width - margin + window.scrollX;
    if (left < minLeft) left = minLeft;
    if (left > maxLeft) left = maxLeft;

    pop.style.top = top + 'px';
    pop.style.left = left + 'px';
    pop.classList.toggle('link-preview--below', !placeAbove);

    // Arrow horizontal offset
    var anchorCenterX = rect.left + rect.width / 2 + window.scrollX;
    var arrowX = anchorCenterX - left;
    arrowX = Math.max(14, Math.min(popRect.width - 14, arrowX));
    popArrow.style.left = arrowX + 'px';
  }

  // -- State machine -------------------------------------------------------
  var openTimer = null;
  var closeTimer = null;
  var currentAnchor = null;

  function cancelOpen()  { if (openTimer)  { clearTimeout(openTimer);  openTimer  = null; } }
  function cancelClose() { if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; } }

  function show(anchor) {
    buildPop();
    currentAnchor = anchor;
    anchor.setAttribute('aria-describedby', pop.id);

    var eligible = isEligible(anchor);
    var isXref = eligible && typeof eligible === 'object' && eligible.hash;

    pop.classList.toggle('link-preview--xref', !!isXref);

    if (isXref) {
      var data = buildXrefData(eligible.hash);
      if (!data) { hide(); return; }
      renderData(data);
    } else {
      renderLoading();
    }

    // Prep popover off-screen to measure, then position
    pop.classList.add('is-measuring');
    pop.classList.add('is-visible');
    pop.setAttribute('aria-hidden', 'false');
    // Double rAF: measure after layout
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (currentAnchor !== anchor) return;
        position(anchor);
        pop.classList.remove('is-measuring');
      });
    });

    if (isXref) return;

    var url = anchor.href;
    fetchPreview(url).then(function (data) {
      if (currentAnchor !== anchor || !pop.classList.contains('is-visible')) return;
      if (data && (data.title || data.excerpt || data.thumb)) {
        renderData(data);
        // Reposition after content is swapped in (height may change)
        requestAnimationFrame(function () { position(anchor); });
      } else {
        hide();
      }
    });
  }

  function hide() {
    cancelOpen(); cancelClose();
    if (currentAnchor) {
      currentAnchor.removeAttribute('aria-describedby');
      currentAnchor = null;
    }
    if (pop) {
      pop.classList.remove('is-visible');
      pop.setAttribute('aria-hidden', 'true');
    }
  }

  function scheduleClose() {
    cancelClose();
    closeTimer = setTimeout(hide, HOVER_CLOSE_MS);
  }

  // -- Event wiring --------------------------------------------------------
  function onEnter(e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    if (!isEligible(a)) return;
    cancelClose();
    cancelOpen();
    openTimer = setTimeout(function () { show(a); }, HOVER_OPEN_MS);
  }

  function onLeave(e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    cancelOpen();
    if (currentAnchor === a) scheduleClose();
  }

  function onFocus(e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    if (!isEligible(a)) return;
    cancelClose(); cancelOpen();
    openTimer = setTimeout(function () { show(a); }, HOVER_OPEN_MS);
  }

  function onBlur(e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    cancelOpen();
    if (currentAnchor === a) scheduleClose();
  }

  document.addEventListener('mouseover', onEnter, { passive: true });
  document.addEventListener('mouseout',  onLeave, { passive: true });
  document.addEventListener('focusin',   onFocus, { passive: true });
  document.addEventListener('focusout',  onBlur,  { passive: true });
  window.addEventListener('scroll',      hide,    { passive: true });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') hide();
  });
})();
