/**
 * Log Viewer JavaScript functionality
 * Provides enhanced interaction for the log viewer webview
 */

(function() {
    'use strict';

    // Global state
    let autoRefreshInterval = null;
    let isAutoRefreshEnabled = false;

    // Initialize when DOM is loaded
    document.addEventListener('DOMContentLoaded', function() {
        initializeLogViewer();
    });

    /**
     * Initialize the log viewer functionality
     */
    function initializeLogViewer() {
        setupKeyboardShortcuts();
        setupAutoRefresh();
        setupLogEntryInteractions();
        setupFilterPersistence();
    }

    /**
     * Setup keyboard shortcuts for log viewer
     */
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', function(event) {
            // Ctrl/Cmd + F for search
            if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
                event.preventDefault();
                focusSearch();
            }
            
            // Ctrl/Cmd + R for refresh
            if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
                event.preventDefault();
                refreshLogs();
            }
            
            // Ctrl/Cmd + S for download
            if ((event.ctrlKey || event.metaKey) && event.key === 's') {
                event.preventDefault();
                downloadLogs();
            }
            
            // F3 or Ctrl/Cmd + G for next search result
            if (event.key === 'F3' || ((event.ctrlKey || event.metaKey) && event.key === 'g')) {
                event.preventDefault();
                if (!event.shiftKey) {
                    nextMatch();
                } else {
                    previousMatch();
                }
            }
            
            // Escape to clear search
            if (event.key === 'Escape') {
                clearSearch();
            }
        });
    }

    /**
     * Focus the search input
     */
    function focusSearch() {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.focus();
            searchInput.select();
        }
    }

    /**
     * Setup auto-refresh functionality
     */
    function setupAutoRefresh() {
        // Add auto-refresh toggle button
        const actionsContainer = document.querySelector('.actions');
        if (actionsContainer) {
            const autoRefreshBtn = document.createElement('button');
            autoRefreshBtn.className = 'btn btn-secondary';
            autoRefreshBtn.innerHTML = '<span class="icon auto-refresh"></span> Auto Refresh';
            autoRefreshBtn.onclick = toggleAutoRefresh;
            actionsContainer.appendChild(autoRefreshBtn);
        }
    }

    /**
     * Toggle auto-refresh functionality
     */
    function toggleAutoRefresh() {
        const button = document.querySelector('.actions button:last-child');
        
        if (isAutoRefreshEnabled) {
            // Disable auto-refresh
            clearInterval(autoRefreshInterval);
            autoRefreshInterval = null;
            isAutoRefreshEnabled = false;
            button.innerHTML = '<span class="icon auto-refresh"></span> Auto Refresh';
            button.classList.remove('active');
        } else {
            // Enable auto-refresh (every 30 seconds)
            autoRefreshInterval = setInterval(refreshLogs, 30000);
            isAutoRefreshEnabled = true;
            button.innerHTML = '<span class="icon auto-refresh-active"></span> Auto Refresh (ON)';
            button.classList.add('active');
        }
    }

    /**
     * Setup log entry interactions
     */
    function setupLogEntryInteractions() {
        // Add click-to-copy functionality for log entries
        document.addEventListener('click', function(event) {
            const logEntry = event.target.closest('.log-entry');
            if (logEntry && event.ctrlKey) {
                copyLogEntry(logEntry);
            }
        });

        // Add double-click to expand/collapse long messages
        document.addEventListener('dblclick', function(event) {
            const message = event.target.closest('.message');
            if (message) {
                toggleMessageExpansion(message);
            }
        });
    }

    /**
     * Copy log entry to clipboard
     */
    function copyLogEntry(logEntry) {
        const timestamp = logEntry.querySelector('.timestamp').textContent;
        const level = logEntry.querySelector('.level').textContent;
        const source = logEntry.querySelector('.source')?.textContent || '';
        const message = logEntry.querySelector('.message').textContent;
        
        const logText = `[${timestamp}] [${level}] ${source ? `[${source}] ` : ''}${message}`;
        
        navigator.clipboard.writeText(logText).then(() => {
            showToast('Log entry copied to clipboard');
        }).catch(() => {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = logText;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showToast('Log entry copied to clipboard');
        });
    }

    /**
     * Toggle message expansion for long messages
     */
    function toggleMessageExpansion(messageElement) {
        if (messageElement.classList.contains('expanded')) {
            messageElement.classList.remove('expanded');
            messageElement.style.maxHeight = '';
            messageElement.style.overflow = '';
        } else {
            messageElement.classList.add('expanded');
            messageElement.style.maxHeight = 'none';
            messageElement.style.overflow = 'visible';
        }
    }

    /**
     * Setup filter persistence
     */
    function setupFilterPersistence() {
        // Load saved filters from localStorage
        loadSavedFilters();
        
        // Save filters when they change
        document.addEventListener('change', function(event) {
            if (event.target.matches('.level-filters input, #keywordFilter, #startTime, #endTime')) {
                saveFilters();
            }
        });
    }

    /**
     * Load saved filters from localStorage
     */
    function loadSavedFilters() {
        try {
            const savedFilters = localStorage.getItem('logViewerFilters');
            if (savedFilters) {
                const filters = JSON.parse(savedFilters);
                
                // Restore level filters
                if (filters.levels) {
                    document.querySelectorAll('.level-filters input').forEach(input => {
                        input.checked = filters.levels.includes(input.value);
                    });
                }
                
                // Restore keyword filter
                if (filters.keyword) {
                    const keywordInput = document.getElementById('keywordFilter');
                    if (keywordInput) {
                        keywordInput.value = filters.keyword;
                    }
                }
                
                // Restore time filters
                if (filters.startTime) {
                    const startTimeInput = document.getElementById('startTime');
                    if (startTimeInput) {
                        startTimeInput.value = filters.startTime;
                    }
                }
                
                if (filters.endTime) {
                    const endTimeInput = document.getElementById('endTime');
                    if (endTimeInput) {
                        endTimeInput.value = filters.endTime;
                    }
                }
                
                // Apply the loaded filters
                updateFilters();
            }
        } catch (error) {
            console.warn('Failed to load saved filters:', error);
        }
    }

    /**
     * Save current filters to localStorage
     */
    function saveFilters() {
        try {
            const levels = Array.from(document.querySelectorAll('.level-filters input:checked'))
                .map(input => input.value);
            const keyword = document.getElementById('keywordFilter')?.value || '';
            const startTime = document.getElementById('startTime')?.value || '';
            const endTime = document.getElementById('endTime')?.value || '';
            
            const filters = {
                levels,
                keyword,
                startTime,
                endTime
            };
            
            localStorage.setItem('logViewerFilters', JSON.stringify(filters));
        } catch (error) {
            console.warn('Failed to save filters:', error);
        }
    }

    /**
     * Show a toast notification
     */
    function showToast(message) {
        // Remove existing toast
        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            existingToast.remove();
        }
        
        // Create new toast
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 3000);
    }

    /**
     * Enhanced log entry generation with syntax highlighting
     */
    function enhanceLogDisplay() {
        const logEntries = document.querySelectorAll('.log-entry .message');
        
        logEntries.forEach(messageElement => {
            const text = messageElement.textContent;
            
            // Apply basic syntax highlighting for common patterns
            let highlightedText = text
                // Highlight file paths
                .replace(/([A-Za-z]:\\[^\\/:*?"<>|\r\n]+|\/[^\\/:*?"<>|\r\n]+)/g, '<span class="file-path">$1</span>')
                // Highlight URLs
                .replace(/(https?:\/\/[^\s]+)/g, '<span class="url">$1</span>')
                // Highlight JSON-like structures
                .replace(/(\{[^}]*\}|\[[^\]]*\])/g, '<span class="json">$1</span>')
                // Highlight numbers
                .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="number">$1</span>')
                // Highlight quoted strings
                .replace(/"([^"]*)"/g, '<span class="string">"$1"</span>');
            
            if (highlightedText !== text) {
                messageElement.innerHTML = highlightedText;
            }
        });
    }

    /**
     * Add context menu for log entries
     */
    function setupContextMenu() {
        document.addEventListener('contextmenu', function(event) {
            const logEntry = event.target.closest('.log-entry');
            if (logEntry) {
                event.preventDefault();
                showContextMenu(event, logEntry);
            }
        });
        
        // Hide context menu on click elsewhere
        document.addEventListener('click', function() {
            hideContextMenu();
        });
    }

    /**
     * Show context menu for log entry
     */
    function showContextMenu(event, logEntry) {
        hideContextMenu(); // Hide any existing menu
        
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.innerHTML = `
            <div class="context-menu-item" onclick="copyLogEntry(arguments[0])">Copy Log Entry</div>
            <div class="context-menu-item" onclick="copyMessage(arguments[0])">Copy Message Only</div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item" onclick="filterByLevel(arguments[0])">Filter by Level</div>
            <div class="context-menu-item" onclick="filterBySource(arguments[0])">Filter by Source</div>
        `;
        
        menu.style.position = 'fixed';
        menu.style.left = event.clientX + 'px';
        menu.style.top = event.clientY + 'px';
        menu.style.zIndex = '1000';
        
        document.body.appendChild(menu);
        
        // Store reference to the log entry
        menu.logEntry = logEntry;
    }

    /**
     * Hide context menu
     */
    function hideContextMenu() {
        const menu = document.querySelector('.context-menu');
        if (menu) {
            menu.remove();
        }
    }

    /**
     * Copy just the message from a log entry
     */
    function copyMessage(logEntry) {
        const message = logEntry.querySelector('.message').textContent;
        navigator.clipboard.writeText(message).then(() => {
            showToast('Message copied to clipboard');
        });
    }

    /**
     * Filter by log level
     */
    function filterByLevel(logEntry) {
        const level = logEntry.querySelector('.level').textContent.toLowerCase();
        
        // Uncheck all levels
        document.querySelectorAll('.level-filters input').forEach(input => {
            input.checked = input.value === level;
        });
        
        updateFilters();
        hideContextMenu();
    }

    /**
     * Filter by source
     */
    function filterBySource(logEntry) {
        const sourceElement = logEntry.querySelector('.source');
        if (sourceElement) {
            const source = sourceElement.textContent;
            const keywordInput = document.getElementById('keywordFilter');
            if (keywordInput) {
                keywordInput.value = source;
                updateFilters();
            }
        }
        hideContextMenu();
    }

    /**
     * Highlight search term in text
     */
    function highlightSearchTermImpl(text, term) {
        if (!term) return text;
        const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp('(' + escapedTerm + ')', 'gi');
        return text.replace(regex, '<span class="highlight">$1</span>');
    }

    // Make functions available globally for onclick handlers
    window.copyLogEntry = copyLogEntry;
    window.copyMessage = copyMessage;
    window.filterByLevel = filterByLevel;
    window.filterBySource = filterBySource;
    window.highlightSearchTermImpl = highlightSearchTermImpl;

    // Initialize enhanced features when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            enhanceLogDisplay();
            setupContextMenu();
        });
    } else {
        enhanceLogDisplay();
        setupContextMenu();
    }

})();

// Add CSS for enhanced features
const enhancedStyles = `
.toast {
    position: fixed;
    top: 20px;
    right: 20px;
    background-color: var(--vscode-notifications-background);
    color: var(--vscode-notifications-foreground);
    padding: 12px 16px;
    border-radius: 4px;
    border: 1px solid var(--vscode-notifications-border);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    z-index: 1000;
    animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
    from {
        transform: translateX(100%);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}

.context-menu {
    background-color: var(--vscode-menu-background);
    border: 1px solid var(--vscode-menu-border);
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    min-width: 150px;
}

.context-menu-item {
    padding: 8px 12px;
    cursor: pointer;
    font-size: 12px;
    color: var(--vscode-menu-foreground);
}

.context-menu-item:hover {
    background-color: var(--vscode-menu-selectionBackground);
    color: var(--vscode-menu-selectionForeground);
}

.context-menu-separator {
    height: 1px;
    background-color: var(--vscode-menu-separatorBackground);
    margin: 4px 0;
}

.file-path {
    color: var(--vscode-textLink-foreground);
    font-style: italic;
}

.url {
    color: var(--vscode-textLink-foreground);
    text-decoration: underline;
}

.json {
    color: var(--vscode-debugTokenExpression-string);
}

.number {
    color: var(--vscode-debugTokenExpression-number);
}

.string {
    color: var(--vscode-debugTokenExpression-string);
}

.message.expanded {
    max-height: none !important;
    overflow: visible !important;
}

.btn.active {
    background-color: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
}

.icon.auto-refresh::before { content: "🔄"; }
.icon.auto-refresh-active::before { content: "🔄"; animation: spin 2s linear infinite; }

@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}
`;

// Inject enhanced styles
const styleSheet = document.createElement('style');
styleSheet.textContent = enhancedStyles;
document.head.appendChild(styleSheet);