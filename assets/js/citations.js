/**
 * LaTeX-like Citation System for Jekyll Blog Posts
 * 
 * This script provides a citation/reference system similar to LaTeX/BibTeX.
 * 
 * Usage in Markdown posts:
 * 
 * 1. Inline citations: {% cite key %} or \cite{key} - renders as [1], [2], etc.
 *    Multiple citations: {% cite key1, key2 %} or \cite{key1,key2} - renders as [1, 2]
 * 
 * 2. Bibliography section at the end of the post:
 *    {% bibliography %}
 *    @article{einstein1905,
 *      author = {Albert Einstein},
 *      title = {On the Electrodynamics of Moving Bodies},
 *      journal = {Annalen der Physik},
 *      year = {1905},
 *      volume = {17},
 *      pages = {891--921},
 *      doi = {10.1002/andp.19053221004},
 *      url = {https://doi.org/10.1002/andp.19053221004}
 *    }
 *    @book{knuth1997,
 *      author = {Donald E. Knuth},
 *      title = {The Art of Computer Programming},
 *      publisher = {Addison-Wesley},
 *      year = {1997},
 *      volume = {1},
 *      edition = {3rd}
 *    }
 *    {% endbibliography %}
 * 
 * The bibliography section is parsed but NOT displayed as raw text.
 * A formatted "References" section is automatically generated at the bottom.
 */

(function() {
  'use strict';

  // ============================================================
  // BibTeX Parser
  // ============================================================
  
  /**
   * Parse a BibTeX entry string into a structured object
   * @param {string} bibtex - Raw BibTeX string
   * @returns {Object} Map of citation keys to entry objects
   */
  function parseBibTeX(bibtex) {
    const entries = {};
    
    // Match @type{key, ... }
    // This regex handles nested braces properly
    const entryRegex = /@(\w+)\s*\{\s*([^,\s]+)\s*,\s*([\s\S]*?)\n\s*\}/g;
    
    let match;
    while ((match = entryRegex.exec(bibtex)) !== null) {
      const type = match[1].toLowerCase();
      const key = match[2].trim();
      const fieldsStr = match[3];
      
      const entry = {
        type: type,
        key: key,
        fields: {}
      };
      
      // Parse individual fields: field = {value} or field = "value" or field = number
      const fieldRegex = /(\w+)\s*=\s*(?:\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}|"([^"]*)"|(\d+))/g;
      
      let fieldMatch;
      while ((fieldMatch = fieldRegex.exec(fieldsStr)) !== null) {
        const fieldName = fieldMatch[1].toLowerCase();
        const fieldValue = (fieldMatch[2] || fieldMatch[3] || fieldMatch[4] || '').trim();
        entry.fields[fieldName] = fieldValue;
      }
      
      entries[key] = entry;
    }
    
    return entries;
  }

  // ============================================================
  // Citation Formatting (APA-like style)
  // ============================================================
  
  /**
   * Format author names from BibTeX format to readable format
   * @param {string} authors - BibTeX author string (e.g., "Last, First and Last2, First2")
   * @returns {string} Formatted author string
   */
  function formatAuthors(authors) {
    if (!authors) return '';
    
    // Split by " and " (BibTeX convention)
    const authorList = authors.split(/\s+and\s+/i);
    
    const formatted = authorList.map(author => {
      author = author.trim();
      // Handle "Last, First" format
      if (author.includes(',')) {
        const parts = author.split(',').map(p => p.trim());
        const lastName = parts[0];
        const firstName = parts[1] || '';
        // Get initials from first name
        const initials = firstName.split(/\s+/)
          .map(n => n.charAt(0).toUpperCase() + '.')
          .join(' ');
        return `${lastName}, ${initials}`;
      }
      // Handle "First Last" format
      const parts = author.split(/\s+/);
      if (parts.length > 1) {
        const lastName = parts[parts.length - 1];
        const firstNames = parts.slice(0, -1);
        const initials = firstNames.map(n => n.charAt(0).toUpperCase() + '.').join(' ');
        return `${lastName}, ${initials}`;
      }
      return author;
    });
    
    if (formatted.length === 1) {
      return formatted[0];
    } else if (formatted.length === 2) {
      return `${formatted[0]} & ${formatted[1]}`;
    } else {
      return formatted.slice(0, -1).join(', ') + ', & ' + formatted[formatted.length - 1];
    }
  }

  /**
   * Format a single bibliography entry
   * @param {Object} entry - Parsed BibTeX entry
   * @param {number} index - Citation number (1-based)
   * @returns {string} HTML string for the bibliography entry
   */
  function formatBibEntry(entry, index) {
    const f = entry.fields;
    let html = '';
    
    // Authors
    const authors = formatAuthors(f.author);
    if (authors) {
      html += `<span class="bib-authors">${authors}</span> `;
    }
    
    // Year
    if (f.year) {
      html += `<span class="bib-year">(${f.year}).</span> `;
    }
    
    // Title
    if (f.title) {
      // Remove braces used for capitalization preservation in BibTeX
      const title = f.title.replace(/[{}]/g, '');
      html += `<span class="bib-title">${title}.</span> `;
    }
    
    // Type-specific formatting
    switch (entry.type) {
      case 'article':
        if (f.journal) {
          html += `<em class="bib-journal">${f.journal}</em>`;
          if (f.volume) {
            html += `, <span class="bib-volume">${f.volume}</span>`;
            if (f.number) {
              html += `(${f.number})`;
            }
          }
          if (f.pages) {
            html += `, ${f.pages.replace('--', '–')}`;
          }
          html += '. ';
        }
        break;
        
      case 'inproceedings':
      case 'conference':
        if (f.booktitle) {
          html += `In <em class="bib-booktitle">${f.booktitle}</em>`;
          if (f.pages) {
            html += ` (pp. ${f.pages.replace('--', '–')})`;
          }
          html += '. ';
          if (f.publisher) {
            html += `${f.publisher}. `;
          }
        }
        break;
        
      case 'book':
        if (f.edition) {
          html += `(${f.edition} ed.). `;
        }
        if (f.publisher) {
          html += `${f.publisher}. `;
        }
        break;
        
      case 'phdthesis':
      case 'mastersthesis':
        const thesisType = entry.type === 'phdthesis' ? 'Doctoral dissertation' : 'Master\'s thesis';
        html += `<em>${thesisType}</em>`;
        if (f.school) {
          html += `, ${f.school}`;
        }
        html += '. ';
        break;
        
      case 'techreport':
        if (f.institution) {
          html += `${f.institution}. `;
        }
        if (f.number) {
          html += `(Technical Report No. ${f.number}). `;
        }
        break;
        
      case 'misc':
      case 'online':
        if (f.howpublished) {
          html += `${f.howpublished}. `;
        }
        if (f.note) {
          html += `${f.note}. `;
        }
        break;
        
      default:
        // Generic fallback
        if (f.publisher) {
          html += `${f.publisher}. `;
        }
    }
    
    // DOI or URL
    if (f.doi) {
      const doiUrl = f.doi.startsWith('http') ? f.doi : `https://doi.org/${f.doi}`;
      html += `<a href="${doiUrl}" class="bib-doi" target="_blank" rel="noopener">https://doi.org/${f.doi.replace(/^https?:\/\/doi\.org\//, '')}</a>`;
    } else if (f.url) {
      html += `<a href="${f.url}" class="bib-url" target="_blank" rel="noopener">${f.url}</a>`;
    }
    
    // arXiv
    if (f.eprint && f.archiveprefix && f.archiveprefix.toLowerCase() === 'arxiv') {
      html += ` <a href="https://arxiv.org/abs/${f.eprint}" class="bib-arxiv" target="_blank" rel="noopener">arXiv:${f.eprint}</a>`;
    }
    
    return `<li id="ref-${entry.key}" class="bib-entry" data-citation-key="${entry.key}">
      <span class="bib-number">[${index}]</span>
      <span class="bib-content">${html}</span>
    </li>`;
  }

  // ============================================================
  // Main Processing Function
  // ============================================================
  
  /**
   * Process citations in the document
   */
  function processCitations() {
    const articlePost = document.querySelector('.article-post');
    if (!articlePost) return;
    
    // Find bibliography block
    // Look for: {% bibliography %} ... {% endbibliography %}
    // Or HTML comments: <!-- bibliography --> ... <!-- endbibliography -->
    // Or custom div: <div class="bibliography-source"> ... </div>
    
    let bibContent = '';
    let bibElement = null;
    
    // Method 1: Look for <div class="bibliography-source">
    bibElement = articlePost.querySelector('.bibliography-source');
    if (bibElement) {
      bibContent = bibElement.textContent || bibElement.innerText;
      bibElement.style.display = 'none';
    }
    
    // Method 2: Look for <script type="text/bibliography">
    if (!bibContent) {
      const bibScript = articlePost.querySelector('script[type="text/bibliography"]');
      if (bibScript) {
        bibContent = bibScript.textContent;
        bibElement = bibScript;
      }
    }
    
    // Method 3: Look for HTML pattern {% bibliography %} ... {% endbibliography %}
    // These become text nodes after Jekyll processing
    if (!bibContent) {
      const html = articlePost.innerHTML;
      const bibMatch = html.match(/\{%\s*bibliography\s*%\}([\s\S]*?)\{%\s*endbibliography\s*%\}/);
      if (bibMatch) {
        bibContent = bibMatch[1];
        // Remove the bibliography block from display
        articlePost.innerHTML = html.replace(
          /\{%\s*bibliography\s*%\}[\s\S]*?\{%\s*endbibliography\s*%\}/,
          '<div class="bibliography-placeholder" style="display:none;"></div>'
        );
      }
    }
    
    if (!bibContent) {
      // No bibliography found, nothing to process
      return;
    }
    
    // Parse BibTeX entries
    const entries = parseBibTeX(bibContent);
    const entryKeys = Object.keys(entries);
    
    if (entryKeys.length === 0) {
      console.warn('Citations: No valid BibTeX entries found in bibliography');
      return;
    }
    
    // Track which citations are actually used and their order
    const citedKeys = [];
    const keyToNumber = {};
    
    /**
     * Process citation keys and return the replacement HTML
     */
    function processCiteKeys(keys) {
      const numbers = [];
      
      keys.forEach(key => {
        if (!entries[key]) {
          console.warn(`Citations: Unknown citation key "${key}"`);
          numbers.push('?');
          return;
        }
        
        if (!keyToNumber[key]) {
          citedKeys.push(key);
          keyToNumber[key] = citedKeys.length;
        }
        numbers.push(keyToNumber[key]);
      });
      
      // Generate the citation link(s)
      const links = keys.map((key, i) => {
        const num = numbers[i];
        if (num === '?') {
          return `<span class="citation-missing">[?]</span>`;
        }
        return `<a href="#ref-${key}" class="citation-link" data-citation-key="${key}">${num}</a>`;
      });
      
      return `<span class="citation">[${links.join(', ')}]</span>`;
    }
    
    /**
     * Process a regex citation match and return the replacement HTML
     */
    function processCiteMatch(match, keysStr) {
      const keys = keysStr.split(/\s*,\s*/).map(k => k.trim()).filter(k => k);
      return processCiteKeys(keys);
    }
    
    // First, process placeholder spans created by Jekyll plugin
    // These have the format: <span class="cite-placeholder" data-cite-keys="key1, key2"></span>
    const placeholders = articlePost.querySelectorAll('.cite-placeholder');
    placeholders.forEach(placeholder => {
      const keysAttr = placeholder.getAttribute('data-cite-keys');
      if (keysAttr) {
        const keys = keysAttr.split(/\s*,\s*/).map(k => k.trim()).filter(k => k);
        const citationHtml = processCiteKeys(keys);
        const temp = document.createElement('span');
        temp.innerHTML = citationHtml;
        placeholder.replaceWith(temp.firstElementChild);
      }
    });
    
    // Find all citations in the text and replace them
    // Patterns: {% cite key %}, {% cite key1, key2 %}, \cite{key}, \cite{key1,key2}
    let content = articlePost.innerHTML;
    
    // Pattern for {% cite ... %}
    const jsCitePattern = /\{%\s*cite\s+([\w,\s-]+)\s*%\}/g;
    // Pattern for \cite{...} (may be escaped as \\cite or rendered differently)
    const latexCitePattern = /\\cite\{([\w,\s-]+)\}/g;
    // Pattern for escaped versions that might appear
    const escapedCitePattern = /\\\\cite\{([\w,\s-]+)\}/g;
    
    // Replace all citation patterns
    content = content.replace(jsCitePattern, processCiteMatch);
    content = content.replace(latexCitePattern, processCiteMatch);
    content = content.replace(escapedCitePattern, processCiteMatch);
    
    // Also handle plain text that might have been rendered
    // Look for [cite:key] or [@key] patterns (alternative syntax)
    const altCitePattern = /\[(?:cite:|@)([\w,\s-]+)\]/g;
    content = content.replace(altCitePattern, processCiteMatch);
    
    articlePost.innerHTML = content;
    
    // Generate the references section if we have citations
    if (citedKeys.length > 0) {
      const referencesHtml = generateReferencesSection(entries, citedKeys, keyToNumber);
      
      // Find where to insert (before post footer or at end of article-post)
      const postFooter = document.querySelector('.post-footer');
      const insertTarget = postFooter || articlePost;
      
      const refsDiv = document.createElement('div');
      refsDiv.innerHTML = referencesHtml;
      
      if (postFooter) {
        postFooter.parentNode.insertBefore(refsDiv.firstElementChild, postFooter);
      } else {
        articlePost.appendChild(refsDiv.firstElementChild);
      }
      
      // Add click handlers for smooth scrolling to references
      document.querySelectorAll('.citation-link').forEach(link => {
        link.addEventListener('click', function(e) {
          e.preventDefault();
          const targetId = this.getAttribute('href').substring(1);
          const target = document.getElementById(targetId);
          if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Highlight the reference briefly
            target.classList.add('bib-highlight');
            setTimeout(() => target.classList.remove('bib-highlight'), 2000);
          }
        });
      });
      
      // Add back-links from references to citations
      document.querySelectorAll('.bib-entry').forEach(entry => {
        const key = entry.dataset.citationKey;
        entry.addEventListener('click', function(e) {
          if (e.target.tagName === 'A') return; // Don't interfere with actual links
          
          // Find first citation of this reference
          const citation = document.querySelector(`.citation-link[data-citation-key="${key}"]`);
          if (citation) {
            citation.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Highlight the citation briefly
            const parent = citation.closest('.citation');
            if (parent) {
              parent.classList.add('citation-highlight');
              setTimeout(() => parent.classList.remove('citation-highlight'), 2000);
            }
          }
        });
      });
    }
  }

  /**
   * Generate the formatted references section HTML
   */
  function generateReferencesSection(entries, citedKeys, keyToNumber) {
    let html = `
      <section class="references-section" id="references">
        <h2 class="references-title">References</h2>
        <ol class="references-list">
    `;
    
    // Output in citation order
    citedKeys.forEach((key, index) => {
      const entry = entries[key];
      if (entry) {
        html += formatBibEntry(entry, index + 1);
      }
    });
    
    html += `
        </ol>
      </section>
    `;
    
    return html;
  }

  // ============================================================
  // Initialize when DOM is ready
  // ============================================================
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', processCitations);
  } else {
    // Small delay to ensure other scripts (like Shiki) have processed
    setTimeout(processCitations, 100);
  }
  
  // Expose for manual re-processing if needed
  window.processCitations = processCitations;
  window.parseBibTeX = parseBibTeX;
  
})();
