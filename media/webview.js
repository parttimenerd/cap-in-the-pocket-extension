(function() {
  // Acquire VS Code API
  const vscode = acquireVsCodeApi();
  
  // DOM elements
  const restartButton = document.getElementById('restartButton');
  const recompileButton = document.getElementById('recompileButton');
  const output = document.getElementById('output');
  const logo = document.getElementById('sapLogo');
  const bubbleContainer = document.getElementById('bubbleContainer');
  
  // State variables
  let revealed = false;
  let bubbleInterval;
  let hideLogoTimer;
  let messageCount = 0;
  const maxMessages = typeof maxMessageLimit !== 'undefined' ? maxMessageLimit : 10000; // Set from the extension or default

  // Initialize button event listeners
  function initButtons() {
    // Main action buttons
    restartButton.onclick = () => {
      vscode.postMessage({ command: 'restart' });
    };

    recompileButton.onclick = () => {
      vscode.postMessage({ command: 'recompile' });
    };

    // URL buttons
    document.querySelectorAll('.url-button').forEach(attachUrlButtonHandler);
  }

  function attachUrlButtonHandler(btn) {
    btn.addEventListener('click', () => {
      const url = btn.getAttribute('data-url');
      vscode.postMessage({ command: 'openUrl', url });
    });
  }

  // Logo animation functions
  logo.addEventListener('click', () => {
    revealed = !revealed;

    // Clear any existing timer
    if (hideLogoTimer) {
      clearTimeout(hideLogoTimer);
      hideLogoTimer = null;
    }

    if (revealed) {
      logo.classList.add('revealed');
      startBubbles();

      // Set timer to auto-hide after 5 seconds
      hideLogoTimer = setTimeout(() => {
        revealed = false;
        logo.classList.remove('revealed');
        stopBubbles();
        hideLogoTimer = null;
      }, 5000);
    } else {
      logo.classList.remove('revealed');
      stopBubbles();
    }
  });

  // Bubble animation functions
  function startBubbles() {
    // Clear any existing interval
    if (bubbleInterval) clearInterval(bubbleInterval);

    // Create new bubbles every 300ms
    bubbleInterval = setInterval(() => {
      if (!revealed) return;

      // Create 1-3 bubbles
      for (let i = 0; i < Math.floor(1 + Math.random() * 2); i++) {
        createBubble();
      }
    }, 300);
  }

  function stopBubbles() {
    if (bubbleInterval) {
      clearInterval(bubbleInterval);
      bubbleInterval = null;
    }
  }

  function createBubble() {
    const bubble = document.createElement('div');
    bubble.className = 'bubble';

    // Random size between 5px and 15px
    const size = 5 + Math.random() * 10;
    bubble.style.width = `${size}px`;
    bubble.style.height = `${size}px`;

    // Position randomly within container
    bubble.style.left = `${10 + Math.random() * 160}px`;
    bubble.style.bottom = `${10 + Math.random() * 50}px`;

    // Random animation duration
    const duration = 2 + Math.random() * 2;
    bubble.style.animation = `float ${duration}s ease-in-out`;

    bubbleContainer.appendChild(bubble);

    // Remove bubble after animation completes
    setTimeout(() => {
      if (bubbleContainer.contains(bubble)) {
        bubbleContainer.removeChild(bubble);
      }
    }, duration * 1000);
  }

  // Log handling functions
  function addLogMessage(logContent) {
    // Check if scrolled to bottom BEFORE adding new content.
    // A small tolerance helps with fractional pixel values.
    const tolerance = 1;
    const isScrolledToBottom = output.scrollHeight - output.clientHeight <= output.scrollTop + tolerance;

    messageCount++;

    // Always wrap in a div for consistent styling
    const tempDiv = document.createElement('div');

    // If the content is already HTML, use it directly
    if (logContent.includes('<div') || logContent.includes('<span')) {
      tempDiv.innerHTML = logContent;
    } else {
      // For raw text messages, add proper styling
      let logClass = 'plain-text';

      if (logContent.includes('✅')) {
        logClass = 'success-message';
      } else if (logContent.includes('❌')) {
        logClass = 'error-message';
      } else if (logContent.includes('⚠️')) {
        logClass = 'warning-message';
      } else if (logContent.includes('▶️')) {
        logClass = 'start-message';
      }

      tempDiv.innerHTML = `<div class="log-line ${logClass}">${logContent}</div>`;
    }

    output.appendChild(tempDiv);

    // Trim old messages if needed
    if (maxMessages > 0 && messageCount > maxMessages) {
      trimOldMessages();
    }

    // Scroll to bottom only if it was already at the bottom before new message
    if (isScrolledToBottom) {
      output.scrollTop = output.scrollHeight;
    }
  }

  function trimOldMessages() {
    // Keep removing the first child until we're within the limit
    while (output.childNodes.length > maxMessages) {
      if (output.firstChild) {
        output.removeChild(output.firstChild);
        messageCount--;
      } else {
        break;
      }
    }
  }

  // URL button update function
  function updateUrlButtons(buttons, automaticallyDiscovered) {
    // Find or create buttons container
    let buttonContainer = document.querySelector('.url-buttons');

    if (!buttons || buttons.length === 0) {
      // Remove the container if no buttons
      if (buttonContainer) {
        buttonContainer.remove();
      }
      return;
    }

    // Create container if it doesn't exist
    if (!buttonContainer) {
      buttonContainer = document.createElement('div');
      buttonContainer.className = 'url-buttons';
      document.body.insertBefore(buttonContainer, document.getElementById('bubbleContainer'));
    }

    // Update the content
    buttonContainer.innerHTML = `
      <h3>Application Links</h3>
      <div class="button-container">
        ${buttons.map(button => `
          <button class="url-button" data-url="${button.url}">
            ${button.label}
          </button>
        `).join('')}
      </div>
      ${automaticallyDiscovered ? `
      <p class="configuration-hint">
        Automatically discovered application links.
      </p>
      ` : ''}
    `;

    // Re-attach event listeners to the buttons
    document.querySelectorAll('.url-button').forEach(attachUrlButtonHandler);
  }

  // Search functionality
  function initSearchFeatures() {
    // Create search icon
    const searchIcon = document.createElement('button');
    searchIcon.className = 'search-icon';
    searchIcon.innerHTML = '🔍';
    searchIcon.title = 'Search logs (Ctrl+F)';
    searchIcon.setAttribute('aria-label', 'Search logs');
    output.appendChild(searchIcon);
    // Create search container (initially hidden)
    const searchContainer = document.createElement('div');
    searchContainer.className = 'search-container';
    searchContainer.innerHTML = `
      <input type="text" id="searchInput" placeholder="Search logs...">
      <span id="searchResults">0/0</span>
      <button id="nextMatch" title="Next match">↑</button>
      <button id="prevMatch" title="Previous match">↓</button>
      <button id="closeSearch" title="Close search">✕</button>
    `;
    
    // Insert at the top of output
    output.insertBefore(searchContainer, output.firstChild);
    
    // Get elements
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');
    const prevMatch = document.getElementById('prevMatch');
    const nextMatch = document.getElementById('nextMatch');
    const closeSearch = document.getElementById('closeSearch');
    
    // Search state
    let matches = [];
    let currentMatchIndex = -1;
    
    // Show/hide search functionality
    function showSearch() {
      searchContainer.classList.add('visible');
      searchInput.focus();
      searchIcon.style.display = 'none';
    }
    
    function hideSearch() {
      searchContainer.classList.remove('visible');
      clearHighlights();
      searchInput.value = '';
      searchResults.textContent = '0/0';
      matches = [];
      currentMatchIndex = -1;
      searchIcon.style.display = 'flex';
    }
    
    // Search icon click
    searchIcon.addEventListener('click', showSearch);
    
    // Handle search input
    searchInput.addEventListener('input', () => performSearch());
    
    // Navigation buttons
    prevMatch.addEventListener('click', () => navigateMatches(-1));
    nextMatch.addEventListener('click', () => navigateMatches(1));
    
    // Close search
    closeSearch.addEventListener('click', () => hideSearch());
    
    function performSearch() {
      const searchTerm = searchInput.value.trim();
      clearHighlights();
      
      if (!searchTerm) {
        searchResults.textContent = '0/0';
        matches = [];
        currentMatchIndex = -1;
        return;
      }
      
      // Get all text nodes in the output
      const logLines = output.querySelectorAll('.log-line');
      matches = [];
      
      // Search from bottom to top
      for (let i = logLines.length - 1; i >= 0; i--) {
        const text = logLines[i].textContent;
        if (text.toLowerCase().includes(searchTerm.toLowerCase())) {
          matches.push(logLines[i]);
        }
      }
      
      // Update counter
      searchResults.textContent = matches.length ? `1/${matches.length}` : '0/0';
      
      // Highlight first match
      if (matches.length > 0) {
        currentMatchIndex = 0;
        highlightMatch(matches[0]);
        scrollToMatch(matches[0]);
      }
    }
    
    function navigateMatches(direction) {
      if (matches.length === 0) return;
      
      clearHighlights();
      
      // Update current match index
      currentMatchIndex = (currentMatchIndex + direction + matches.length) % matches.length;
      
      // Update counter
      searchResults.textContent = `${currentMatchIndex + 1}/${matches.length}`;
      
      // Highlight and scroll to current match
      highlightMatch(matches[currentMatchIndex]);
      scrollToMatch(matches[currentMatchIndex]);
    }
    
    function highlightMatch(element) {
      element.classList.add('search-match-current');
    }
    
    function clearHighlights() {
      document.querySelectorAll('.search-match-current').forEach(el => {
        el.classList.remove('search-match-current');
      });
    }
    
    function scrollToMatch(element) {
      if (element) {
        element.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
    
    // Add search with keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl+F to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        showSearch();
      }
      
      // Enter to find next match
      if (e.key === 'Enter') {
        if (document.activeElement === searchInput) {
          if (e.shiftKey) {
            navigateMatches(-1); // Shift+Enter for previous
          } else {
            navigateMatches(1); // Enter for next
          }
        }
      }
      
      // Escape to close search
      if (e.key === 'Escape') {
        hideSearch();
      }
    });
  }

  // Message handling from extension
  window.addEventListener('message', event => {
    if (event.data.log) {
      addLogMessage(event.data.log);
    }

    // Handle button updates
    if (event.data.command === 'updateButtons') {
      updateUrlButtons(event.data.buttons, event.data.automaticallyDiscovered);
    }
  });

  // Initialize the UI
  initButtons();
  initSearchFeatures(); // Initialize search features
})();