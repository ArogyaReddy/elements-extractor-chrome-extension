// Search Index for Elements Extractor Documentation
// This file contains searchable content from all guide pages

const searchIndex = {
    pages: [
        {
            id: 'index',
            title: 'Elements Extractor Documentation',
            url: 'index.html',
            keywords: ['elements', 'extractor', 'chrome', 'extension', 'automation', 'testing', 'locators', 'selectors'],
            content: 'Elements Extractor Chrome Extension comprehensive documentation guide features smart detection locator generation inspector export'
        },
        {
            id: 'getting-started',
            title: 'Getting Started Guide',
            url: 'getting-started.html',
            keywords: ['installation', 'setup', 'configuration', 'getting started', 'first time', 'install'],
            content: 'Installation setup configuration Chrome extension developer mode load unpacked manifest permissions'
        },
        {
            id: 'architecture',
            title: 'Architecture Documentation',
            url: 'architecture.html',
            keywords: ['architecture', 'technical', 'design', 'components', 'system', 'structure'],
            content: 'Technical architecture system design components data flow performance content script popup background'
        },
        {
            id: 'features',
            title: 'Features Documentation',
            url: 'features.html',
            keywords: ['features', 'capabilities', 'detection', 'locators', 'inspector', 'export'],
            content: 'Smart detection element scanning locator generation CSS XPath inspector export formats'
        },
        {
            id: 'api-reference',
            title: 'API Reference',
            url: 'api-reference.html',
            keywords: ['api', 'functions', 'methods', 'reference', 'documentation', 'code'],
            content: 'API reference functions methods scanPage findElements generateCSS generateXPath extractData'
        },
        {
            id: 'examples',
            title: 'Examples and Use Cases',
            url: 'examples.html',
            keywords: ['examples', 'use cases', 'selenium', 'playwright', 'cypress', 'automation'],
            content: 'Examples use cases Selenium WebDriver Playwright Cypress Puppeteer test automation integration'
        },
        {
            id: 'troubleshooting',
            title: 'Troubleshooting Guide',
            url: 'troubleshooting.html',
            keywords: ['troubleshooting', 'issues', 'problems', 'debugging', 'errors', 'solutions'],
            content: 'Troubleshooting common issues debugging performance problems solutions error messages'
        }
    ],
    
    functions: [
        {
            name: 'scanPage',
            description: 'Scans the current page for all interactive elements',
            page: 'api-reference.html',
            section: 'core-functions'
        },
        {
            name: 'findElements',
            description: 'Finds elements based on specified criteria',
            page: 'api-reference.html',
            section: 'detection-functions'
        },
        {
            name: 'generateCSS',
            description: 'Generates CSS selectors for elements',
            page: 'api-reference.html',
            section: 'locator-functions'
        },
        {
            name: 'generateXPath',
            description: 'Generates XPath expressions for elements',
            page: 'api-reference.html',
            section: 'locator-functions'
        },
        {
            name: 'extractData',
            description: 'Extracts element data and properties',
            page: 'api-reference.html',
            section: 'data-functions'
        },
        {
            name: 'exportResults',
            description: 'Exports results in various formats',
            page: 'api-reference.html',
            section: 'utility-functions'
        }
    ],
    
    topics: [
        {
            topic: 'Element Detection',
            description: 'How the extension identifies and analyzes web elements',
            pages: ['architecture.html', 'features.html', 'api-reference.html'],
            keywords: ['detection', 'scanning', 'analysis', 'identification']
        },
        {
            topic: 'Locator Generation',
            description: 'Creating reliable selectors for automation testing',
            pages: ['features.html', 'api-reference.html', 'examples.html'],
            keywords: ['locators', 'selectors', 'css', 'xpath', 'generation']
        },
        {
            topic: 'Test Automation',
            description: 'Integration with popular testing frameworks',
            pages: ['examples.html', 'api-reference.html'],
            keywords: ['automation', 'testing', 'selenium', 'playwright', 'cypress']
        },
        {
            topic: 'Performance',
            description: 'Optimization and performance considerations',
            pages: ['architecture.html', 'troubleshooting.html'],
            keywords: ['performance', 'optimization', 'speed', 'efficiency']
        },
        {
            topic: 'Installation',
            description: 'How to install and configure the extension',
            pages: ['getting-started.html'],
            keywords: ['install', 'setup', 'configuration', 'chrome']
        }
    ],
    
    // Search utility functions
    search: function(query) {
        const results = [];
        const searchTerm = query.toLowerCase();
        
        // Search pages
        this.pages.forEach(page => {
            let score = 0;
            
            // Title match (highest weight)
            if (page.title.toLowerCase().includes(searchTerm)) {
                score += 10;
            }
            
            // Keywords match (high weight)
            page.keywords.forEach(keyword => {
                if (keyword.toLowerCase().includes(searchTerm)) {
                    score += 5;
                }
            });
            
            // Content match (medium weight)
            if (page.content.toLowerCase().includes(searchTerm)) {
                score += 2;
            }
            
            if (score > 0) {
                results.push({
                    type: 'page',
                    title: page.title,
                    url: page.url,
                    score: score,
                    excerpt: this.getExcerpt(page.content, searchTerm)
                });
            }
        });
        
        // Search functions
        this.functions.forEach(func => {
            if (func.name.toLowerCase().includes(searchTerm) || 
                func.description.toLowerCase().includes(searchTerm)) {
                results.push({
                    type: 'function',
                    title: func.name,
                    description: func.description,
                    url: func.page + '#' + func.section,
                    score: 8
                });
            }
        });
        
        // Search topics
        this.topics.forEach(topic => {
            let score = 0;
            
            if (topic.topic.toLowerCase().includes(searchTerm)) {
                score += 6;
            }
            
            if (topic.description.toLowerCase().includes(searchTerm)) {
                score += 3;
            }
            
            topic.keywords.forEach(keyword => {
                if (keyword.toLowerCase().includes(searchTerm)) {
                    score += 2;
                }
            });
            
            if (score > 0) {
                results.push({
                    type: 'topic',
                    title: topic.topic,
                    description: topic.description,
                    pages: topic.pages,
                    score: score
                });
            }
        });
        
        // Sort by score and return
        return results.sort((a, b) => b.score - a.score);
    },
    
    getExcerpt: function(content, searchTerm) {
        const index = content.toLowerCase().indexOf(searchTerm.toLowerCase());
        if (index === -1) return content.substring(0, 100) + '...';
        
        const start = Math.max(0, index - 50);
        const end = Math.min(content.length, index + searchTerm.length + 50);
        const excerpt = content.substring(start, end);
        
        return (start > 0 ? '...' : '') + excerpt + (end < content.length ? '...' : '');
    }
};

// Export for use in guide.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = searchIndex;
}
