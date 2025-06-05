// Main Guide JavaScript Functionality

document.addEventListener('DOMContentLoaded', function() {
    initializeNavigation();
    initializeScrollEffects();
    initializeSmoothScrolling();
    initializeSearchFunctionality();
    initializeThemeToggle();
    initializeCodeHighlighting();
    initializeEnhancedFeatures();
});

// Navigation functionality
function initializeNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPage || (currentPage === '' && href === 'index.html')) {
            link.classList.add('active');
        }
        
        link.addEventListener('click', function(e) {
            // Handle internal navigation
            if (href.startsWith('#')) {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth' });
                }
            }
        });
    });
}

// Scroll effects for navigation
function initializeScrollEffects() {
    const nav = document.querySelector('.main-nav');
    let lastScrollY = window.scrollY;
    
    window.addEventListener('scroll', () => {
        const currentScrollY = window.scrollY;
        
        if (currentScrollY > 100) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }
        
        // Hide nav on scroll down, show on scroll up
        if (currentScrollY > lastScrollY && currentScrollY > 200) {
            nav.style.transform = 'translateY(-100%)';
        } else {
            nav.style.transform = 'translateY(0)';
        }
        
        lastScrollY = currentScrollY;
    });
}

// Smooth scrolling for anchor links
function initializeSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const navHeight = document.querySelector('.main-nav').offsetHeight;
                const targetPosition = target.offsetTop - navHeight - 20;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// Search functionality (if search exists)
function initializeSearchFunctionality() {
    const searchInput = document.querySelector('#search-input');
    const searchResults = document.querySelector('#search-results');
    
    if (searchInput && searchResults) {
        let searchTimeout;
        
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            const query = this.value.trim();
            
            if (query.length < 2) {
                searchResults.innerHTML = '';
                searchResults.style.display = 'none';
                return;
            }
            
            searchTimeout = setTimeout(() => {
                performSearch(query);
            }, 300);
        });
        
        // Close search results when clicking outside
        document.addEventListener('click', function(e) {
            if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
                searchResults.style.display = 'none';
            }
        });
    }
}

// Perform search across guide content
function performSearch(query) {
    const searchResults = document.querySelector('#search-results');
    const sections = document.querySelectorAll('.content-section, .feature-card, .nav-card');
    const results = [];
    
    sections.forEach(section => {
        const title = section.querySelector('h2, h3')?.textContent || '';
        const content = section.textContent.toLowerCase();
        
        if (content.includes(query.toLowerCase())) {
            results.push({
                title: title,
                content: content.substring(0, 150) + '...',
                element: section
            });
        }
    });
    
    if (results.length > 0) {
        searchResults.innerHTML = results.map(result => `
            <div class="search-result" onclick="scrollToElement('${result.element.id}')">
                <h4>${result.title}</h4>
                <p>${result.content}</p>
            </div>
        `).join('');
        searchResults.style.display = 'block';
    } else {
        searchResults.innerHTML = '<div class="search-result">No results found</div>';
        searchResults.style.display = 'block';
    }
}

// Scroll to specific element
function scrollToElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        const navHeight = document.querySelector('.main-nav').offsetHeight;
        const targetPosition = element.offsetTop - navHeight - 20;
        
        window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
        });
    }
    
    // Hide search results
    const searchResults = document.querySelector('#search-results');
    if (searchResults) {
        searchResults.style.display = 'none';
    }
}

// Theme toggle functionality
function initializeThemeToggle() {
    const themeToggle = document.querySelector('#theme-toggle');
    if (themeToggle) {
        // Check for saved theme or default to light
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        updateThemeToggle(savedTheme);
        
        themeToggle.addEventListener('click', function() {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            updateThemeToggle(newTheme);
        });
    }
}

function updateThemeToggle(theme) {
    const themeToggle = document.querySelector('#theme-toggle');
    if (themeToggle) {
        themeToggle.textContent = theme === 'light' ? '🌙' : '☀️';
        themeToggle.setAttribute('title', `Switch to ${theme === 'light' ? 'dark' : 'light'} mode`);
    }
}

// Code highlighting initialization
function initializeCodeHighlighting() {
    // Highlight all code blocks
    if (typeof Prism !== 'undefined') {
        Prism.highlightAll();
    }
}

// Copy to clipboard functionality
function initializeCopyButtons() {
    // Add copy buttons to all code blocks
    document.querySelectorAll('pre[class*="language-"]').forEach(pre => {
        if (!pre.querySelector('.copy-button')) {
            const button = document.createElement('button');
            button.className = 'copy-button';
            button.textContent = 'Copy';
            button.addEventListener('click', () => copyCodeToClipboard(pre, button));
            pre.appendChild(button);
        }
    });
}

function copyCodeToClipboard(codeBlock, button) {
    const code = codeBlock.querySelector('code');
    const text = code ? code.textContent : codeBlock.textContent;
    
    navigator.clipboard.writeText(text).then(() => {
        button.textContent = 'Copied!';
        button.style.background = 'var(--success-color)';
        
        setTimeout(() => {
            button.textContent = 'Copy';
            button.style.background = 'var(--primary-color)';
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
        button.textContent = 'Failed';
        button.style.background = 'var(--error-color)';
        
        setTimeout(() => {
            button.textContent = 'Copy';
            button.style.background = 'var(--primary-color)';
        }, 2000);
    });
}

// Enhanced search functionality
function initializeAdvancedSearch() {
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    let searchIndex = [];
    
    // Build search index from all content
    function buildSearchIndex() {
        const content = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, code');
        searchIndex = Array.from(content).map(element => ({
            text: element.textContent,
            element: element,
            weight: getElementWeight(element.tagName)
        }));
    }
    
    function getElementWeight(tagName) {
        const weights = {
            'H1': 10,
            'H2': 8,
            'H3': 6,
            'H4': 4,
            'CODE': 7,
            'P': 1,
            'LI': 2
        };
        return weights[tagName] || 1;
    }
    
    function performSearch(query) {
        if (!query || query.length < 2) {
            hideSearchResults();
            return;
        }
        
        const results = searchIndex
            .filter(item => item.text.toLowerCase().includes(query.toLowerCase()))
            .sort((a, b) => b.weight - a.weight)
            .slice(0, 10);
        
        displaySearchResults(results, query);
    }
    
    function displaySearchResults(results, query) {
        if (results.length === 0) {
            searchResults.innerHTML = '<div class="search-no-results">No results found</div>';
        } else {
            searchResults.innerHTML = results.map(result => {
                const highlighted = highlightText(result.text, query);
                return `<div class="search-result-item" onclick="scrollToElement('${result.element.id}')">${highlighted}</div>`;
            }).join('');
        }
        searchResults.style.display = 'block';
    }
    
    function highlightText(text, query) {
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }
    
    function hideSearchResults() {
        searchResults.style.display = 'none';
    }
    
    if (searchInput) {
        buildSearchIndex();
        searchInput.addEventListener('input', (e) => {
            performSearch(e.target.value);
        });
        
        // Hide results when clicking outside
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
                hideSearchResults();
            }
        });
    }
}

// Table of contents generator
function generateTableOfContents() {
    const tocContainer = document.getElementById('table-of-contents');
    if (!tocContainer) return;
    
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    if (headings.length === 0) return;
    
    const tocList = document.createElement('ul');
    tocList.className = 'toc-list';
    
    headings.forEach((heading, index) => {
        // Add ID to heading if it doesn't have one
        if (!heading.id) {
            heading.id = `heading-${index}`;
        }
        
        const tocItem = document.createElement('li');
        tocItem.className = `toc-item toc-${heading.tagName.toLowerCase()}`;
        
        const tocLink = document.createElement('a');
        tocLink.href = `#${heading.id}`;
        tocLink.textContent = heading.textContent;
        tocLink.className = 'toc-link';
        
        tocItem.appendChild(tocLink);
        tocList.appendChild(tocItem);
    });
    
    tocContainer.appendChild(tocList);
}

// Progress indicator
function initializeProgressIndicator() {
    const progressBar = document.querySelector('.progress-bar');
    if (!progressBar) return;
    
    window.addEventListener('scroll', () => {
        const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = (window.scrollY / totalHeight) * 100;
        progressBar.style.width = `${Math.min(progress, 100)}%`;
    });
}

// Image lazy loading
function initializeLazyLoading() {
    const images = document.querySelectorAll('img[data-src]');
    
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                observer.unobserve(img);
            }
        });
    });
    
    images.forEach(img => imageObserver.observe(img));
}

// Keyboard shortcuts
function initializeKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + K for search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            const searchInput = document.getElementById('search-input');
            if (searchInput) {
                searchInput.focus();
            }
        }
        
        // Escape to close search results
        if (e.key === 'Escape') {
            const searchResults = document.getElementById('search-results');
            if (searchResults) {
                searchResults.style.display = 'none';
            }
        }
    });
}

// Print styles
function initializePrintSupport() {
    window.addEventListener('beforeprint', () => {
        // Expand all collapsed sections
        document.querySelectorAll('.collapsible').forEach(section => {
            section.classList.add('expanded');
        });
        
        // Show all hidden content
        document.querySelectorAll('.print-hidden').forEach(element => {
            element.style.display = 'none';
        });
    });
}

// Initialize all enhanced features
function initializeEnhancedFeatures() {
    initializeCopyButtons();
    initializeAdvancedSearch();
    generateTableOfContents();
    initializeProgressIndicator();
    initializeLazyLoading();
    initializeKeyboardShortcuts();
    initializePrintSupport();
}

// Utility functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Export functions for use in other scripts
window.GuideJS = {
    scrollToElement,
    copyCode,
    performSearch,
    debounce,
    throttle
};

// Progress indicator for long pages
function initializeProgressIndicator() {
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-indicator';
    document.body.appendChild(progressBar);
    
    window.addEventListener('scroll', throttle(() => {
        const scrollTop = window.pageYOffset;
        const documentHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollPercent = (scrollTop / documentHeight) * 100;
        
        progressBar.style.width = scrollPercent + '%';
    }, 10));
}

// Initialize progress indicator
if (document.body.scrollHeight > window.innerHeight * 2) {
    initializeProgressIndicator();
}

// Initialize animations when page loads
setTimeout(initializeAnimations, 100);
