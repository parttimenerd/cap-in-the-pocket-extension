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
  let scrollToBottomButton; // For the "scroll to bottom" button

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
    
    // Update scroll to bottom button visibility
    updateScrollButtonVisibility();
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

  // Scroll to bottom feature functions
  function initScrollFeatures() {
    scrollToBottomButton = document.createElement('button');
    scrollToBottomButton.textContent = '⬇️'; // You can use text like "Scroll to Bottom" or an icon
    scrollToBottomButton.id = 'scrollToBottomButton';
    scrollToBottomButton.className = 'scroll-button'; // CSS styling now handled by this class
    scrollToBottomButton.title = 'Scroll to bottom';
    scrollToBottomButton.setAttribute('aria-label', 'Scroll to bottom');
    
    // Ensure the output container is ready for absolute positioning
    if (window.getComputedStyle(output).position === 'static') {
      output.style.position = 'relative';
    }
    
    // Append the button to output
    output.appendChild(scrollToBottomButton);
    
    // Event listener for clicking the button
    scrollToBottomButton.addEventListener('click', () => {
      output.scrollTop = output.scrollHeight;
      updateScrollButtonVisibility(); // Update visibility after scrolling
    });

    // Event listener for scroll events on the output div
    output.addEventListener('scroll', updateScrollButtonVisibility);
    
    // Also update on window resize, as clientHeight might change
    window.addEventListener('resize', updateScrollButtonVisibility);

    // Force a check initially
    setTimeout(updateScrollButtonVisibility, 100);
    
    // For debugging: temporarily force button visibility to check if it appears
    console.log('Scroll button created:', scrollToBottomButton);
    // Uncomment next line for debugging
    // scrollToBottomButton.style.display = 'block';
  }

  function updateScrollButtonVisibility() {
    if (!scrollToBottomButton || !output) return;

    const tolerance = 2; // Small tolerance for pixel calculations
    // Check if the content is scrollable
    const isScrollable = output.scrollHeight > output.clientHeight;
    // Check if not scrolled to the very bottom

    if (isScrollable && isNotAtBottom) {
      scrollToBottomButton.style.display = 'block';
    } else {
      scrollToBottomButton.style.display = 'none';
    }
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
  initScrollFeatures(); // Initialize scroll-related features
})();