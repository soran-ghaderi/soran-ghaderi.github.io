/**
 * Academic Numbering System for Jekyll Blog Posts (GitHub Pages Compatible)
 * 
 * This script provides LaTeX-like automatic numbering and cross-referencing
 * for figures, tables, equations, and algorithms using pure HTML + JavaScript.
 * NO Jekyll plugins required - works on GitHub Pages!
 * 
 * Usage in Markdown posts:
 * 
 * 1. Figures:
 *    <figure class="academic-figure" id="fig-example">
 *      <img src="..." alt="...">
 *      <figcaption data-caption="An example figure"></figcaption>
 *    </figure>
 *    
 *    Reference: <a href="#fig-example" class="ref"></a>  -> "Figure 1"
 * 
 * 2. Tables:
 *    <div class="academic-table" id="tab-example" data-caption="Table caption">
 *      | Header | Data |
 *      |--------|------|
 *      | A      | B    |
 *    </div>
 *    
 *    Reference: <a href="#tab-example" class="ref"></a>  -> "Table 1"
 * 
 * 3. Equations (labeled):
 *    <div class="academic-equation" id="eq-energy">
 *      $$E = mc^2$$
 *    </div>
 *    
 *    Reference: <a href="#eq-energy" class="ref"></a> -> "Eq. 1"
 *    Or: <a href="#eq-energy" class="eqref"></a> -> "(1)"
 * 
 * 4. Algorithms:
 *    <div class="academic-algorithm" id="alg-sort" data-caption="Sorting Algorithm">
 *      ...pseudocode...
 *    </div>
 *    
 *    Reference: <a href="#alg-sort" class="ref"></a>  -> "Algorithm 1"
 */

(function() {
  'use strict';

  // ============================================================
  // Label Registry and Counters
  // ============================================================
  
  const labelRegistry = {};
  const counters = {
    figure: 0,
    table: 0,
    equation: 0,
    algorithm: 0
  };
  
  const prefixes = {
    figure: 'Figure',
    table: 'Table',
    equation: 'Eq.',
    algorithm: 'Algorithm'
  };

  /**
   * Reset counters for fresh processing
   */
  function resetCounters() {
    counters.figure = 0;
    counters.table = 0;
    counters.equation = 0;
    counters.algorithm = 0;
    Object.keys(labelRegistry).forEach(key => delete labelRegistry[key]);
  }

  /**
   * Process figures - add numbering and format captions
   */
  function processFigures() {
    const figures = document.querySelectorAll('.academic-figure');
    figures.forEach(fig => {
      counters.figure++;
      const num = counters.figure;
      
      fig.setAttribute('data-figure-number', num);
      
      if (fig.id) {
        labelRegistry[fig.id] = { type: 'figure', number: num, prefix: prefixes.figure };
      }
      
      // Format caption
      const figcaption = fig.querySelector('figcaption');
      if (figcaption) {
        const captionText = figcaption.getAttribute('data-caption') || figcaption.textContent;
        if (captionText && !figcaption.classList.contains('processed')) {
          figcaption.innerHTML = '<strong>Figure ' + num + ':</strong> ' + captionText;
          figcaption.classList.add('figure-caption', 'processed');
        }
      }
    });
  }

  /**
   * Process tables - add numbering and format captions
   */
  function processTables() {
    const tables = document.querySelectorAll('.academic-table');
    tables.forEach(tbl => {
      counters.table++;
      const num = counters.table;
      
      tbl.setAttribute('data-table-number', num);
      
      if (tbl.id) {
        labelRegistry[tbl.id] = { type: 'table', number: num, prefix: prefixes.table };
      }
      
      // Add caption if data-caption is present and not already processed
      const caption = tbl.getAttribute('data-caption');
      if (caption && !tbl.querySelector('.table-caption')) {
        const captionDiv = document.createElement('div');
        captionDiv.className = 'table-caption';
        captionDiv.innerHTML = '<strong>Table ' + num + ':</strong> ' + caption;
        tbl.insertBefore(captionDiv, tbl.firstChild);
      }
    });
  }

  /**
   * Process equations - add numbering
   */
  function processEquations() {
    const equations = document.querySelectorAll('.academic-equation');
    equations.forEach(eq => {
      counters.equation++;
      const num = counters.equation;
      
      eq.setAttribute('data-equation-number', num);
      
      if (eq.id) {
        labelRegistry[eq.id] = { type: 'equation', number: num, prefix: prefixes.equation };
      }
      
      // Add equation number if not already present
      if (!eq.querySelector('.equation-number')) {
        const numSpan = document.createElement('span');
        numSpan.className = 'equation-number';
        numSpan.textContent = '(' + num + ')';
        eq.appendChild(numSpan);
      }
    });
  }

  /**
   * Process algorithms - add numbering and format captions
   */
  function processAlgorithms() {
    const algorithms = document.querySelectorAll('.academic-algorithm');
    algorithms.forEach(alg => {
      counters.algorithm++;
      const num = counters.algorithm;
      
      alg.setAttribute('data-algorithm-number', num);
      
      if (alg.id) {
        labelRegistry[alg.id] = { type: 'algorithm', number: num, prefix: prefixes.algorithm };
      }
      
      // Add caption if data-caption is present and not already processed
      const caption = alg.getAttribute('data-caption');
      if (caption && !alg.querySelector('.algorithm-caption')) {
        const captionDiv = document.createElement('div');
        captionDiv.className = 'algorithm-caption';
        captionDiv.innerHTML = '<strong>Algorithm ' + num + ':</strong> ' + caption;
        alg.insertBefore(captionDiv, alg.firstChild);
      }
    });
  }

  /**
   * Resolve all cross-references
   */
  function resolveReferences() {
    // Process standard references: <a href="#id" class="ref"></a>
    document.querySelectorAll('a.ref[href^="#"]').forEach(el => {
      const refId = el.getAttribute('href').substring(1); // Remove #
      const label = labelRegistry[refId];
      
      if (label) {
        el.textContent = label.prefix + ' ' + label.number;
        el.classList.add('ref-link', 'ref-' + label.type);
      } else {
        el.textContent = '??';
        el.classList.add('ref-error');
        console.warn('Academic numbering: Unknown reference "' + refId + '"');
      }
    });
    
    // Process equation references: <a href="#id" class="eqref"></a> -> "(1)"
    document.querySelectorAll('a.eqref[href^="#"]').forEach(el => {
      const refId = el.getAttribute('href').substring(1);
      const label = labelRegistry[refId];
      
      if (label && label.type === 'equation') {
        el.textContent = '(' + label.number + ')';
        el.classList.add('eqref-link');
      } else {
        el.textContent = '(??)';
        el.classList.add('ref-error');
        console.warn('Academic numbering: Unknown equation reference "' + refId + '"');
      }
    });
  }

  // ============================================================
  // Initialization
  // ============================================================
  
  function initAcademicNumbering() {
    resetCounters();
    processFigures();
    processTables();
    processEquations();
    processAlgorithms();
    resolveReferences();
  }

  // Run after DOM is ready
  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  onReady(function() {
    // Wait for MathJax to finish if present
    if (window.MathJax && window.MathJax.startup && window.MathJax.startup.promise) {
      window.MathJax.startup.promise.then(function() {
        setTimeout(initAcademicNumbering, 50);
      });
    } else if (window.MathJax && window.MathJax.Hub) {
      // MathJax 2.x
      window.MathJax.Hub.Queue(function() {
        setTimeout(initAcademicNumbering, 50);
      });
    } else {
      // No MathJax or MathJax not loaded yet
      setTimeout(initAcademicNumbering, 100);
    }
  });

  // Expose for manual re-initialization
  window.academicNumbering = {
    init: initAcademicNumbering,
    registry: labelRegistry,
    counters: counters
  };

})();
