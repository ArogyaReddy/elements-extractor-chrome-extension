// Element AI Extractor - Content Script
// Handles element inspection, highlighting, and data extraction

// Prevent multiple script loading
if (window.aiExtractorLoaded) {
  console.log("Element AI Extractor: Content script already loaded, skipping");
} else {
  window.aiExtractorLoaded = true;
  console.log("Element AI Extractor: Content script loaded");

  // Global state for inspection mode
  let isInspecting = false;
  let currentHighlightedElement = null;
  let lastClickedElement = null;
  let storageCheckInterval = null;

// Sync inspection state with storage periodically
function startStorageSync() {
  if (storageCheckInterval) {
    clearInterval(storageCheckInterval);
  }
  
  storageCheckInterval = setInterval(() => {
    // First check if Chrome APIs are available at all
    try {
      if (!chrome || !chrome.storage || !chrome.runtime) {
        console.log("Element AI Extractor: Chrome APIs not available, stopping storage sync");
        stopStorageSync();
        return;
      }

      // Test if runtime is accessible (this is a synchronous check)
      if (!chrome.runtime.id) {
        console.log("Element AI Extractor: Extension context invalidated (no runtime ID), stopping storage sync");
        stopStorageSync();
        return;
      }

      // Additional check: try accessing chrome.runtime.lastError to detect context issues
      try {
        // This will throw if context is invalid
        const testAccess = chrome.runtime.lastError;
      } catch (contextError) {
        console.log("Element AI Extractor: Extension context invalidated (runtime access test failed), stopping storage sync");
        stopStorageSync();
        return;
      }

      // Now try the async storage operation with proper error handling
      try {
        chrome.storage.local.get(['isInspecting'])
          .then(result => {
            const storageInspecting = result.isInspecting || false;

            // If storage says we should not be inspecting but we are, stop
            if (isInspecting && !storageInspecting) {
              console.log("Element AI Extractor: Storage sync detected inspection should stop");
              stopInspection();
            }
            // If storage says we should be inspecting but we're not, start
            else if (!isInspecting && storageInspecting) {
              console.log("Element AI Extractor: Storage sync detected inspection should start");
              startInspection();
            }
          })
          .catch(error => {
            // Handle storage access errors
            if (error.message && (error.message.includes('Extension context invalidated') || 
                                 error.message.includes('extension is invalid') ||
                                 error.message.includes('context invalidated'))) {
              console.log("Element AI Extractor: Extension context invalidated, stopping storage sync");
              stopStorageSync();
            } else {
              console.warn("Element AI Extractor: Error during storage sync:", error);
              // If we get repeated Chrome extension errors, stop to prevent spam
              if (error.message && error.message.includes('Extension')) {
                console.log("Element AI Extractor: Extension error detected, stopping storage sync");
                stopStorageSync();
              }
            }
          });
      } catch (syncError) {
        // Catch any immediate synchronous errors from chrome.storage.local.get
        console.log("Element AI Extractor: Synchronous error accessing storage, stopping storage sync:", syncError);
        stopStorageSync();
        return;
      }
    } catch (error) {
      // Catch any synchronous errors from Chrome API access
      console.log("Element AI Extractor: Error accessing Chrome APIs, stopping storage sync:", error);
      stopStorageSync();
    }
  }, 1000); // Check every second
}

function stopStorageSync() {
  if (storageCheckInterval) {
    console.log("Element AI Extractor: Stopping storage sync interval");
    clearInterval(storageCheckInterval);
    storageCheckInterval = null;
  }
}

// CSS for highlighting and cursor changes
const HIGHLIGHT_STYLES = `
  .ai-extractor-highlight {
    outline: 3px dashed #ff6b35 !important;
    outline-offset: 2px !important;
    background: rgba(255, 107, 53, 0.1) !important;
    position: relative !important;
    z-index: 999999 !important;
  }
  
  .ai-extractor-highlight::after {
    content: '🔍 AI Extractor';
    position: absolute !important;
    top: -25px !important;
    left: 0 !important;
    background: #ff6b35 !important;
    color: white !important;
    padding: 2px 8px !important;
    font-size: 11px !important;
    font-family: Arial, sans-serif !important;
    border-radius: 3px !important;
    z-index: 1000000 !important;
    pointer-events: none !important;
    white-space: nowrap !important;
  }
  
  body.ai-extractor-inspecting {
    cursor: crosshair !important;
  }
  
  body.ai-extractor-inspecting * {
    cursor: crosshair !important;
  }
  
  .ai-extractor-inspector-badge {
    position: fixed !important;
    top: 10px !important;
    right: 10px !important;
    background: #ff6b35 !important;
    color: white !important;
    padding: 8px 12px !important;
    border-radius: 6px !important;
    font-family: Arial, sans-serif !important;
    font-size: 12px !important;
    font-weight: bold !important;
    z-index: 2147483647 !important;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
    cursor: pointer !important;
    user-select: none !important;
    animation: ai-extractor-pulse 2s infinite !important;
  }
  
  @keyframes ai-extractor-pulse {
    0% { opacity: 1; }
    50% { opacity: 0.7; }
    100% { opacity: 1; }
  }
  
  .ai-extractor-inspector-badge:hover {
    background: #e55a2b !important;
    transform: scale(1.05) !important;
  }
`;

let inspectorBadge = null;

// Create floating inspector badge
function createInspectorBadge() {
  if (inspectorBadge) {
    return;
  }
  
  inspectorBadge = document.createElement('div');
  inspectorBadge.className = 'ai-extractor-inspector-badge';
  inspectorBadge.innerHTML = '🔍 AI Inspector Active<br><small>Click to stop</small>';
  inspectorBadge.title = 'AI Element Inspector is active. Click to stop inspection.';
  
  inspectorBadge.addEventListener('click', (event) => {
    console.log("Element AI Extractor: Badge clicked, stopping inspection");
    event.preventDefault();
    event.stopPropagation();
    
    stopInspection();
    // Clear storage state to ensure popup knows we stopped
    try {
      chrome.storage.local.set({ isInspecting: false });
    } catch (error) {
      console.warn("Element AI Extractor: Error clearing storage state from badge:", error);
    }
    // Send message to popup if it's open
    try {
      chrome.runtime.sendMessage({
        action: "inspectionStoppedFromBadge"
      }, (response) => {
        if (chrome.runtime.lastError) {
          // Popup might be closed, that's okay
          console.log("Element AI Extractor: No popup open to notify");
        }
      });
    } catch (error) {
      console.log("Element AI Extractor: Error sending message to popup from badge:", error);
    }
  });
  
  document.body.appendChild(inspectorBadge);
}

// Remove floating inspector badge
function removeInspectorBadge() {
  if (inspectorBadge && inspectorBadge.parentNode) {
    inspectorBadge.parentNode.removeChild(inspectorBadge);
    inspectorBadge = null;
  }
}

// Inject CSS styles for highlighting
function injectStyles() {
  const existingStyle = document.getElementById('ai-extractor-styles');
  if (existingStyle) {
    existingStyle.remove();
  }
  
  const styleElement = document.createElement('style');
  styleElement.id = 'ai-extractor-styles';
  styleElement.textContent = HIGHLIGHT_STYLES;
  document.head.appendChild(styleElement);
}

// Remove CSS styles
function removeStyles() {
  const styleElement = document.getElementById('ai-extractor-styles');
  if (styleElement) {
    styleElement.remove();
  }
}

// Highlight element on hover
function highlightElement(element) {
  if (currentHighlightedElement && currentHighlightedElement !== element) {
    currentHighlightedElement.classList.remove('ai-extractor-highlight');
  }
  
  if (element && element !== document.body && element !== document.documentElement) {
    element.classList.add('ai-extractor-highlight');
    currentHighlightedElement = element;
  }
}

// Remove highlight from element
function removeHighlight(element) {
  if (element) {
    element.classList.remove('ai-extractor-highlight');
  }
  if (currentHighlightedElement === element) {
    currentHighlightedElement = null;
  }
}

// Remove all highlights
function removeAllHighlights() {
  const highlightedElements = document.querySelectorAll('.ai-extractor-highlight');
  highlightedElements.forEach(el => {
    el.classList.remove('ai-extractor-highlight');
  });
  currentHighlightedElement = null;
}

// Get element details for inspection
function getElementDetails(element) {
  if (!element || element === document || element === document.body) {
    return null;
  }

  const tagName = element.tagName.toLowerCase();
  const elementType = getElementType(element);
  const locators = generateLocators(element);
  const bestLocator = getBestLocator(locators);
  
  return {
    'Element Name': getElementName(element),
    'Element Type': elementType,
    'Best Locator': bestLocator.locator,
    'Locator Type': bestLocator.type,
    'Strength': bestLocator.strength,
    'ID': element.id || 'N/A',
    'CSS': locators.css,
    'XPATH': locators.xpath,
    'In Shadow DOM': isInShadowDOM(element) ? 'Yes' : 'No',
    'Tag Name': tagName,
    'Class': element.className || 'N/A',
    'Text': (element.textContent || '').trim().substring(0, 100) || 'N/A'
  };
}

// Get element name (text content, placeholder, alt, title, etc.)
function getElementName(element) {
  // Try different attributes for a meaningful name
  const name = element.getAttribute('aria-label') ||
               element.getAttribute('title') ||
               element.getAttribute('placeholder') ||
               element.getAttribute('alt') ||
               element.getAttribute('name') ||
               (element.textContent || '').trim();
  
  return name ? name.substring(0, 50) : element.tagName.toLowerCase();
}

// Determine element type
function getElementType(element) {
  const tagName = element.tagName.toLowerCase();
  const type = element.type;
  const role = element.getAttribute('role');
  
  if (tagName === 'a') return 'Link';
  if (tagName === 'button' || type === 'button' || type === 'submit') return 'Button';
  if (tagName === 'input') {
    if (type === 'text' || type === 'email' || type === 'password') return 'Text Input';
    if (type === 'checkbox') return 'Checkbox';
    if (type === 'radio') return 'Radio Button';
    return 'Input';
  }
  if (tagName === 'select') return 'Dropdown';
  if (tagName === 'textarea') return 'Text Area';
  if (tagName === 'img') return 'Image';
  if (tagName === 'form') return 'Form';
  if (tagName === 'iframe') return 'IFrame';
  if (role) return `${role} (role)`;
  
  return tagName.charAt(0).toUpperCase() + tagName.slice(1);
}

// Generate different locator strategies
function generateLocators(element) {
  const locators = {};
  
  // ID selector
  if (element.id) {
    locators.id = `#${element.id}`;
  }
  
  // CSS selector
  locators.css = generateCSSSelector(element);
  
  // XPath
  locators.xpath = generateXPath(element);
  
  // Name attribute
  if (element.name) {
    locators.name = `[name="${element.name}"]`;
  }
  
  // Aria-label
  if (element.getAttribute('aria-label')) {
    locators.ariaLabel = `[aria-label="${element.getAttribute('aria-label')}"]`;
  }
  
  return locators;
}

// Generate CSS selector
function generateCSSSelector(element) {
  if (element.id) {
    return `#${element.id}`;
  }
  
  const parts = [];
  let current = element;
  
  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();
    
    if (current.id) {
      selector += `#${current.id}`;
      parts.unshift(selector);
      break;
    }
    
    if (current.className) {
      const classes = current.className.split(' ').filter(c => c.trim());
      if (classes.length > 0) {
        selector += '.' + classes.join('.');
      }
    }
    
    // Add nth-child if needed for uniqueness
    const siblings = Array.from(current.parentNode?.children || [])
      .filter(el => el.tagName === current.tagName);
    if (siblings.length > 1) {
      // Use nth-of-type for same tag name elements, or nth-child for position among all elements
      const sameTagIndex = siblings.indexOf(current) + 1;
      const allSiblingsIndex = Array.from(current.parentNode?.children || []).indexOf(current) + 1;
      
      // Prefer nth-of-type if there are multiple elements of the same type
      if (siblings.length > 1) {
        selector += `:nth-of-type(${sameTagIndex})`;
      } else {
        selector += `:nth-child(${allSiblingsIndex})`;
      }
    }
    
    parts.unshift(selector);
    current = current.parentElement;
    
    if (parts.length > 5) break; // Limit depth
  }
  
  return parts.join(' > ');
}

// Generate XPath
function generateXPath(element) {
  if (element.id) {
    return `//*[@id="${element.id}"]`;
  }
  
  const parts = [];
  let current = element;
  
  while (current && current !== document.body) {
    let part = current.tagName.toLowerCase();
    
    if (current.id) {
      part = `*[@id="${current.id}"]`;
      parts.unshift(part);
      break;
    }
    
    // Count siblings of same tag
    const siblings = Array.from(current.parentNode?.children || [])
      .filter(el => el.tagName === current.tagName);
    if (siblings.length > 1) {
      const index = siblings.indexOf(current) + 1;
      part += `[${index}]`;
    }
    
    parts.unshift(part);
    current = current.parentElement;
    
    if (parts.length > 8) break; // Limit depth
  }
  
  return '//' + parts.join('/');
}

// Determine best locator based on reliability
function getBestLocator(locators) {
  // Priority order: ID > Name > Aria-label > CSS > XPath
  if (locators.id) {
    return { locator: locators.id, type: 'ID', strength: 95 };
  }
  
  if (locators.name) {
    return { locator: locators.name, type: 'Name', strength: 85 };
  }
  
  if (locators.ariaLabel) {
    return { locator: locators.ariaLabel, type: 'Aria-label', strength: 80 };
  }
  
  if (locators.css && locators.css.length < 100) {
    return { locator: locators.css, type: 'CSS', strength: 70 };
  }
  
  if (locators.xpath && locators.xpath.length < 150) {
    return { locator: locators.xpath, type: 'XPath', strength: 60 };
  }
  
  // Fallback to CSS even if long
  return { locator: locators.css || locators.xpath, type: 'CSS', strength: 50 };
}

// Check if element is in shadow DOM
function isInShadowDOM(element) {
  let parent = element.parentNode;
  while (parent) {
    if (parent.toString() === '[object ShadowRoot]') {
      return true;
    }
    parent = parent.parentNode;
  }
  return false;
}

// Start inspection mode
function startInspection() {
  if (isInspecting) {
    console.log("Element AI Extractor: Already in inspection mode");
    return { status: 'listening' };
  }
  
  console.log("Element AI Extractor: Starting inspection mode");
  isInspecting = true;
  
  // Start syncing with storage
  startStorageSync();
  
  // Inject styles
  injectStyles();
  
  // Add cursor style to body
  document.body.classList.add('ai-extractor-inspecting');
  
  // Create floating badge for user guidance
  createInspectorBadge();
  
  // Add event listeners
  document.addEventListener('mouseover', handleMouseOver, true);
  document.addEventListener('mouseout', handleMouseOut, true);
  document.addEventListener('click', handleClick, true);
  
  return { status: 'listening' };
}

// Stop inspection mode
function stopInspection() {
  if (!isInspecting) {
    console.log("Element AI Extractor: Not in inspection mode");
    return { status: 'stopped' };
  }
  
  console.log("Element AI Extractor: Stopping inspection mode");
  isInspecting = false;
  
  // Clear storage state IMMEDIATELY to prevent sync conflicts
  try {
    chrome.storage.local.set({ isInspecting: false });
  } catch (error) {
    console.warn("Element AI Extractor: Error clearing storage state:", error);
  }
  
  // Stop syncing with storage
  stopStorageSync();
  
  // Remove floating badge
  removeInspectorBadge();
  
  // Remove event listeners
  document.removeEventListener('mouseover', handleMouseOver, true);
  document.removeEventListener('mouseout', handleMouseOut, true);
  document.removeEventListener('click', handleClick, true);
  
  // Remove highlights and styles
  removeAllHighlights();
  document.body.classList.remove('ai-extractor-inspecting');
  removeStyles();
  
  return { status: 'stopped' };
}

// Handle mouse over events
function handleMouseOver(event) {
  if (!isInspecting) return;
  
  event.stopPropagation();
  const element = event.target;
  
  // Don't highlight body or html
  if (element === document.body || element === document.documentElement) {
    return;
  }
  
  highlightElement(element);
}

// Handle mouse out events
function handleMouseOut(event) {
  if (!isInspecting) return;
  
  event.stopPropagation();
  // Don't remove highlight on mouseout - keep it until mouseover on new element
}

// Handle click events
function handleClick(event) {
  if (!isInspecting) return;
  
  event.preventDefault();
  event.stopPropagation();
  
  const element = event.target;
  console.log("Element AI Extractor: Element clicked", element);
  
  // Don't process body or html clicks
  if (element === document.body || element === document.documentElement) {
    return;
  }
  
  // Don't process clicks on our own inspector badge
  if (element.classList.contains('ai-extractor-inspector-badge') || 
      element.closest('.ai-extractor-inspector-badge')) {
    console.log("Element AI Extractor: Badge click detected, skipping element processing");
    return;
  }
  
  // Get element details
  const elementData = getElementDetails(element);
  
  if (elementData) {
    console.log("Element AI Extractor: Sending element data to popup", elementData);
    
    // Store the data in chrome storage for persistence
    const inspectedData = {
      data: elementData,
      timestamp: Date.now(),
      url: window.location.href
    };
    
    try {
      chrome.storage.local.set({ 
        lastInspectedElement: inspectedData 
      }, () => {
        if (chrome.runtime.lastError) {
          console.error("Element AI Extractor: Error storing element data:", chrome.runtime.lastError.message);
        } else {
          console.log("Element AI Extractor: Element data stored successfully");
        }
      });
    } catch (error) {
      console.error("Element AI Extractor: Error accessing storage:", error);
    }
    
    // Try to send to popup if it's open, but don't rely on it
    try {
      chrome.runtime.sendMessage({
        action: "inspectedElementDataAiExtractor",
        data: elementData
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.log("Element AI Extractor: Popup closed - data stored in storage instead");
        } else {
          console.log("Element AI Extractor: Successfully sent element data to popup");
        }
      });
    } catch (error) {
      console.log("Element AI Extractor: Error sending element data to popup:", error);
    }
    
    // Keep inspection mode active - don't stop automatically
    // User needs to manually click "Stop Inspecting"
    lastClickedElement = element;
  }
}

/**
 * Query an element by CSS selector, traversing shadow DOM if needed.
 * @param {string} selector
 * @returns {Element|null}
 */
function queryElementInShadowDOM(selector) {
  console.log('[qEISD] Starting search in shadow DOM for selector:', selector);
  // Removed initial document.querySelector(selector) as main handler does this.

  function findIn(node, depth = 0) {
    if (depth > 10) {
      // console.log('[qEISD] Max depth reached for node:', node.tagName || 'Node');
      return null;
    }

    try {
      if (node.shadowRoot) {
        const hostTagName = node.tagName ? node.tagName.toLowerCase() : 'host_node';
        console.log(`[qEISD] Checking shadowRoot of <${hostTagName}> with main selector: "${selector}"`);
        try {
          let found = node.shadowRoot.querySelector(selector);
          if (found) {
            console.log(`[qEISD] ✓ Found in shadowRoot of <${hostTagName}> with main selector: "${selector}"`);
            return found;
          }

          // If complex selector failed, try simplified version (last part) within this shadow root
          const isComplexSelector = selector.includes('>') || selector.includes(' ');
          const isSimpleClassOrId = selector.startsWith('.') || selector.startsWith('#');

          if (isComplexSelector && !isSimpleClassOrId) {
            const parts = selector.split(/\\s*>\\s*|\\s+/);
            const lastPart = parts[parts.length - 1].trim();
            
            if (lastPart && lastPart !== selector) { // Ensure lastPart is simpler and not empty
              console.log(`[qEISD] Retrying in shadowRoot of <${hostTagName}> with simplified selector: "${lastPart}"`);
              found = node.shadowRoot.querySelector(lastPart);
              if (found) {
                console.log(`[qEISD] ✓ Found with simplified selector "${lastPart}" in shadowRoot of <${hostTagName}>`);
                return found;
              } else {
                // console.log(`[qEISD] ✗ Not found with simplified selector "${lastPart}" in shadowRoot of <${hostTagName}>`);
              }
            }
          }
        } catch (e) {
          console.warn(`[qEISD] Error querying shadowRoot of <${hostTagName}> with selector "${selector}":`, e.message);
        }
      }

      if (node.children) {
        for (const child of node.children) {
          // Avoid searching inside our own badge or other extension UI
          if (child.classList && (child.classList.contains('ai-extractor-highlight') || child.classList.contains('ai-extractor-inspector-badge'))) {
            continue;
          }
          const foundInChild = findIn(child, depth + 1);
          if (foundInChild) return foundInChild;
        }
      }
    } catch (e) {
      // console.warn('[qEISD] Error during shadow DOM traversal on node:', node.tagName || 'Node', e.message);
    }
    return null;
  }

  const result = findIn(document.documentElement);
  if (!result) {
    console.log('[qEISD] Element not found in any shadow DOM with selector:', selector);
  }
  return result;
}

// Message listener for communication with popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Element AI Extractor: Content script received message", message);
  try {
    switch (message.action) {
      case 'highlightElement': {
        console.log('Element AI Extractor: Highlighting element task received. Locator:', message.locator, 'inShadowDOM hint:', message.inShadowDOM);
        try {
          let element = null;
          const originalLocator = message.locator;

          if (!originalLocator) {
            console.warn('Element AI Extractor: No locator provided.');
            sendResponse({ status: 'error', error: 'No locator provided' });
            return true;
          }
          
          console.log('Attempting to find element with original locator:', originalLocator);

          // Strategy 0: Handle special text-content selector
          if (originalLocator.includes('[text-content="')) {
            console.log('Strategy 0: Handling text-content selector');
            try {
              const textMatch = originalLocator.match(/([a-z]+)\[text-content="([^"]+)"\]/);
              if (textMatch) {
                const tagName = textMatch[1];
                const textContent = textMatch[2];
                const elements = document.querySelectorAll(tagName);
                for (const elem of elements) {
                  if (elem.textContent && elem.textContent.trim() === textContent) {
                    element = elem;
                    console.log('✓ Strategy 0: Found element by text content:', textContent);
                    break;
                  }
                }
              }
            } catch (e) {
              console.warn('✗ Strategy 0: Text-content selector failed:', e.message);
            }
          }

          // Strategy 1: Direct querySelector with original locator
          if (!element) {
            try {
              element = document.querySelector(originalLocator);
              if (element) {
                console.log('✓ Strategy 1: Found with direct querySelector:', originalLocator);
              }
            } catch (e) {
              console.warn('✗ Strategy 1: Direct querySelector failed:', e.message);
            }
          }
            
          // Strategy 2: Targeted Shadow DOM search if inShadowDOM is true and element not found
          if (!element && message.inShadowDOM) {
            console.log('Attempting Strategy 2: Targeted Shadow DOM search');
            let locatorForShadow = originalLocator;
            // Heuristic: if locator is a path, try only the last part inside shadow DOMs
            if (originalLocator.includes('>') || originalLocator.includes(' ')) {
                const parts = originalLocator.split(/\\s*>\\s*|\\s+/);
                const simplified = parts[parts.length - 1].trim();
                if (simplified && simplified !== originalLocator) {
                    locatorForShadow = simplified;
                    console.log(`  Using simplified locator for targeted shadow search: "${locatorForShadow}" (derived from "${originalLocator}")`);
                } else {
                    console.log(`  Simplified locator is same as original or empty, using original for targeted shadow search: "${locatorForShadow}"`);
                }
            }
            
            if (locatorForShadow) {
                try {
                    element = queryElementInShadowDOM(locatorForShadow);
                    if (element) {
                        console.log('✓ Strategy 2: Found with targeted shadow DOM search using:', locatorForShadow);
                    } else {
                        console.log('✗ Strategy 2: Not found with targeted shadow DOM search using:', locatorForShadow);
                    }
                } catch (e) {
                    console.warn('✗ Strategy 2: Targeted shadow DOM search failed:', e.message);
                }
            } else {
                console.log('✗ Strategy 2: Locator for shadow search was empty, skipped.');
            }
          }
            
          // Strategy 3: General Shadow DOM search with original locator (if not found yet)
          if (!element) {
            console.log('Attempting Strategy 3: General Shadow DOM search (with original locator)');
            try {
                element = queryElementInShadowDOM(originalLocator); 
                if (element) {
                    console.log('✓ Strategy 3: Found with general shadow DOM search using:', originalLocator);
                } else {
                    console.log('✗ Strategy 3: Not found with general shadow DOM search using:', originalLocator);
                }
            } catch (e) {
                console.warn('✗ Strategy 3: General shadow DOM search failed:', e.message);
            }
          }
            
          // Strategy 4: Try with escaped selectors for special characters
          if (!element) {
            console.log('Attempting Strategy 4: Escaped selector');
            try {
              const escapedSelector = originalLocator.replace(/:/g, '\\\\:').replace(/\\[/g, '\\\\[').replace(/\\]/g, '\\\\]');
              if (escapedSelector !== originalLocator) {
                element = document.querySelector(escapedSelector);
                if (element) {
                  console.log('✓ Strategy 4: Found element with escaped selector:', escapedSelector);
                } else {
                  // console.log('✗ Strategy 4: Not found with escaped selector:', escapedSelector);
                }
              } else {
                // console.log('Strategy 4: No escaping needed for selector.');
              }
            } catch (e) {
              console.warn('✗ Strategy 4: Escaped selector failed:', e.message);
            }
          }
            
          // Strategy 5: Try simplified selectors if complex selector failed (for document.querySelector)
          if (!element && (originalLocator.includes(' > ') || originalLocator.includes(' '))) {
            console.log('Attempting Strategy 5: Simplified selector (generic for document)');
            try {
              const parts = originalLocator.split(/\\s*>\\s*|\\s+/);
              const lastPart = parts[parts.length - 1].trim();
              if (lastPart && lastPart !== originalLocator) {
                element = document.querySelector(lastPart);
                if (element) {
                  console.log('✓ Strategy 5: Found element with simplified selector (generic):', lastPart);
                } else {
                  // console.log('✗ Strategy 5: Not found with simplified selector (generic):', lastPart);
                }
              }
            } catch (e) {
              console.warn('✗ Strategy 5: Simplified selector (generic) failed:', e.message);
            }
          }
            
          // Strategy 6: Try by ID if present
          if (!element && originalLocator.includes('#')) {
            console.log('Attempting Strategy 6: ID-based search');
            try {
              const idMatch = originalLocator.match(/#([^.\\s:>\\[\\]]+)/);
              if (idMatch) {
                const id = idMatch[1];
                element = document.getElementById(id);
                if (element) {
                  console.log('✓ Strategy 6: Found element by ID:', id);
                } else {
                  // console.log('✗ Strategy 6: Not found by ID:', id);
                }
              }
            } catch (e) {
              console.warn('✗ Strategy 6: ID-based search failed:', e.message);
            }
          }
            
          // Strategy 7: Try by class name if present (first class)
          if (!element && originalLocator.includes('.')) {
            console.log('Attempting Strategy 7: Class-based search (first class)');
            try {
              // More robust regex to find the first class, avoiding issues with pseudo-classes like :nth-child
              const classMatch = originalLocator.match(/\\.([^\\s:>\\[\\]#.]+)/);
              if (classMatch) {
                const className = classMatch[1];
                // Query for elements with this class, then check if any of them match the full original selector
                // This is to avoid picking a wrong element if the class is common.
                // However, for a fallback, just finding by class might be enough.
                // For now, stick to simple querySelector with the class.
                const potentialElements = document.querySelectorAll('.' + className);
                if (potentialElements.length > 0) {
                    // Heuristic: if originalLocator is simple (just a class or class + tag), take the first match.
                    // Otherwise, this strategy might be too broad.
                    // For now, let's try the first one.
                    element = potentialElements[0]; // This is a simplification.
                    // A more robust check would be to see if this element also matches other parts of originalLocator.
                    console.log('✓ Strategy 7: Found element by class (used first match):', className);
                } else {
                  // console.log('✗ Strategy 7: Not found by class:', className);
                }
              }
            } catch (e) {
              console.warn('✗ Strategy 7: Class-based search failed:', e.message);
            }
          }
            
          // Strategy 8: Try by tag name if simple tag
          if (!element && /^[a-zA-Z]+$/.test(originalLocator)) {
            console.log('Attempting Strategy 8: Tag name search');
            try {
              const elements = document.getElementsByTagName(originalLocator);
              if (elements.length > 0) {
                element = elements[0]; // Take the first one
                console.log('✓ Strategy 8: Found element by tag name:', originalLocator);
              } else {
                // console.log('✗ Strategy 8: Not found by tag name:', originalLocator);
              }
            } catch (e) {
              console.warn('✗ Strategy 8: Tag name search failed:', e.message);
            }
          }
            
          // Strategy 9: Try XPath if selector looks like XPath
          if (!element && (originalLocator.startsWith('/') || originalLocator.startsWith('./') || originalLocator.startsWith('('))) {
            console.log('Attempting Strategy 9: XPath search');
            try {
              const xpathResult = document.evaluate(
                originalLocator,
                document,
                null,
                XPathResult.FIRST_ORDERED_NODE_TYPE,
                null
              );
              if (xpathResult.singleNodeValue) {
                element = xpathResult.singleNodeValue;
                console.log('✓ Strategy 9: Found element with XPath');
              } else {
                // console.log('✗ Strategy 9: Not found with XPath');
              }
            } catch (e) {
              console.warn('✗ Strategy 9: XPath search failed:', e.message);
            }
          }
          
          if (element) {
            injectStyles();
            
            // Remove any existing highlights
            removeAllHighlights();
            
            // Add highlight to found element
            highlightElement(element);
            
            // Scroll element into view
            try {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } catch (e) {
              console.warn('Scroll into view failed:', e.message);
            }
            
            // Auto-remove highlight after 3 seconds
            setTimeout(() => {
              removeHighlight(element);
            }, 3000);
            
            sendResponse({ status: 'highlighted' });
          } else {
            console.warn('Element AI Extractor: Element not found for locator after all strategies:', originalLocator);
            sendResponse({ status: 'notFound', locator: originalLocator });
          }
        } catch (err) {
          console.error('Element AI Extractor: Error highlighting element', err);
          sendResponse({ status: 'error', error: err.message });
        }
        return true;
      }
      case 'ping':
        console.log("Element AI Extractor: Responding to ping");
        sendResponse({ status: 'alive', inspecting: isInspecting, timestamp: Date.now() });
        return true; // Keep channel open
        
      case 'startInspectingAiExtractor':
        console.log("Element AI Extractor: Starting inspection");
        const startResult = startInspection();
        sendResponse(startResult);
        return true; // Keep channel open
        
      case 'stopInspectingAiExtractor':
        console.log("Element AI Extractor: Stopping inspection");
        const stopResult = stopInspection();
        sendResponse(stopResult);
        return true; // Keep channel open
        
      default:
        console.log("Element AI Extractor: Unknown message action", message.action);
        sendResponse({ status: 'error', message: 'Unknown action' });
        return true; // Keep channel open
    }
  } catch (error) {
    console.error("Element AI Extractor: Error handling message:", error);
    sendResponse({ status: 'error', message: error.message });
    return true; // Keep channel open
  }
});

// Cleanup when page unloads
window.addEventListener('beforeunload', () => {
  console.log("Element AI Extractor: Page unloading, cleaning up...");
  if (isInspecting) {
    stopInspection();
  }
  // Stop storage sync to prevent orphaned intervals
  stopStorageSync();
});

// Also listen for page visibility changes (helps with context invalidation)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Page is hidden, stop storage sync to prevent errors
    stopStorageSync();
  } else {
    // Page is visible again, restart storage sync if we're inspecting
    if (isInspecting) {
      initializeStorageSync();
    }
  }
});

// Global error handler for extension context invalidation
window.addEventListener('error', (event) => {
  if (event.error && event.error.message && 
      (event.error.message.includes('Extension context invalidated') || 
       event.error.message.includes('extension is invalid'))) {
    console.log("Element AI Extractor: Global error handler detected context invalidation");
    stopStorageSync();
  }
});

// Global promise rejection handler to suppress extension context invalidation errors
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && event.reason.message && 
      (event.reason.message.includes('Extension context invalidated') || 
       event.reason.message.includes('extension is invalid') ||
       event.reason.message.includes('context invalidated'))) {
    console.log("Element AI Extractor: Suppressing extension context invalidation error");
    event.preventDefault(); // Prevent the error from being logged to console
    stopStorageSync();
  }
});

// Initialize storage sync on load (with context validation)
function initializeStorageSync() {
  try {
    // Check if chrome extension context is valid before starting sync
    if (!chrome || !chrome.storage || !chrome.runtime) {
      console.log("Element AI Extractor: Chrome extension APIs not available");
      return;
    }

    // Test if runtime is accessible
    if (chrome.runtime.id === undefined) {
      console.log("Element AI Extractor: Extension context not valid");
      return;
    }

    console.log("Element AI Extractor: Starting storage sync");
    startStorageSync();

    // Listen for runtime disconnect to detect context invalidation
    if (chrome.runtime.onConnect) {
      chrome.runtime.onConnect.addListener((port) => {
        port.onDisconnect.addListener(() => {
          console.log("Element AI Extractor: Runtime disconnected, stopping storage sync");
          stopStorageSync();
        });
      });
    }
  } catch (error) {
    console.log("Element AI Extractor: Failed to initialize storage sync:", error.message);
  }
}

// Initialize storage sync on load
initializeStorageSync();

console.log("Element AI Extractor: Content script ready");

} // End of script loading check
