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
    
    // The context menu event listener and related code has been removed
    // since we're now using VS Code's native context menu system
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
    searchIcon.title = 'Search logs';
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
      <button id="toggleCase" title="Toggle case sensitivity">Aa</button>
      <button id="toggleRegex" title="Toggle regex mode">.*</button>
      <button id="closeSearch" title="Close search">✕</button>
    `;
    
    // Insert at the top of output
    output.insertBefore(searchContainer, output.firstChild);
    
    // Get elements
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');
    const prevMatch = document.getElementById('prevMatch');
    const nextMatch = document.getElementById('nextMatch');
    const toggleCase = document.getElementById('toggleCase');
    const toggleRegex = document.getElementById('toggleRegex');
    const closeSearch = document.getElementById('closeSearch');
    
    // Search state
    const searchState = {
      matches: [],
      currentMatchIndex: -1,
      caseSensitive: false,
      regex: false
    };
    
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
      searchState.matches = [];
      searchState.currentMatchIndex = -1;
      searchIcon.style.display = 'flex';
    }
    
    // Search icon click
    searchIcon.addEventListener('click', showSearch);
    
    // Handle search input
    searchInput.addEventListener('input', () => performSearch());
    
    // Navigation buttons
    prevMatch.addEventListener('click', () => navigateMatches(-1));
    nextMatch.addEventListener('click', () => navigateMatches(1));
    
    // Toggle case sensitivity
    toggleCase.addEventListener('click', () => {
      searchState.caseSensitive = !searchState.caseSensitive;
      toggleCase.classList.toggle('active', searchState.caseSensitive);
      performSearch();
    });
    
    // Toggle regex mode
    toggleRegex.addEventListener('click', () => {
      searchState.regex = !searchState.regex;
      toggleRegex.classList.toggle('active', searchState.regex);
      performSearch();
    });
    
    // Close search
    closeSearch.addEventListener('click', () => hideSearch());
    
    function performSearch() {
      const searchTerm = searchInput.value.trim();
      clearHighlights();
      
      if (!searchTerm) {
        searchResults.textContent = '0/0';
        searchState.matches = [];
        searchState.currentMatchIndex = -1;
        return;
      }
      
      // Get all text nodes in the output
      const logLines = output.querySelectorAll('.log-line');
      searchState.matches = [];
      
      // Create a regex for the search term
      const flags = searchState.caseSensitive ? 'g' : 'gi';
      let searchRegex;
      
      try {
        if (searchState.regex) {
          // Use the raw pattern for regex mode
          searchRegex = new RegExp(searchTerm, flags);
        } else {
          // Escape special characters in normal search mode
          searchRegex = new RegExp(escapeRegExp(searchTerm), flags);
        }
      } catch (e) {
        // Handle invalid regex
        searchResults.textContent = 'Invalid RegEx';
        return;
      }
      
      // Search from bottom to top (most recent logs first)
      for (let i = logLines.length - 1; i >= 0; i--) {
        const logLine = logLines[i];
        const text = logLine.textContent;
        
        if (text.match(searchRegex)) {
          searchState.matches.push(logLine);
          
          // Highlight all instances of the search term
          highlightMatches(logLine, searchTerm, searchRegex);
        }
      }
      
      // Update counter
      searchResults.textContent = searchState.matches.length ? `1/${searchState.matches.length}` : '0/0';
      
      // Highlight first match
      if (searchState.matches.length > 0) {
        searchState.currentMatchIndex = 0;
        searchState.matches[0].classList.add('search-match-current');
        scrollToMatch(searchState.matches[0]);
      }
    }
    
    function highlightMatches(element, searchTerm, regex) {
      // Don't apply highlighting to pre elements or their children (like JSON)
      if (element.tagName === 'PRE' || element.closest('pre')) {
        return;
      }
      
      // Process only direct text nodes and direct span children (not deeply nested content)
      Array.from(element.childNodes).forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'SPAN') {
          // For direct span children, process their text content
          const spanText = node.textContent;
          
          if (spanText.match(regex)) {
            // Store the original class name
            const originalClass = node.className;
            
            // Replace matches with highlighted spans, keeping original class
            node.innerHTML = spanText.replace(regex, 
              `<span class="search-term-highlight">$&</span>`);
            
            // Ensure the outer span still has its original class
            node.className = originalClass;
          }
        }
      });
    }
    
    function navigateMatches(direction) {
      if (searchState.matches.length === 0) return;
      
      // Remove current highlight
      if (searchState.currentMatchIndex >= 0) {
        searchState.matches[searchState.currentMatchIndex].classList.remove('search-match-current');
      }
      
      // Update current match index
      searchState.currentMatchIndex = (searchState.currentMatchIndex + direction + searchState.matches.length) % searchState.matches.length;
      
      // Update counter
      searchResults.textContent = `${searchState.currentMatchIndex + 1}/${searchState.matches.length}`;
      
      // Highlight and scroll to current match
      searchState.matches[searchState.currentMatchIndex].classList.add('search-match-current');
      scrollToMatch(searchState.matches[searchState.currentMatchIndex]);
    }
    
    function clearHighlights() {
      // Clear current match highlights
      document.querySelectorAll('.search-match-current').forEach(el => {
        el.classList.remove('search-match-current');
      });
      
      // Normalize the DOM to combine adjacent text nodes
      output.normalize();
    }
    
    function scrollToMatch(element) {
      if (element) {
        element.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
    
    // Helper function to escape special characters in regex
    function escapeRegExp(string) {
      return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    
    // Add search with keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Enter to find next match
      if (e.key === 'Enter') {
        if (document.activeElement === searchInput) {
          if (e.shiftKey) {
            navigateMatches(-1); // Shift+Enter for previous
          } else {
            navigateMatches(1); // Enter for next
          }
          e.preventDefault();
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
    
    // Handle clearOutput command
    if (event.data.command === 'clearOutput') {
      output.innerHTML = '';
      messageCount = 0;
    }
    
    // Handle restoreLogs command - this allows bulk restore of logs
    if (event.data.command === 'restoreLogs' && event.data.log) {
      // Handle logs more carefully - especially with formatted JSON
      output.innerHTML = '';  // Clear first
      
      // Create a temporary container
      const parser = new DOMParser();
      const doc = parser.parseFromString(`<div>${event.data.log}</div>`, 'text/html');
      
      // Extract all nodes from the parsed document body and append them to output
      const nodesFromLog = doc.body.firstChild.childNodes;
      nodesFromLog.forEach(node => {
        output.appendChild(document.importNode(node, true));
      });
      
      // Update message count estimate based on log lines
      messageCount = output.querySelectorAll('.log-line').length || 
                     event.data.log.split('\n').length;  // Fallback if no log-line divs
    }

    // Handle restoreRawLogs command
    if (event.data.command === 'restoreRawLogs' && event.data.logs) {
      // Clear before restoring
      output.innerHTML = '';
      messageCount = 0;
      
      // Process each log entry individually (like when it was first received)
      event.data.logs.forEach(log => {
        addLogMessage(log);
      });
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