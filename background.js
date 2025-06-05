// ---- Global Error Handler for Extension Context Invalidation ----
// Suppress unhandled promise rejections related to extension context invalidation
self.addEventListener('unhandledrejection', (event) => {
  if (event.reason && typeof event.reason === 'object' && 
      (event.reason.message?.includes('Extension context invalidated') ||
       event.reason.message?.includes('Could not establish connection'))) {
    console.warn("Element AI Extractor (Background): Suppressed context invalidation error:", event.reason.message);
    event.preventDefault();
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'aiExtractorMenu',
    title: 'Extract elements with AI Extractor',
    contexts: ['all']
  });
  
  // Initialize storage state
  try {
    chrome.storage.local.set({ isInspecting: false });
    if (chrome.runtime.lastError) {
      console.warn("Element AI Extractor (Background): Storage set warning:", chrome.runtime.lastError.message);
    }
  } catch (error) {
    console.warn("Element AI Extractor (Background): Failed to initialize storage:", error.message);
  }
  
  console.log('Element AI Extractor: Background script initialized');
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'aiExtractorMenu') {
    // Inject content script and then send message
    chrome.scripting.executeScript({
      target: {tabId: tab.id},
      files: ['contentScript.js']
    }).then(() => {
      console.log('Element AI Extractor: Content script injected via context menu');
    }).catch(error => {
      console.error('Element AI Extractor: Failed to inject content script via context menu:', error);
    });
  }
});

// Handle extension icon click to ensure content script is available
chrome.action.onClicked.addListener((tab) => {
  // This will only fire if no popup is defined, but we have one
  // This is just a backup handler
  console.log('Element AI Extractor: Extension icon clicked');
});

// Handle tab changes - stop inspection if tab switches
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    chrome.storage.local.get(['isInspecting'], (result) => {
      if (chrome.runtime.lastError) {
        console.warn("Element AI Extractor (Background): Storage get warning:", chrome.runtime.lastError.message);
        return;
      }
      if (result.isInspecting) {
        // Stop inspection in the previous tab if it was active
        chrome.tabs.query({ active: false, currentWindow: true }, (tabs) => {
          tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
              action: "stopInspectingAiExtractor"
            }, () => {
              // Ignore errors - content script might not be loaded
              if (chrome.runtime.lastError) {
                console.log("Element AI Extractor: No content script in tab", tab.id);
              }
            });
          });
        });
      }
    });
  } catch (error) {
    console.warn("Element AI Extractor (Background): Failed to handle tab activation:", error.message);
  }
});
