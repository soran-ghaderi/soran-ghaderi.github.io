// Enhanced dark mode detection and application with toggle functionality
(function() {
  // Default to dark mode
  let darkMode = true;
  
  function applyDarkMode() {
    if (document.body) {
      document.body.classList.add("dark");
      document.body.classList.remove("light");
    }
    document.documentElement.classList.add("dark");
    document.documentElement.classList.remove("light");
    document.documentElement.style.setProperty('color-scheme', 'dark');
    document.documentElement.setAttribute('data-theme', 'dark');
    updateToggleIcon(true);
    localStorage.setItem('darkMode', 'true');
    darkMode = true;
    // Dispatch event for Shiki to re-highlight
    window.dispatchEvent(new CustomEvent('themechange', { detail: { dark: true } }));
  }

  function applyLightMode() {
    if (document.body) {
      document.body.classList.remove("dark");
      document.body.classList.add("light");
    }
    document.documentElement.classList.remove("dark");
    document.documentElement.classList.add("light");
    document.documentElement.style.setProperty('color-scheme', 'light');
    document.documentElement.setAttribute('data-theme', 'light');
    updateToggleIcon(false);
    localStorage.setItem('darkMode', 'false');
    darkMode = false;
    // Dispatch event for Shiki to re-highlight
    window.dispatchEvent(new CustomEvent('themechange', { detail: { dark: false } }));
  }
  
  function updateToggleIcon(isDark) {
    const icon = document.getElementById('theme-icon');
    if (icon) {
      // Show sun icon in dark mode (to switch to light), moon in light mode (to switch to dark)
      icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
      icon.setAttribute('title', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    }
  }
  
  function toggleDarkMode(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    console.log('Toggle clicked! Current darkMode:', darkMode);
    if (darkMode) {
      applyLightMode();
    } else {
      applyDarkMode();
    }
    console.log('After toggle, darkMode is now:', darkMode);
  }

  // Initialize theme based on localStorage or default to dark mode
  const savedTheme = localStorage.getItem('darkMode');
  if (savedTheme !== null) {
    darkMode = savedTheme === 'true';
  }
  
  // Apply initial theme to documentElement immediately (before body exists)
  if (darkMode) {
    document.documentElement.classList.add("dark");
    document.documentElement.style.setProperty('color-scheme', 'dark');
  } else {
    document.documentElement.classList.add("light");
    document.documentElement.style.setProperty('color-scheme', 'light');
  }

  // Function to attach event listeners
  function attachEventListeners() {
    const toggleButton = document.getElementById('theme-toggle');
    if (toggleButton) {
      // Clone and replace to remove all existing listeners
      const newButton = toggleButton.cloneNode(true);
      toggleButton.parentNode.replaceChild(newButton, toggleButton);
      
      // Add click listener to the new button
      newButton.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        toggleDarkMode(e);
      });
      
      // Add keyboard support
      newButton.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleDarkMode(e);
        }
      });
      
      console.log('Dark mode toggle initialized successfully');
      return true;
    } else {
      console.warn('Theme toggle button not found');
      return false;
    }
  }
  
  // Apply theme to body when DOM is ready
  function initTheme() {
    if (darkMode) {
      applyDarkMode();
    } else {
      applyLightMode();
    }
    attachEventListeners();
  }

  // Multiple ways to ensure DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      initTheme();
      initializeNavigation();
    });
  } else {
    // DOM is already loaded
    initTheme();
    initializeNavigation();
  }

  // Fallback: Try again after a short delay if button wasn't found
  setTimeout(function() {
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      console.log('Fallback: Re-attaching theme toggle...');
      attachEventListeners();
    }
  }, 500);

  // Navigation functionality
  function initializeNavigation() {
    // Handle active menu states
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.navbar-nav .nav-link');
    
    navLinks.forEach(link => {
      const linkPath = new URL(link.href).pathname;
      if (linkPath === currentPath || (currentPath === '/' && linkPath === '/')) {
        link.parentElement.classList.add('active');
      }
    });
    
    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      });
    });
    
    // Mobile menu auto-close
    const navbarToggle = document.querySelector('.navbar-toggle');
    const navbarCollapse = document.querySelector('.navbar-collapse');
    const mobileNavLinks = document.querySelectorAll('.navbar-nav .nav-link');
    
    if (navbarToggle && navbarCollapse) {
      mobileNavLinks.forEach(link => {
        link.addEventListener('click', () => {
          if (navbarCollapse.classList.contains('in') || navbarCollapse.classList.contains('show')) {
            navbarToggle.click();
          }
        });
      });
    }
    
    // Enhanced mobile menu interactions
    if (navbarToggle) {
      navbarToggle.addEventListener('click', function() {
        // Add smooth animation class
        navbarCollapse.style.transition = 'height 0.3s ease-in-out';
      });
    }
  }

  // Listen for system preference changes (optional)
  if (window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', function(e) {
      // Only apply system preference if user hasn't manually set a preference
      if (!localStorage.getItem('darkMode')) {
        darkMode = e.matches;
        if (darkMode) {
          applyDarkMode();
        } else {
          applyLightMode();
        }
      }
    });
  }
  
  // Expose functions globally for debugging
  window.toggleDarkMode = toggleDarkMode;
  window.applyDarkMode = applyDarkMode;
  window.applyLightMode = applyLightMode;
})();

// =====================================================
// CODE BLOCK ENHANCEMENTS
// Copy button on hover, line numbers (VS Code style)
// =====================================================
(function() {
  function initCodeBlocks() {
    // Find all code block containers (highlighter-rouge wraps .highlight)
    const codeContainers = document.querySelectorAll('.highlighter-rouge, .highlight:not(.highlighter-rouge .highlight), pre.highlight');
    
    console.log('Found code blocks:', codeContainers.length);
    
    codeContainers.forEach(function(container) {
      // Skip if already wrapped
      if (container.closest('.code-block-wrapper')) {
        return;
      }
      
      // Skip line number pre elements
      if (container.classList.contains('lineno') || container.tagName === 'PRE' && container.closest('.rouge-gutter')) {
        return;
      }
      
      // Get the actual highlight block
      const block = container.classList.contains('highlight') ? container : container.querySelector('.highlight') || container;
      
      // Create wrapper
      const wrapper = document.createElement('div');
      wrapper.className = 'code-block-wrapper';
      
      // Create copy button
      const copyButton = document.createElement('button');
      copyButton.className = 'copy-button';
      copyButton.textContent = 'Copy';
      copyButton.setAttribute('aria-label', 'Copy code to clipboard');
      copyButton.setAttribute('type', 'button');
      
      // Copy functionality
      copyButton.addEventListener('click', function() {
        const codeElement = container.querySelector('code') || container.querySelector('pre') || container;
        let textToCopy = '';
        
        // Get text content, excluding line numbers
        if (container.querySelector('td.rouge-code')) {
          // Rouge table format
          textToCopy = container.querySelector('td.rouge-code').textContent;
        } else if (codeElement.textContent) {
          textToCopy = codeElement.textContent;
        }
        
        // Clean up the text (remove trailing whitespace per line, trim)
        textToCopy = textToCopy.split('\n').map(line => line.trimEnd()).join('\n').trim();
        
        navigator.clipboard.writeText(textToCopy).then(function() {
          copyButton.textContent = 'Copied!';
          copyButton.classList.add('copied');
          
          setTimeout(function() {
            copyButton.textContent = 'Copy';
            copyButton.classList.remove('copied');
          }, 2000);
        }).catch(function(err) {
          console.error('Failed to copy:', err);
          copyButton.textContent = 'Error';
          setTimeout(function() {
            copyButton.textContent = 'Copy';
          }, 2000);
        });
      });
      
      // Wrap the container
      container.parentNode.insertBefore(wrapper, container);
      wrapper.appendChild(copyButton);
      wrapper.appendChild(container);
    });
  }
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCodeBlocks);
  } else {
    // DOM already loaded, init immediately
    initCodeBlocks();
  }
  
  // Also run after window load in case of late-loading scripts
  window.addEventListener('load', function() {
    // Small delay to ensure everything is rendered
    setTimeout(initCodeBlocks, 100);
  });
})();