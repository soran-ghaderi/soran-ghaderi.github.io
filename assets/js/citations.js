/**
 * Bibliography + citation renderer for Jekyll posts (dependency-free).
 *
 * Authoring pattern:
 * - Inline citations: <cite data-key="key"></cite> or <cite data-key="key1, key2"></cite>
 * - BibTeX source (hidden): <div class="bibliography-data" style="display:none;"> ... </div>
 *
 * Output:
 * - In-text numeric citations (e.g., [1], [1, 2]) with links to a generated
 *   References section appended at the end of the article.
 */

(function () {
  'use strict';

  function getArticleRoot() {
    return document.querySelector('.article-post') || document.querySelector('article') || document.body;
  }

  function findBibliographyData(root) {
    return (
      (root && root.querySelector && root.querySelector('.bibliography-data')) ||
      document.querySelector('.bibliography-data') ||
      null
    );
  }

  function splitKeys(keys) {
    return String(keys || '')
      .split(',')
      .map(function (k) {
        return k.trim();
      })
      .filter(Boolean);
  }

  function makeRefId(key) {
    return (
      'ref-' +
      String(key || '')
        .trim()
        .replace(/[^A-Za-z0-9_-]/g, '_')
    );
  }

  function normalizeWhitespace(s) {
    return String(s || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function decodeBibValue(raw) {
    var v = String(raw || '').trim();
    if (!v) return '';
    // Remove wrapping braces or quotes.
    if ((v[0] === '{' && v[v.length - 1] === '}') || (v[0] === '"' && v[v.length - 1] === '"')) {
      v = v.slice(1, -1);
    }
    // Unescape common sequences.
    v = v.replace(/\\"/g, '"').replace(/\\n/g, ' ');
    return normalizeWhitespace(v);
  }

  function parseBibTeX(text) {
    // Minimal BibTeX parser for common entries:
    // @type{key, field = {value}, ...}
    var src = String(text || '');
    var i = 0;
    var n = src.length;
    var entries = Object.create(null);

    function isWs(ch) {
      return ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t' || ch === '\f';
    }

    function skipWs() {
      while (i < n && isWs(src[i])) i++;
    }

    function readUntil(stopChars) {
      var start = i;
      while (i < n && stopChars.indexOf(src[i]) === -1) i++;
      return src.slice(start, i);
    }

    function readBalancedBraces() {
      // Assumes src[i] === '{'
      var start = i;
      var depth = 0;
      while (i < n) {
        var ch = src[i];
        if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) {
            i++; // include closing brace
            break;
          }
        }
        i++;
      }
      return src.slice(start, i);
    }

    function readQuotedString() {
      // Assumes src[i] === '"'
      var start = i;
      i++;
      while (i < n) {
        var ch = src[i];
        if (ch === '\\') {
          i += 2;
          continue;
        }
        if (ch === '"') {
          i++;
          break;
        }
        i++;
      }
      return src.slice(start, i);
    }

    function readValue() {
      skipWs();
      if (i >= n) return '';
      var ch = src[i];
      if (ch === '{') return readBalancedBraces();
      if (ch === '"') return readQuotedString();
      // Bareword value (e.g., 2025)
      var v = readUntil(',}');
      return v;
    }

    while (i < n) {
      var at = src.indexOf('@', i);
      if (at === -1) break;
      i = at + 1;
      skipWs();

      var type = readUntil('{(');
      if (!type) continue;
      type = type.trim().toLowerCase();
      if (i >= n) break;

      var open = src[i];
      if (open !== '{' && open !== '(') continue;
      var close = open === '{' ? '}' : ')';
      i++; // skip open

      skipWs();
      var key = readUntil(',');
      key = String(key || '').trim();
      if (!key) {
        // Skip malformed entry.
        i = src.indexOf(close, i);
        if (i === -1) break;
        i++;
        continue;
      }
      if (src[i] === ',') i++;

      var fields = Object.create(null);
      fields._type = type;
      fields._key = key;

      while (i < n) {
        skipWs();
        if (src[i] === close) {
          i++;
          break;
        }
        var name = readUntil('=,}\n\r\t ');
        name = String(name || '').trim().toLowerCase();
        skipWs();
        if (src[i] !== '=') {
          // Skip to next comma/close.
          var nextComma = src.indexOf(',', i);
          var nextClose = src.indexOf(close, i);
          if (nextClose !== -1 && (nextComma === -1 || nextClose < nextComma)) {
            i = nextClose + 1;
            break;
          }
          if (nextComma === -1) break;
          i = nextComma + 1;
          continue;
        }
        i++; // skip '='

        var rawVal = readValue();
        var val = decodeBibValue(rawVal);
        if (name) fields[name] = val;

        skipWs();
        if (src[i] === ',') i++;
      }

      entries[key] = fields;
    }

    return entries;
  }

  function hasEntry(bibByKey, key) {
    return !!(bibByKey && Object.prototype.hasOwnProperty.call(bibByKey, key));
  }

  function getEntry(bibByKey, key) {
    return hasEntry(bibByKey, key) ? bibByKey[key] : null;
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Get citation style from Jekyll config (injected via data attribute or default)
  function getCitationStyle() {
    // Check for data attribute on html element (set by Jekyll)
    var htmlEl = document.documentElement;
    var style = htmlEl.getAttribute('data-citation-style');
    if (style) return style.toLowerCase();
    // Check meta tag
    var meta = document.querySelector('meta[name="citation-style"]');
    if (meta && meta.content) return meta.content.toLowerCase();
    // Default to APA
    return 'apa';
  }

  // Format author names according to style
  function formatAuthors(authorStr, style) {
    if (!authorStr) return '';
    // Split on " and " to handle multiple authors
    var authors = authorStr.split(/\s+and\s+/i);
    var formatted = [];
    
    for (var i = 0; i < authors.length; i++) {
      var author = authors[i].trim();
      if (!author) continue;
      
      // Check if already in "Last, First" format
      var parts;
      if (author.indexOf(',') !== -1) {
        parts = author.split(',');
        var lastName = parts[0].trim();
        var firstName = parts.slice(1).join(',').trim();
        // Get initials from first name
        var initials = firstName.split(/\s+/).map(function(n) {
          return n.charAt(0).toUpperCase() + '.';
        }).join(' ');
        
        if (style === 'ieee') {
          formatted.push(initials + ' ' + lastName);
        } else {
          formatted.push(lastName + ', ' + initials);
        }
      } else {
        // "First Last" format
        parts = author.split(/\s+/);
        if (parts.length === 1) {
          formatted.push(parts[0]);
        } else {
          var lastName = parts[parts.length - 1];
          var initials = parts.slice(0, -1).map(function(n) {
            return n.charAt(0).toUpperCase() + '.';
          }).join(' ');
          
          if (style === 'ieee') {
            formatted.push(initials + ' ' + lastName);
          } else {
            formatted.push(lastName + ', ' + initials);
          }
        }
      }
    }
    
    // Join authors according to style
    if (formatted.length === 0) return '';
    if (formatted.length === 1) return formatted[0];
    if (formatted.length === 2) {
      if (style === 'apa') return formatted[0] + ', & ' + formatted[1];
      if (style === 'ieee') return formatted[0] + ' and ' + formatted[1];
      return formatted[0] + ' and ' + formatted[1];
    }
    // 3+ authors
    var last = formatted.pop();
    if (style === 'apa') return formatted.join(', ') + ', & ' + last;
    if (style === 'ieee') return formatted.join(', ') + ', and ' + last;
    return formatted.join(', ') + ', and ' + last;
  }

  // Format URL/DOI link
  function formatLink(url, doi) {
    var href = '';
    var display = '';
    if (doi) {
      href = doi.indexOf('http') === 0 ? doi : 'https://doi.org/' + doi;
      display = href;
    } else if (url) {
      href = url.trim();
      display = href;
    }
    if (!href) return '';
    return '<a href="' + escapeHtml(href) + '" rel="noopener" target="_blank">' + escapeHtml(display) + '</a>';
  }

  // APA 7th Edition format
  // Author, A. A., & Author, B. B. (Year). Title of work. Publisher. URL
  function formatAPA(entry) {
    var parts = [];
    var author = formatAuthors(entry.author, 'apa');
    var year = entry.year || '';
    var title = entry.title || '';
    var venue = entry.journal || entry.booktitle || '';
    var publisher = entry.publisher || '';
    var volume = entry.volume || '';
    var pages = entry.pages || '';
    var url = entry.url || '';
    var doi = entry.doi || '';
    
    // Author (Year).
    if (author) {
      parts.push(escapeHtml(author) + ' (' + escapeHtml(year) + ').');
    } else if (year) {
      parts.push('(' + escapeHtml(year) + ').');
    }
    
    // Title (italicized for books/reports, regular for articles)
    if (title) {
      var type = entry._type || 'misc';
      if (type === 'article' && venue) {
        parts.push(escapeHtml(title) + '.');
      } else {
        parts.push('<em>' + escapeHtml(title) + '</em>.');
      }
    }
    
    // Journal/venue (italicized), volume, pages
    if (venue) {
      var venueStr = '<em>' + escapeHtml(venue) + '</em>';
      if (volume) venueStr += ', <em>' + escapeHtml(volume) + '</em>';
      if (pages) venueStr += ', ' + escapeHtml(pages);
      parts.push(venueStr + '.');
    } else if (publisher) {
      parts.push(escapeHtml(publisher) + '.');
    }
    
    // URL/DOI
    var link = formatLink(url, doi);
    if (link) parts.push(link);
    
    return parts.join(' ');
  }

  // IEEE format
  // A. Author, "Title," Journal, vol. X, no. Y, pp. Z, Year. [Online]. Available: URL
  function formatIEEE(entry) {
    var parts = [];
    var author = formatAuthors(entry.author, 'ieee');
    var year = entry.year || '';
    var title = entry.title || '';
    var venue = entry.journal || entry.booktitle || '';
    var volume = entry.volume || '';
    var number = entry.number || '';
    var pages = entry.pages || '';
    var publisher = entry.publisher || '';
    var url = entry.url || '';
    var doi = entry.doi || '';
    
    // Author,
    if (author) parts.push(escapeHtml(author) + ',');
    
    // "Title,"
    if (title) parts.push('"' + escapeHtml(title) + ',"');
    
    // Journal (italicized)
    if (venue) {
      var venueStr = '<em>' + escapeHtml(venue) + '</em>';
      if (volume) venueStr += ', vol. ' + escapeHtml(volume);
      if (number) venueStr += ', no. ' + escapeHtml(number);
      if (pages) venueStr += ', pp. ' + escapeHtml(pages);
      parts.push(venueStr + ',');
    } else if (publisher) {
      parts.push(escapeHtml(publisher) + ',');
    }
    
    // Year.
    if (year) parts.push(escapeHtml(year) + '.');
    
    // [Online]. Available: URL
    var link = formatLink(url, doi);
    if (link) parts.push('[Online]. Available: ' + link);
    
    return parts.join(' ');
  }

  // Chicago Author-Date format
  // Author, First. Year. "Title." Journal Volume: Pages. URL.
  function formatChicago(entry) {
    var parts = [];
    var author = formatAuthors(entry.author, 'chicago');
    var year = entry.year || '';
    var title = entry.title || '';
    var venue = entry.journal || entry.booktitle || '';
    var volume = entry.volume || '';
    var pages = entry.pages || '';
    var publisher = entry.publisher || '';
    var url = entry.url || '';
    var doi = entry.doi || '';
    
    // Author. Year.
    if (author) {
      parts.push(escapeHtml(author) + '. ' + escapeHtml(year) + '.');
    } else if (year) {
      parts.push(escapeHtml(year) + '.');
    }
    
    // "Title."
    if (title) {
      var type = entry._type || 'misc';
      if (type === 'book' || type === 'misc' || type === 'software') {
        parts.push('<em>' + escapeHtml(title) + '</em>.');
      } else {
        parts.push('"' + escapeHtml(title) + '."');
      }
    }
    
    // Journal volume: pages.
    if (venue) {
      var venueStr = '<em>' + escapeHtml(venue) + '</em>';
      if (volume) venueStr += ' ' + escapeHtml(volume);
      if (pages) venueStr += ': ' + escapeHtml(pages);
      parts.push(venueStr + '.');
    } else if (publisher) {
      parts.push(escapeHtml(publisher) + '.');
    }
    
    // URL
    var link = formatLink(url, doi);
    if (link) parts.push(link + '.');
    
    return parts.join(' ');
  }

  // Vancouver/Numeric format (commonly used in medical/scientific)
  // Author AA, Author BB. Title. Journal. Year;Volume:Pages. URL
  function formatVancouver(entry) {
    var parts = [];
    var author = formatAuthors(entry.author, 'vancouver');
    var year = entry.year || '';
    var title = entry.title || '';
    var venue = entry.journal || entry.booktitle || '';
    var volume = entry.volume || '';
    var pages = entry.pages || '';
    var publisher = entry.publisher || '';
    var url = entry.url || '';
    var doi = entry.doi || '';
    
    // Author.
    if (author) parts.push(escapeHtml(author) + '.');
    
    // Title.
    if (title) parts.push(escapeHtml(title) + '.');
    
    // Journal. Year;Volume:Pages.
    if (venue) {
      var venueStr = escapeHtml(venue) + '.';
      venueStr += ' ' + escapeHtml(year);
      if (volume) venueStr += ';' + escapeHtml(volume);
      if (pages) venueStr += ':' + escapeHtml(pages);
      parts.push(venueStr + '.');
    } else {
      if (publisher) parts.push(escapeHtml(publisher) + '.');
      if (year) parts.push(escapeHtml(year) + '.');
    }
    
    // URL
    var link = formatLink(url, doi);
    if (link) parts.push('Available from: ' + link);
    
    return parts.join(' ');
  }

  // Main formatter that dispatches to style-specific function
  function formatReference(entry, style) {
    if (!entry) return '';
    
    style = style || getCitationStyle();
    
    switch (style) {
      case 'ieee':
        return formatIEEE(entry);
      case 'chicago':
        return formatChicago(entry);
      case 'vancouver':
        return formatVancouver(entry);
      case 'apa':
      default:
        return formatAPA(entry);
    }
  }

  function renderInlineCitations(root, bibByKey) {
    var citeEls = Array.prototype.slice.call(root.querySelectorAll('cite[data-key]'));
    var order = [];
    var numberByKey = Object.create(null);

    function ensureNumber(key) {
      if (!Object.prototype.hasOwnProperty.call(numberByKey, key)) {
        numberByKey[key] = order.length + 1;
        order.push(key);
      }
      return numberByKey[key];
    }

    citeEls.forEach(function (el) {
      var keys = splitKeys(el.getAttribute('data-key'));
      if (!keys.length) return;

      var parts = keys.map(function (key) {
        if (!hasEntry(bibByKey, key)) {
          return '<span class="citation-missing">?</span>';
        }
        var num = ensureNumber(key);
        var refId = makeRefId(key);
        return (
          '<a href="#' +
          escapeHtml(refId) +
          '" class="citation-link" data-citation-key="' +
          escapeHtml(key) +
          '">' +
          String(num) +
          '</a>'
        );
      });

      el.innerHTML = '<span class="citation">[' + parts.join(', ') + ']</span>';
    });

    return order;
  }

  function renderInlinePlaceholders(root) {
    var citeEls = Array.prototype.slice.call(root.querySelectorAll('cite[data-key]'));
    citeEls.forEach(function (el) {
      var keys = splitKeys(el.getAttribute('data-key'));
      if (!keys.length) return;
      // Always show something even if BibTeX isn't available.
      el.innerHTML = '<span class="citation">[?]</span>';
    });
  }

  function renderReferences(root, bibByKey, usedOrder) {
    if (!usedOrder || !usedOrder.length) return;

    var existing = root.querySelector('[data-generated="references"]');
    if (existing) existing.remove();

    var style = getCitationStyle();

    var container = document.createElement('section');
    container.setAttribute('data-generated', 'references');
    container.setAttribute('data-citation-style', style);
    container.className = 'references-section';
    container.setAttribute('aria-labelledby', 'references-heading');

    var heading = document.createElement('h2');
    heading.id = 'references-heading';
    heading.textContent = 'References';
    container.appendChild(heading);

    var ol = document.createElement('ol');
    ol.className = 'references-list';
    ol.setAttribute('role', 'list');

    usedOrder.forEach(function (key) {
      var entry = getEntry(bibByKey, key);
      var li = document.createElement('li');
      li.id = makeRefId(key);
      li.className = 'bib-entry';
      li.setAttribute('data-citation-key', key);

      if (!entry) {
        li.innerHTML = escapeHtml(key);
        ol.appendChild(li);
        return;
      }

      li.innerHTML = formatReference(entry, style);
      ol.appendChild(li);
    });

    container.appendChild(ol);
    root.appendChild(container);
  }

  function main() {
    // Marker for debugging in production without relying on console.
    // Values: enabled | rendered | no-bib
    try {
      document.documentElement.setAttribute('data-citations', 'enabled');
    } catch (e) {
      // ignore
    }

    var root = getArticleRoot();
    if (!root) return;

    var bibEl = findBibliographyData(root);
    if (!bibEl) {
      renderInlinePlaceholders(root);
      try {
        document.documentElement.setAttribute('data-citations', 'no-bib');
      } catch (e) {
        // ignore
      }
      return;
    }

    var bibtex = String(bibEl.textContent || '').trim();
    if (!bibtex) {
      renderInlinePlaceholders(root);
      try {
        document.documentElement.setAttribute('data-citations', 'no-bib');
      } catch (e) {
        // ignore
      }
      return;
    }

    var bibByKey;
    try {
      bibByKey = parseBibTeX(bibtex);
    } catch (e) {
      renderInlinePlaceholders(root);
      return;
    }

    var usedOrder = renderInlineCitations(root, bibByKey);
    renderReferences(root, bibByKey, usedOrder);

    try {
      document.documentElement.setAttribute('data-citations', 'rendered');
    } catch (e) {
      // ignore
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }
})();
