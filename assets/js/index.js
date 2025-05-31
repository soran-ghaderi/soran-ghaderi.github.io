// Enhanced dark mode detection and application with toggle functionality
(function() {
  let darkMode = true; // Set dark mode as default
  
  function applyDarkMode() {
    document.body.classList.add("dark");
    // Ensure all elements properly inherit dark mode styles
    document.documentElement.style.setProperty('color-scheme', 'dark');
    updateToggleIcon(true);
    localStorage.setItem('darkMode', 'true');
  }

  function applyLightMode() {
    document.body.classList.remove("dark");
    document.documentElement.style.setProperty('color-scheme', 'light');
    updateToggleIcon(false);
    localStorage.setItem('darkMode', 'false');
  }
  
  function updateToggleIcon(isDark) {
    const icon = document.getElementById('theme-icon');
    if (icon) {
      icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
      icon.setAttribute('title', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    }
  }
  
  function toggleDarkMode() {
    darkMode = !darkMode;
    if (darkMode) {
      applyDarkMode();
    } else {
      applyLightMode();
    }
  }

  // Initialize theme based on localStorage or default to dark mode
  const savedTheme = localStorage.getItem('darkMode');
  if (savedTheme !== null) {
    darkMode = savedTheme === 'true';
  }
  
  // Apply initial theme immediately
  if (darkMode) {
    applyDarkMode();
  } else {
    applyLightMode();
  }

  // Function to attach event listeners
  function attachEventListeners() {
    const toggleButton = document.getElementById('theme-toggle');
    if (toggleButton) {
      // Remove any existing listeners to prevent duplicates
      toggleButton.removeEventListener('click', toggleDarkMode);
      toggleButton.addEventListener('click', toggleDarkMode);
      
      // Add keyboard support
      toggleButton.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleDarkMode();
        }
      });
      
      console.log('Dark mode toggle initialized successfully');
    } else {
      console.warn('Theme toggle button not found');
    }
  }

  // Multiple ways to ensure DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      attachEventListeners();
      initializeNavigation();
    });
  } else {
    // DOM is already loaded
    attachEventListeners();
    initializeNavigation();
  }

  // Fallback: Try again after a short delay if button wasn't found
  setTimeout(function() {
    if (!document.getElementById('theme-toggle')) {
      console.log('Retrying theme toggle initialization...');
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
