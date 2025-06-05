// === Element AI Extractor - popup.js ===

// ---- Global Error Handlers for Extension Context Invalidation ----
// Suppress unhandled promise rejections related to extension context invalidation
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && typeof event.reason === 'object' && 
      (event.reason.message?.includes('Extension context invalidated') ||
       event.reason.message?.includes('Could not establish connection'))) {
    console.warn("Element AI Extractor (Popup): Suppressed context invalidation error:", event.reason.message);
    event.preventDefault();
  }
});

// ---- AI Tip List ----
const aiTips = ['Did you know? [role] and [aria-label] improve accessibility and test stability.', 'AI Tip: Interactable (clickable) elements are best for automation.', 'Pro tip: Prefer visible elements for automation—hidden ones may change.', 'AI Tip: IDs are the most stable selectors—use them if available!', 'AI Tip: XPath lets you select by text, attribute, or position.', 'AI Tip: Use CSS selectors for faster automation scripts.', 'AI Tip: Filter by element type for faster locator selection.', 'Pro tip: Combine CSS classes for more unique selectors.'];

// ---- Element Inspector State ----
let isInspectingGlobal = false; // Tracks if inspect mode is active

// ---- Pagination State ----
let currentPage = 1;
let itemsPerPage = 15;
let currentFilteredData = [];
let showAllMode = false;
let allOriginalData = []; // Store the complete dataset

// ---- On Load: Setup UI, Restore Table ----
document.addEventListener('DOMContentLoaded', async () => {
  // Show random tip at top
  document.getElementById('ai-tip').textContent = aiTips[Math.floor(Math.random() * aiTips.length)];

  // Start with only the most common interactive elements selected by default
  document.getElementById('filterAll').checked = false;
  // By default, only select the most commonly used interactive elements
  const defaultSelectedTypes = ['filterLinks', 'filterButtons', 'filterInputs'];
  elementTypeList.forEach(type => {
    document.getElementById(type.id).checked = defaultSelectedTypes.includes(type.id);
  });

  // Check for recent inspection data and display it
  checkForRecentInspectionData();

  // Restore last data (if any) from storage for user
  try {
    chrome.storage.local.get(['lastExtractedData'], res => {
      if (chrome.runtime.lastError) {
        console.log("Element AI Extractor: Error accessing storage on popup load:", chrome.runtime.lastError.message);
        return;
      }
      if (res.lastExtractedData && Array.isArray(res.lastExtractedData)) {
        renderElementsTable(res.lastExtractedData);
        document.getElementById('status').textContent = 'Previous extraction loaded.';
      }
    });
  } catch (error) {
    console.log("Element AI Extractor: Storage access error on popup load:", error.message);
  }

  // ---- MAIN: Extraction Button Click Handler ----
  document.getElementById('extract').onclick = async () => {
    const extractBtn = document.getElementById('extract');
    extractBtn.disabled = true;
    document.getElementById('status').textContent = '🔍 Extracting elements...';
    
    const failTimeout = setTimeout(() => {
      document.getElementById('status').textContent = '❌ Extraction timeout. Try again.';
      extractBtn.disabled = false;
    }, 8000);
    
    const filters = getCurrentFilters(); // <-- Ensure filters are always up-to-date
    const tabInfo = await getCurrentTabInfo();
    
    if (tabInfo.isRestricted) {
      document.getElementById('status').textContent = '❌ Cannot extract from this page (restricted).';
      extractBtn.disabled = false;
      clearTimeout(failTimeout);
      return;
    }
    
    chrome.scripting.executeScript(
      {
        target: {tabId: tabInfo.tabId},
        args: [filters],
        func: domExtractionFunction
      },
      results => {
        clearTimeout(failTimeout);

        if (!results || !results[0] || !results[0].result) {
          document.getElementById('status').textContent = '❌ Injection or extraction failed!';
          extractBtn.disabled = false;
          return;
        }

        if (chrome.runtime.lastError) {
          document.getElementById('status').textContent = '❌ Script injection failed: ' + chrome.runtime.lastError.message;
          extractBtn.disabled = false;
          return;
        }
        if (!results || !Array.isArray(results) || !results[0] || !results[0].result) {
          document.getElementById('status').textContent = '❌ Extraction failed or blocked on this page.';
          extractBtn.disabled = false;
          return;
        }
        let elementDataList = results[0].result;
        // Save latest result for preview even if popup is closed
        try {
          chrome.storage.local.set({lastExtractedData: elementDataList});
          if (chrome.runtime.lastError) {
            console.warn("Element AI Extractor: Storage set warning:", chrome.runtime.lastError.message);
          }
        } catch (error) {
          console.warn("Element AI Extractor: Failed to save extracted data:", error.message);
        }
        if (!elementDataList.length) {
          document.getElementById('status').textContent = 'No elements found.';
          document.getElementById('preview').innerHTML = '';
          extractBtn.disabled = false;
          return;
        }
        document.getElementById('status').textContent = 'Scanned elements!';
        
        // Reset pagination for new data
        resetToFirstPage();
        
        renderElementsTable(elementDataList);
        updateStatsDisplay(elementDataList);
        // Get selected export format and compose filename
        let exportFormat = document.getElementById('exportFormat').value;
        
        // Only download files for non-Table formats
        if (exportFormat !== 'table') {
          let now = new Date();
          let timestamp = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
          let filename = `${hostname}_elements_${timestamp}`;
          
          // Download in selected format
          switch(exportFormat) {
            case 'json':
              downloadJSONFile(elementDataList, filename + '.json');
              break;
            case 'excel':
              downloadExcelFile(elementDataList, filename + '.xls');
              break;
            case 'csv':
              downloadCSVFile(elementDataList, filename + '.csv');
              break;
          }
        }
        setTimeout(() => (extractBtn.disabled = false), 1100);
      }
    );
  };
});

// ---- Supported Element Types ----
const elementTypeList = [
  {id: 'filterLinks', label: 'Links', selector: 'a'},
  {id: 'filterButtons', label: 'Buttons', selector: "button,input[type='button'],input[type='submit']"},
  {id: 'filterInputs', label: 'Inputs', selector: 'input,select,textarea'},
  {id: 'filterCombo', label: 'Combo', selector: "select,[role='combobox']"},
  {id: 'filterTextboxes', label: 'Textboxes', selector: "input[type='text'],input[type='search'],input[type='email'],input[type='url'],input[type='password']"},
  {id: 'filterCheckboxes', label: 'Checkboxes', selector: "input[type='checkbox']"},
  {id: 'filterRadios', label: 'Radios', selector: "input[type='radio']"},
  {id: 'filterLists', label: 'Lists', selector: 'ul,ol,li,dl,dt,dd'},
  {id: 'filterForms', label: 'Forms', selector: 'form'},
  {id: 'filterImages', label: 'Images', selector: 'img'},
  {id: 'filterIframes', label: 'Iframes', selector: 'iframe'},
  {id: 'filterCustom', label: 'Custom Elements', selector: '*'}
];

// ---- ALL ELEMENTS toggle logic ----
const filterAllBox = document.getElementById('filterAll');
filterAllBox.addEventListener('change', function () {
  elementTypeList.forEach(type => {
    // When "All Elements" is checked, enable all non-custom types
    // When unchecked, uncheck all types
    if (this.checked) {
      if (type.id !== 'filterCustom') {
        document.getElementById(type.id).checked = true;
      }
    } else {
      document.getElementById(type.id).checked = false;
    }
  });
});
elementTypeList.forEach(type => {
  document.getElementById(type.id).addEventListener('change', function () {
    if (!this.checked) {
      filterAllBox.checked = false;
    } else {
      // Check if all non-custom element types are checked
      const nonCustomTypes = elementTypeList.filter(t => t.id !== 'filterCustom');
      filterAllBox.checked = nonCustomTypes.every(type => document.getElementById(type.id).checked);
    }
  });
});

// ---- Visible/Hidden mutually exclusive logic ----
document.getElementById('filterVisible').addEventListener('change', function () {
  if (this.checked) document.getElementById('filterHidden').checked = false;
});
document.getElementById('filterHidden').addEventListener('change', function () {
  if (this.checked) document.getElementById('filterVisible').checked = false;
});

// ---- Utility: Get Filters State from UI ----
function getCurrentFilters() {
  return {
    selectedTypes: elementTypeList.filter(type => document.getElementById(type.id).checked).map(type => type.id),
    shadowDOM: document.getElementById('filterShadow').checked,
    visibleOnly: document.getElementById('filterVisible').checked,
    hiddenOnly: document.getElementById('filterHidden').checked
  };
}

// ---- Utility: Check if URL is restricted ----
function isRestrictedUrl(url) {
  if (!url) return true;
  const restrictedProtocols = ['chrome:', 'chrome-extension:', 'moz-extension:', 'edge:', 'about:', 'data:', 'javascript:'];
  const restrictedPages = ['chrome.google.com/webstore', 'addons.mozilla.org', 'microsoftedge.microsoft.com'];
  
  return restrictedProtocols.some(protocol => url.startsWith(protocol)) ||
         restrictedPages.some(page => url.includes(page));
}

// ---- Utility: Get current active tab info ----
async function getCurrentTabInfo() {
  let [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  try {
    const url = new URL(tab.url);
    return {
      hostname: url.hostname, 
      tabId: tab.id, 
      url: tab.url,
      isRestricted: isRestrictedUrl(tab.url)
    };
  } catch (e) {
    return {
      hostname: 'site', 
      tabId: tab.id, 
      url: tab.url || '',
      isRestricted: true
    };
  }
}

// ---- Utility: Case-insensitive match for search ----
function nameMatchesSearch(name, search) {
  if (!search) return true;
  return (name || '').toLowerCase().includes(search.toLowerCase());
}

// ---- Utility: Clipboard Copy ----
function copyLocatorToClipboard(text) {
  navigator.clipboard.writeText(text);
}

// ---- Utility: Highlight Element on Tab ----
function highlightElementOnTab(tabId, locator, inShadowDOM) {
  chrome.scripting.executeScript({
    target: {tabId},
    args: [locator, inShadowDOM],
    func: (locator, inShadowDOM) => {
      let el = null;
      if (inShadowDOM) {
        function searchShadowRoots(node, selector) {
          if (!node) return null;
          if (node.querySelector) {
            let found = node.querySelector(selector);
            if (found) return found;
          }
          let children = node.children || [];
          for (let child of children) {
            if (child.shadowRoot) {
              let found = searchShadowRoots(child.shadowRoot, selector);
              if (found) return found;
            }
          }
          return null;
        }
        el = searchShadowRoots(document, locator);
      } else {
        if (locator.startsWith('#')) {
          el = document.querySelector(locator);
        } else if (locator.startsWith('/')) {
          let r = document.evaluate(locator, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
          el = r.singleNodeValue;
        } else {
          el = document.querySelector(locator);
        }
      }
      if (el) {
        el.scrollIntoView({behavior: 'smooth', block: 'center'});
        el.style.outline = '3px solid #ff0000';
        setTimeout(() => {
          el.style.outline = '';
        }, 1500);
      }
    }
  });
}

// ---- Utility: HTML Escape for Attributes ----
function escapeHtml(text) {
  if (!text) return '';
  return text.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---- CSV Download Helper ----
function downloadCSVFile(elementList, filename) {
  const headers = ['Element Name', 'Element Type', 'Best Locator', 'ID', 'CSS', 'XPATH', 'In Shadow DOM'];
  const csvRows = [headers.join(',')].concat(elementList.map(row => headers.map(h => `"${(row[h] + '').replace(/"/g, '""')}"`).join(',')));
  const blob = new Blob([csvRows.join('\n')], {type: 'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  document.getElementById('status').textContent = `Your locators are ready: ${filename}`;
}

// ---- JSON Download Helper ----
function downloadJSONFile(elementList, filename) {
  const jsonData = {
    extractedAt: new Date().toISOString(),
    hostname: window.location.hostname,
    totalElements: elementList.length,
    elements: elementList
  };
  const blob = new Blob([JSON.stringify(jsonData, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  document.getElementById('status').textContent = `JSON export ready: ${filename}`;
}

// ---- Excel Download Helper ----
function downloadExcelFile(elementList, filename) {
  const headers = ['Element Name', 'Element Type', 'Best Locator', 'Locator Type', 'ID', 'CSS', 'XPATH', 'In Shadow DOM'];
  let excelContent = '<table border="1">';
  excelContent += '<tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr>';
  elementList.forEach(row => {
    excelContent += '<tr>' + headers.map(h => `<td>${row[h] || ''}</td>`).join('') + '</tr>';
  });
  excelContent += '</table>';
  
  const blob = new Blob([excelContent], {type: 'application/vnd.ms-excel'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  document.getElementById('status').textContent = `Excel export ready: ${filename}`;
}

// ---- MAIN: Extraction Button Click Handler (moved to DOMContentLoaded) ----

/**
 * ---- DOM Extraction Logic (IN-PAGE CONTEXT) ----
 * Gathers and returns all elements per filters from the DOM.
 * Variable and function names are clear and consistent.
 * @param {Object} filters - from UI: {selectedTypes, shadowDOM, visibleOnly, hiddenOnly}
 * @returns {Array<Object>} array of element info
 */

// -- ADVANCED DOM EXTRACTION FUNCTION WITH SHADOW DOM SUPPORT -- //
// (This function runs inside the page context)
function domExtractionFunction(filters) {
    // Map filters to selectors
    const typeToSelectorMapInjected = {
        filterLinks: 'a',
        filterButtons: "button,input[type='button'],input[type='submit']",
        filterInputs: 'input,select,textarea',
        filterCombo: "select,[role='combobox']",
        filterTextboxes: "input[type='text'],input[type='search'],input[type='email'],input[type='url'],input[type='password']",
        filterCheckboxes: "input[type='checkbox']",
        filterRadios: "input[type='radio']",
        filterLists: 'ul,ol,li,dl,dt,dd',
        filterForms: 'form',
        filterImages: 'img',
        filterIframes: 'iframe',
        filterCustom: '*'
    };

    // Helper functions operating within context (document or shadowRoot)
    function isVisible(el) {
        if (!el || typeof el.getBoundingClientRect !== 'function') return false;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return false;
        const style = window.getComputedStyle(el);
        return style && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    }

    function getUniqueCssSelector(el, contextNode) {
        if (!el || typeof el.getAttribute !== 'function') return 'invalid_element';
        if (el.id) {
            const idSelector = `#${CSS.escape(el.id)}`;
            try {
                if (contextNode.querySelectorAll(idSelector).length === 1) {
                    return idSelector;
                }
            } catch (e) {
                console.warn("Invalid selector generated (id):", idSelector, e.message);
            }
        }
        let path = [];
        let currentEl = el;
        while (currentEl && currentEl !== contextNode && currentEl.nodeType === Node.ELEMENT_NODE) {
            let selector = currentEl.nodeName.toLowerCase();
            if (currentEl.id) {
                selector = `#${CSS.escape(currentEl.id)}`;
                path.unshift(selector);
                break;
            } else if (currentEl.classList && currentEl.classList.length > 0) {
                selector += '.' + Array.from(currentEl.classList).map(c => CSS.escape(c)).join('.');
            }
            const parent = currentEl.parentNode;
            if (parent && parent !== contextNode) {
                const siblings = Array.from(parent.children).filter(sibling => sibling.nodeName === currentEl.nodeName);
                if (siblings.length > 1) {
                    // Use nth-of-type for same tag name elements, or nth-child for position among all elements
                    const sameTagIndex = siblings.indexOf(currentEl) + 1;
                    const allSiblingsIndex = Array.from(parent.children).indexOf(currentEl) + 1;
                    
                    // Prefer nth-of-type if there are multiple elements of the same type
                    if (siblings.length > 1) {
                        selector += `:nth-of-type(${sameTagIndex})`;
                    } else {
                        selector += `:nth-child(${allSiblingsIndex})`;
                    }
                }
            }
            path.unshift(selector);
            currentEl = parent;
            if (!currentEl || currentEl === contextNode) break;
        }
        return path.join(' > ') || 'unknown';
    }

    function getXPath(el, contextNode) {
        if (!el) return 'invalid_element';
        if (el.id) return `//*[@id="${el.id}"]`;
        
        let path = [];
        let currentEl = el;
        while (currentEl && currentEl !== contextNode && currentEl.nodeType === Node.ELEMENT_NODE) {
            let idx = 1;
            let sib = currentEl.previousSibling;
            while (sib) {
                if (sib.nodeType === Node.ELEMENT_NODE && sib.tagName === currentEl.tagName) idx++;
                sib = sib.previousSibling;
            }
            path.unshift(`${currentEl.tagName.toLowerCase()}[${idx}]`);
            currentEl = currentEl.parentNode;
            if (currentEl === contextNode) break;
        }
        return '/' + path.join('/');
    }

    function getBestLocator(el, contextNode) {
        if (!el) return {type: 'invalid', locator: 'invalid_element', reason: 'null element'};

        // 1. Test automation attributes (highest priority)
        const testAttributes = ['data-testid', 'data-qa', 'data-cy', 'data-test'];
        for (let attr of testAttributes) {
            let val = el.getAttribute(attr);
            if (val) {
                const locator = `[${attr}="${val}"]`;
                try {
                    if (contextNode.querySelectorAll(locator).length === 1) {
                        return {type: attr, locator: locator, reason: `unique ${attr} in context`};
                    }
                } catch(e) {
                    console.warn("Invalid selector generated (test attribute):", locator, e.message);
                }
            }
        }

        // 2. ID attribute
        if (el.id) {
            const locator = `#${CSS.escape(el.id)}`;
            try {
                if (contextNode.querySelectorAll(locator).length === 1) {
                    return {type: 'id', locator: locator, reason: 'unique id in context'};
                }
            } catch(e) {
                console.warn("Invalid selector generated (id):", locator, e.message);
            }
        }

        // 3. Accessibility attributes
        const accessibilityAttrs = ['aria-label', 'aria-labelledby'];
        for (let attr of accessibilityAttrs) {
            let val = el.getAttribute(attr);
            if (val && val.length < 100) {
                const locator = `[${attr}="${val}"]`;
                try {
                    if (contextNode.querySelectorAll(locator).length === 1) {
                        return {type: attr, locator: locator, reason: `unique ${attr} in context`};
                    }
                } catch(e) {
                    console.warn("Invalid selector generated (accessibility):", locator, e.message);
                }
            }
        }

        // 4. Role attribute
        if (el.getAttribute('role')) {
            const locator = `[role="${el.getAttribute('role')}"]`;
            try {
                if (contextNode.querySelectorAll(locator).length === 1) {
                    return {type: 'role', locator: locator, reason: 'unique role in context'};
                }
            } catch(e) {
                console.warn("Invalid selector generated (role):", locator, e.message);
            }
        }

        // 5. Name attribute
        if (el.getAttribute('name')) {
            const locator = `[name="${el.getAttribute('name')}"]`;
            try {
                if (contextNode.querySelectorAll(locator).length === 1) {
                    return {type: 'name', locator: locator, reason: 'unique name in context'};
                }
            } catch(e) {
                console.warn("Invalid selector generated (name):", locator, e.message);
            }
        }

        // 6. Unique class name
        if (el.classList && el.classList.length > 0) {
            const commonOrLayoutClasses = /^(active|selected|open|show|hide|enabled|disabled|focus|container|wrapper|inner|outer|item|element|block|layout|grid|flex)/i;
            for (let cls of el.classList) {
                if (!commonOrLayoutClasses.test(cls) && isNaN(parseInt(cls.charAt(0)))) {
                    const locator = `.${CSS.escape(cls)}`;
                    try {
                        if (contextNode.querySelectorAll(locator).length === 1) {
                            return {type: 'class', locator: locator, reason: 'unique class in context'};
                        }
                    } catch(e) {
                        console.warn("Invalid selector generated (class):", locator, e.message);
                    }
                }
            }
        }

        // 7. Text content for specific elements
        const tagNameUpper = el.tagName.toUpperCase();
        if ((tagNameUpper === 'BUTTON' || tagNameUpper === 'A' || tagNameUpper === 'SUMMARY' || el.getAttribute('role') === 'button' || el.getAttribute('role') === 'link') && el.textContent && el.textContent.trim().length > 0 && el.textContent.trim().length < 100) {
            const text = el.textContent.trim();
            const xpathForText = `.//*[self::${el.nodeName.toLowerCase()} and normalize-space(.)="${text.replace(/"/g, '&quot;')}"]`;
            try {
                let matches = [];
                let xpathResult = contextNode.evaluate(xpathForText, contextNode, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
                let node;
                while(node = xpathResult.iterateNext()) { matches.push(node); }

                if (matches.length === 1 && matches[0] === el) {
                     return {type: 'text (XPath)', locator: xpathForText, reason: 'unique text content (XPath)'};
                }
            } catch(e) { console.warn("XPath text search error", e); }
        }

        // 8. Fallback to generated CSS selector
        return {type: 'css', locator: getUniqueCssSelector(el, contextNode), reason: 'auto-generated CSS in context'};
    }

    function getElementDisplayName(el) {
        const preferredAttrs = ['aria-label', 'data-name', 'title', 'placeholder', 'alt'];
        for (const attr of preferredAttrs) {
            const val = el.getAttribute(attr);
            if (val) return val.trim().slice(0, 70);
        }
        if (el.textContent) {
            let text = el.textContent.trim().replace(/\s+/g, ' ').slice(0, 70);
            if (text) return text;
        }
        if (el.value && typeof el.value === 'string') {
             let text = el.value.trim().replace(/\s+/g, ' ').slice(0, 70);
             if (text) return text;
        }
        return el.id || el.name || el.tagName.toLowerCase();
    }
    
    function getElementTypeName(el) {
        if (el.matches('a')) return 'LINK';
        if (el.matches("button,input[type='button'],input[type='submit'],[role='button']")) return 'BTN';
        if (el.matches("input[type='text'],input[type='search'],input[type='email'],input[type='url'],input[type='password'],input:not([type]),textarea")) return 'TXTBOX';
        if (el.matches("input[type='checkbox'],[role='checkbox']")) return 'CHKBOX';
        if (el.matches("input[type='radio'],[role='radio']")) return 'RADIO';
        if (el.matches("select,[role='combobox'],[role='listbox']")) return 'COMBO';
        if (el.matches('h1,h2,h3,h4,h5,h6,[role="heading"]')) return 'HEADER';
        if (el.matches('ul,ol,li,dl,dt,dd,[role="list"],[role="listitem"]')) return 'LIST';
        if (el.matches('form,[role="form"]')) return 'FORM';
        if (el.matches('svg,svg *')) return 'SVG';
        if (el.matches('table,thead,tbody,tr,td,th,[role="grid"],[role="row"],[role="gridcell"],[role="columnheader"],[role="rowheader"]')) return 'TABLE';
        if (el.matches('span')) return 'SPAN';
        if (el.matches('div')) return 'DIV';
        if (el.tagName && el.tagName.includes('-')) return 'CUSTOM';
        if (el.matches('img,[role="img"]')) return 'IMG';
        if (el.matches('nav,[role="navigation"]')) return 'NAV';
        if (el.matches('main,[role="main"]')) return 'MAIN';
        if (el.matches('article,[role="article"]')) return 'ARTICLE';
        if (el.matches('aside,[role="complementary"]')) return 'ASIDE';
        if (el.matches('section')) return 'SECTION';
        if (el.matches('header')) return 'HDR_ELM';
        if (el.matches('footer')) return 'FTR_ELM';
        if (el.matches('p')) return 'PARAGRAPH';
        if (el.matches('iframe')) return 'IFRAME';
        return el.tagName ? el.tagName.toUpperCase() : 'UNKNOWN';
    }

    // Recursive extraction function for Shadow DOM traversal
    function _extractElementsRecursive(contextNode, isShadowContext, currentHostPathArray) {
        let collectedData = [];
        
        // Build selectors based on filters
        let activeSelectorArray = [];
        for (let filterType of filters.selectedTypes) {
            if (typeToSelectorMapInjected[filterType]) {
                activeSelectorArray.push(typeToSelectorMapInjected[filterType]);
            }
        }
        
        
        let combinedSelector = activeSelectorArray.join(',') || '*';
        
        let elements = [];
        try {
            if (combinedSelector === '*') {
                elements = Array.from(contextNode.querySelectorAll('*')).filter(el => {
                    const tagName = el.tagName.toLowerCase();
                    const hasInteractiveRole = el.getAttribute('role');
                    const isInteractive = el.onclick || el.onchange || el.onsubmit;
                    const hasImportantAttrs = el.id || el.className || el.name || el.getAttribute('data-testid') || el.getAttribute('aria-label');
                    
                    if (['html', 'head', 'body', 'meta', 'title', 'script', 'style', 'link', 'noscript'].includes(tagName)) {
                        return false;
                    }
                    
                    return hasInteractiveRole || isInteractive || hasImportantAttrs || 
                           ['button', 'input', 'select', 'textarea', 'a', 'form', 'img', 'iframe'].includes(tagName);
                });
            } else {
                elements = Array.from(contextNode.querySelectorAll(combinedSelector));
            }
        } catch (e) {
            console.warn('Selector error in context:', combinedSelector, e.message);
            elements = [];
        }

        // Process elements in this context
        for (let el of elements) {
            // Apply visibility filters
            if (filters.visibleOnly && !isVisible(el)) continue;
            if (filters.hiddenOnly && isVisible(el)) continue;

            // Get locators and info relative to current context
            let bestLocatorInfo = getBestLocator(el, contextNode);
            let localCssSelector = getUniqueCssSelector(el, contextNode);
            let localXPath = getXPath(el, contextNode);
            let localId = el.id || '';

            // Prepare final locators with shadow path if needed
            let finalCssSelector = localCssSelector;
            let finalXPath = localXPath;
            let finalBestLocator = bestLocatorInfo.locator;
            let hostPathString = isShadowContext ? currentHostPathArray.join(' >> ') : '';

            if (isShadowContext && hostPathString) {
                finalCssSelector = `${hostPathString} >> ${localCssSelector}`;
                if (['data-testid', 'data-qa', 'data-cy', 'data-test', 'aria-label', 'aria-labelledby', 'role', 'name', 'id', 'class', 'css'].includes(bestLocatorInfo.type)) {
                    finalBestLocator = `${hostPathString} >> ${bestLocatorInfo.locator}`;
                }
            }
            
            let displayName = getElementDisplayName(el);
            let elementType = getElementTypeName(el);

            // Calculate locator strength
            let strength = 50; // Base score
            if (bestLocatorInfo.type === 'id') strength = 95;
            else if (['data-testid', 'data-qa', 'data-cy', 'data-test'].includes(bestLocatorInfo.type)) strength = 90;
            else if (['aria-label', 'aria-labelledby'].includes(bestLocatorInfo.type)) strength = 85;
            else if (bestLocatorInfo.type === 'role') strength = 75;
            else if (bestLocatorInfo.type === 'name') strength = 80;
            else if (bestLocatorInfo.type === 'class') strength = 65;
            else if (bestLocatorInfo.type === 'text (XPath)') strength = 40;
            else if (bestLocatorInfo.type === 'css') {
                const selectorParts = localCssSelector.split(' > ').length;
                strength = Math.max(20, 60 - (selectorParts * 5));
            }

            // Correctly determine if element is actually in shadow DOM
            const elementIsInShadowDOM = el.getRootNode() instanceof ShadowRoot;
            
            collectedData.push({
                'Element Name': displayName,
                'Element Type': elementType,
                'Best Locator': finalBestLocator,
                'Locator Type': bestLocatorInfo.type,
                'Strength': Math.min(100, Math.max(10, strength)),
                'Why Best': bestLocatorInfo.reason,
                ID: localId,
                CSS: finalCssSelector,
                XPATH: localXPath,
                'In Shadow DOM': elementIsInShadowDOM ? 'Yes' : '',
                'Host Element Path': hostPathString
            });

            // Recurse into Shadow DOM if enabled and shadow root exists
            if (el.shadowRoot && filters.shadowDOM) {
                let selectorForHostInPath;
                const hostBestLocator = getBestLocator(el, contextNode);
                if (hostBestLocator.type === 'id') {
                    selectorForHostInPath = hostBestLocator.locator;
                } else {
                    selectorForHostInPath = getUniqueCssSelector(el, contextNode);
                }
                
                const newHostPath = [...currentHostPathArray, selectorForHostInPath];
                collectedData = collectedData.concat(
                    _extractElementsRecursive(el.shadowRoot, true, newHostPath)
                );
            }
        }
        return collectedData;
    }

    // Start recursive extraction from document
    let allExtractedData = _extractElementsRecursive(document, false, []);
    
    // Apply max results limit
    const maxResultsLimit = filters.maxResults || 2000;
    if (allExtractedData.length > maxResultsLimit) {
        console.warn(`Element AI Extractor: Truncated results from ${allExtractedData.length} to ${maxResultsLimit}`);
        allExtractedData = allExtractedData.slice(0, maxResultsLimit);
    }
    
    return allExtractedData;
}

// ---- Update Pagination Controls ----
function updatePaginationControls() {
  const paginationControls = document.getElementById('paginationControls');
  const currentPageSpan = document.getElementById('currentPage');
  const totalPagesSpan = document.getElementById('totalPages');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const showAllBtn = document.getElementById('showAllBtn');
  
  if (!paginationControls) return; // Pagination controls not available
  
  const totalItems = currentFilteredData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  
  // Hide pagination if all items fit on one page and not in show all mode
  if (totalItems <= itemsPerPage && !showAllMode) {
    paginationControls.style.display = 'none';
    return;
  }
  
  // Show pagination controls
  paginationControls.style.display = 'flex';
  
  if (showAllMode) {
    if (currentPageSpan) currentPageSpan.textContent = 'All';
    if (totalPagesSpan) totalPagesSpan.textContent = 'All';
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    if (showAllBtn) {
      showAllBtn.textContent = 'Show Pages';
      showAllBtn.title = 'Show paginated view';
      showAllBtn.classList.add('active');
    }
  } else {
    if (currentPageSpan) currentPageSpan.textContent = currentPage;
    if (totalPagesSpan) totalPagesSpan.textContent = totalPages;
    if (prevBtn) prevBtn.disabled = currentPage <= 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
    if (showAllBtn) {
      showAllBtn.textContent = 'Show All';
      showAllBtn.title = 'Show all elements';
      showAllBtn.classList.remove('active');
    }
  }
}

// ---- Reset to First Page ----
function resetToFirstPage() {
  currentPage = 1;
  showAllMode = false;
  
  // Ensure Show All button state is reset
  const showAllBtn = document.getElementById('showAllBtn');
  if (showAllBtn) {
    showAllBtn.textContent = 'Show All';
    showAllBtn.title = 'Show all elements';
    showAllBtn.classList.remove('active');
  }
}

// ---- RENDER: Table of elements (Preview) ----
function renderElementsTable(data) {
  // Store the original data for pagination
  allOriginalData = data;
  
  // Apply current filters
  currentFilteredData = applyFilters(data);
  
  // Apply search
  const search = document.getElementById('search').value;
  if (search) {
    currentFilteredData = currentFilteredData.filter(row => nameMatchesSearch(row['Element Name'], search));
  }
  
  // Update pagination
  updatePaginationControls();
  renderCurrentPage();
}

// ---- RENDER: Current page of elements ----
function renderCurrentPage() {
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageData = showAllMode ? currentFilteredData : currentFilteredData.slice(startIndex, endIndex);
  
  let previewHTML = '';
  
  if (showAllMode) {
    previewHTML = `<b>Showing all ${currentFilteredData.length} elements:</b>`;
  } else {
    const totalPages = Math.ceil(currentFilteredData.length / itemsPerPage);
    previewHTML = `<b>Page ${currentPage} of ${totalPages} (${currentFilteredData.length} total elements):</b>`;
  }
  
  previewHTML += `
    <table><tr>
    <th>Name</th>
    <th>Type</th>
    <th>Best</th>
    <th>ID</th>
    <th>CSS</th>
    <th>XPATH</th>
    <th>Shadow</th>
    <th>Copy</th>
    <th>Highlight</th></tr>`;
    
  for (let i = 0; i < pageData.length; i++) {
    let r = pageData[i];
    previewHTML += `<tr>
      <td title="${escapeHtml(r['Element Name'])}">${escapeHtml(r['Element Name'])}</td>
      <td><span class="el-badge">${escapeHtml(r['Element Type'])}</span></td>
      <td title="${escapeHtml(r['Best Locator'])}">${escapeHtml(r['Best Locator'])}</td>
      <td title="${escapeHtml(r['ID'])}">${escapeHtml(r['ID'])}</td>
      <td title="${escapeHtml(r['CSS'])}">${escapeHtml(r['CSS'])}</td>
      <td title="${escapeHtml(r['XPATH'])}">${escapeHtml(r['XPATH'])}</td>
      <td>${r['In Shadow DOM'] ? `<span class="shadow-badge">Shadow</span>` : ''}</td>
      <td><button class="copy-btn" data-copy="${escapeHtml(r['Best Locator'])}" title="Copy to clipboard">📋</button></td>
      <td><button class="hl-btn" data-hl="${escapeHtml(r['Best Locator'])}" data-shadow="${r['In Shadow DOM'] ? '1' : '0'}" title="Highlight element">👁️</button></td>
    </tr>`;
  }
  previewHTML += '</table>';
  document.getElementById('preview').innerHTML = previewHTML;
  setTimeout(() => bindTablePreviewButtons(), 100);
}

// ---- BIND: Copy/Highlight buttons in preview ----
function bindTablePreviewButtons() {
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.onclick = e => {
      let text = e.target.getAttribute('data-copy');
      copyLocatorToClipboard(text);
      btn.textContent = '✅';
      setTimeout(() => (btn.textContent = '📋'), 600);
    };
  });
  
  document.querySelectorAll('.hl-btn').forEach(btn => {
    btn.onclick = async e => {
      let locator = e.target.getAttribute('data-hl');
      let inShadowDOM = e.target.getAttribute('data-shadow') === '1';
      
      try {
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        if (tab && tab.id) {
          highlightElementOnTab(tab.id, locator, inShadowDOM);
          btn.textContent = '👀';
          setTimeout(() => (btn.textContent = '👁️'), 1000);
        }
      } catch (error) {
        console.warn("Element AI Extractor: Could not highlight element:", error.message);
      }
    };
  });
}

// ---- Update Stats Display ----
function updateStatsDisplay(elementList) {
  const elementCountEl = document.getElementById('elementCount');
  const visibilityStatsEl = document.getElementById('visibilityStats');
  
  if (!elementList || elementList.length === 0) {
    if (elementCountEl) elementCountEl.textContent = '0 elements found';
    if (visibilityStatsEl) visibilityStatsEl.textContent = '0 visible • 0 hidden';
    return;
  }
  
  const totalElements = elementList.length;
  const visibleElements = elementList.filter(el => !el['Hidden']).length;
  const hiddenElements = totalElements - visibleElements;
  
  if (elementCountEl) {
    elementCountEl.textContent = `${totalElements} element${totalElements !== 1 ? 's' : ''} found`;
  }
  
  if (visibilityStatsEl) {
    visibilityStatsEl.textContent = `${visibleElements} visible • ${hiddenElements} hidden`;
  }
}

// ---- Apply Filters to Data ----
function applyFilters(data) {
  const filters = getCurrentFilters();
  
  return data.filter(item => {
    // Type filters
    if (filters.selectedTypes.length > 0 && !filters.selectedTypes.includes(item['Element Type'])) {
      return false;
    }
    
    // Shadow DOM filter
    if (filters.shadowDOM && !item['In Shadow DOM']) {
      return false;
    }
    if (filters.hiddenOnly && !item['Hidden']) {
      return false;
    }
    if (filters.visibleOnly && item['Hidden']) {
      return false;
    }
    
    return true;
  });
}

// ---- Check for Recent Inspection Data ----
function checkForRecentInspectionData() {
  chrome.storage.local.get(['lastExtractedData'], res => {
    if (chrome.runtime.lastError) {
      console.log("Element AI Extractor: Error accessing storage for recent data check:", chrome.runtime.lastError.message);
      return;
    }
    if (res.lastExtractedData && Array.isArray(res.lastExtractedData) && res.lastExtractedData.length > 0) {
      document.getElementById('recentDataNotice').style.display = 'block';
    } else {
      document.getElementById('recentDataNotice').style.display = 'none';
    }
  });
}

// ---- Event Handlers for Recent Data Notice ----
document.getElementById('recentDataNoticeDismiss').onclick = function() {
  document.getElementById('recentDataNotice').style.display = 'none';
};

// ---- Pagination Event Handlers ----
document.addEventListener('DOMContentLoaded', () => {
  // Previous Page Button
  const prevBtn = document.getElementById('prevBtn');
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        updatePaginationControls();
        renderCurrentPage();
      }
    });
  }

  // Next Page Button
  const nextBtn = document.getElementById('nextBtn');
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const totalPages = Math.ceil(currentFilteredData.length / itemsPerPage);
      if (currentPage < totalPages) {
        currentPage++;
        updatePaginationControls();
        renderCurrentPage();
      }
    });
  }

  // Show All/Show Pages Toggle Button
  const showAllBtn = document.getElementById('showAllBtn');
  if (showAllBtn) {
    showAllBtn.addEventListener('click', () => {
      showAllMode = !showAllMode;
      updatePaginationControls();
      renderCurrentPage();
    });
  }

  // Clear Extractions Button
  const clearBtn = document.getElementById('clearExtractions');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      // Reset all data
      allOriginalData = [];
      currentFilteredData = [];
      currentPage = 1;
      showAllMode = false;
      
      // Clear storage
      try {
        chrome.storage.local.remove(['lastExtractedData']);
      } catch (error) {
        console.warn("Element AI Extractor: Failed to clear storage:", error.message);
      }
      
      // Clear UI
      document.getElementById('preview').innerHTML = '';
      document.getElementById('status').textContent = 'Extractions cleared.';
      
      // Hide pagination controls
      const paginationControls = document.getElementById('paginationControls');
      if (paginationControls) {
        paginationControls.style.display = 'none';
      }
      
      // Update stats
      updateStatsDisplay([]);
      
      // Hide recent data notice
      const recentDataNotice = document.getElementById('recentDataNotice');
      if (recentDataNotice) {
        recentDataNotice.style.display = 'none';
      }
    });
  }

  // Search Input Handler
  const searchInput = document.getElementById('search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      if (allOriginalData.length > 0) {
        // Reset to first page when searching
        currentPage = 1;
        showAllMode = false;
        
        // Re-render table with search filter
        renderElementsTable(allOriginalData);
      }
    });
  }
});