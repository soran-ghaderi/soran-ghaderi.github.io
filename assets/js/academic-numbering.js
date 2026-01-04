/**
 * Academic Numbering System for Jekyll Blog Posts
 * 
 * This script provides LaTeX-like automatic numbering and cross-referencing
 * for figures, tables, equations, and algorithms.
 * 
 * Works with the academic_numbering.rb Jekyll plugin.
 * 
 * Usage in Markdown posts:
 * 
 * 1. Figures:
 *    {% figure id:fig-example caption:"An example figure" %}
 *      <img src="..." alt="...">
 *    {% endfigure %}
 *    
 *    Reference: {% ref fig-example %}  -> "Figure 1"
 * 
 * 2. Tables:
 *    {% table id:tab-example caption:"An example table" %}
 *      | Header | Data |
 *      |--------|------|
 *      | A      | B    |
 *    {% endtable %}
 *    
 *    Reference: {% ref tab-example %}  -> "Table 1"
 * 
 * 3. Equations (labeled):
 *    {% equation id:eq-energy %}
 *      E = mc^2
 *    {% endequation %}
 *    
 *    Reference: {% ref eq-energy %} -> "Eq. 1"
 *    Or: {% eqref eq-energy %} -> "(1)"
 * 
 * 4. Algorithms:
 *    {% algorithm id:alg-sort caption:"Sorting Algorithm" %}
 *      ...pseudocode...
 *    {% endalgorithm %}
 *    
 *    Reference: {% ref alg-sort %}  -> "Algorithm 1"
 */

(function() {
  'use strict';

  // ============================================================
  // Label Registry
  // ============================================================
  
  const labelRegistry = {};
  
  /**
   * Scan the document for numbered elements and build the registry
   */
  function buildLabelRegistry() {
    // Clear existing registry
    Object.keys(labelRegistry).forEach(key => delete labelRegistry[key]);
    
    // Scan figures
    document.querySelectorAll('.academic-figure[id]').forEach(el => {
      const id = el.id;
      const number = el.dataset.figureNumber || '?';
      labelRegistry[id] = { type: 'figure', number: number, prefix: 'Figure' };
    });
    
    // Scan tables
    document.querySelectorAll('.academic-table[id]').forEach(el => {
      const id = el.id;
      const number = el.dataset.tableNumber || '?';
      labelRegistry[id] = { type: 'table', number: number, prefix: 'Table' };
    });
    
    // Scan equations
    document.querySelectorAll('.academic-equation[id]').forEach(el => {
      const id = el.id;
      const number = el.dataset.equationNumber || '?';
      labelRegistry[id] = { type: 'equation', number: number, prefix: 'Eq.' };
    });
    
    // Scan algorithms
    document.querySelectorAll('.academic-algorithm[id]').forEach(el => {
      const id = el.id;
      const number = el.dataset.algorithmNumber || '?';
      labelRegistry[id] = { type: 'algorithm', number: number, prefix: 'Algorithm' };
    });
  }

  /**
   * Resolve all reference placeholders with actual labels
   */
  function resolveReferences() {
    // Resolve {% ref id %} placeholders
    document.querySelectorAll('.ref-placeholder').forEach(el => {
      const refId = el.dataset.refId;
      const label = labelRegistry[refId];
      
      if (label) {
        el.textContent = `${label.prefix} ${label.number}`;
        el.classList.remove('ref-placeholder');
        el.classList.add('ref-link', `ref-${label.type}`);
      } else {
        el.textContent = '??';
        el.classList.add('ref-error');
        console.warn(`Academic numbering: Unknown reference "${refId}"`);
      }
    });
    
    // Resolve {% eqref id %} placeholders (equation references as just the number)
    document.querySelectorAll('.eqref-placeholder').forEach(el => {
      const refId = el.dataset.refId;
      const label = labelRegistry[refId];
      
      if (label && label.type === 'equation') {
        el.textContent = `(${label.number})`;
        el.classList.remove('eqref-placeholder');
        el.classList.add('eqref-link');
      } else {
        el.textContent = '(??)';
        el.classList.add('ref-error');
        console.warn(`Academic numbering: Unknown equation reference "${refId}"`);
      }
    });
  }

  // ============================================================
  // Initialization
  // ============================================================
  
  function initAcademicNumbering() {
    buildLabelRegistry();
    resolveReferences();
  }

  // Run after DOM is ready and MathJax has processed (if present)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      // Wait a bit for MathJax to finish
      setTimeout(initAcademicNumbering, 100);
    });
  } else {
    setTimeout(initAcademicNumbering, 100);
  }

  // Also run after MathJax finishes typesetting
  if (window.MathJax && window.MathJax.startup) {
    window.MathJax.startup.promise.then(initAcademicNumbering);
  }

  // Expose for manual re-initialization
  window.academicNumbering = {
    init: initAcademicNumbering,
    registry: labelRegistry
  };

})();
