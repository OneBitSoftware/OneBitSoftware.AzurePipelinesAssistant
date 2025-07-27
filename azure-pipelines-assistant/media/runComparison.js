// Run Comparison Webview JavaScript

(function() {
    'use strict';

    // Initialize when DOM is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    function initialize() {
        setupEventListeners();
        setupTableSorting();
        setupTableFiltering();
        setupKeyboardShortcuts();
    }

    function setupEventListeners() {
        // Export button event delegation
        document.addEventListener('click', function(event) {
            if (event.target.matches('[onclick*="exportComparison"]')) {
                event.preventDefault();
                const format = event.target.getAttribute('onclick').match(/exportComparison\('(\w+)'\)/)[1];
                exportComparison(format);
            }
        });

        // Run selection event delegation
        document.addEventListener('click', function(event) {
            if (event.target.closest('.run-item')) {
                const runItem = event.target.closest('.run-item');
                if (event.target.matches('button') || event.target.closest('button')) {
                    return; // Don't handle selection for button clicks
                }
                
                const runId = parseInt(runItem.getAttribute('data-run-id') || 
                    runItem.getAttribute('onclick')?.match(/toggleRunSelection\((\d+)/)?.[1]);
                
                if (runId && typeof toggleRunSelection === 'function') {
                    toggleRunSelection(runId, runItem);
                }
            }
        });

        // Table row click handlers
        document.addEventListener('click', function(event) {
            const row = event.target.closest('tr');
            if (row && row.parentElement.tagName === 'TBODY') {
                toggleRowDetails(row);
            }
        });
    }

    function setupTableSorting() {
        const tables = document.querySelectorAll('.comparison-table table');
        
        tables.forEach(table => {
            const headers = table.querySelectorAll('th');
            
            headers.forEach((header, index) => {
                if (header.textContent.trim() && !header.classList.contains('no-sort')) {
                    header.style.cursor = 'pointer';
                    header.title = 'Click to sort';
                    
                    header.addEventListener('click', function() {
                        sortTable(table, index, header);
                    });
                }
            });
        });
    }

    function sortTable(table, columnIndex, header) {
        const tbody = table.querySelector('tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));
        
        // Determine sort direction
        const currentSort = header.getAttribute('data-sort');
        const isAscending = currentSort !== 'asc';
        
        // Clear all sort indicators
        table.querySelectorAll('th').forEach(th => {
            th.removeAttribute('data-sort');
            th.classList.remove('sort-asc', 'sort-desc');
        });
        
        // Set new sort indicator
        header.setAttribute('data-sort', isAscending ? 'asc' : 'desc');
        header.classList.add(isAscending ? 'sort-asc' : 'sort-desc');
        
        // Sort rows
        rows.sort((a, b) => {
            const aValue = getCellValue(a.cells[columnIndex]);
            const bValue = getCellValue(b.cells[columnIndex]);
            
            let comparison = 0;
            
            if (typeof aValue === 'number' && typeof bValue === 'number') {
                comparison = aValue - bValue;
            } else {
                comparison = aValue.toString().localeCompare(bValue.toString());
            }
            
            return isAscending ? comparison : -comparison;
        });
        
        // Reorder rows in DOM
        rows.forEach(row => tbody.appendChild(row));
    }

    function getCellValue(cell) {
        const text = cell.textContent.trim();
        
        // Try to parse as number (including percentages)
        const numMatch = text.match(/^([+-]?\d+(?:\.\d+)?)/);
        if (numMatch) {
            return parseFloat(numMatch[1]);
        }
        
        // Try to parse duration (e.g., "1h 30m 45s")
        const durationMatch = text.match(/(?:(\d+)h\s*)?(?:(\d+)m\s*)?(?:(\d+)s)?/);
        if (durationMatch && (durationMatch[1] || durationMatch[2] || durationMatch[3])) {
            const hours = parseInt(durationMatch[1] || 0);
            const minutes = parseInt(durationMatch[2] || 0);
            const seconds = parseInt(durationMatch[3] || 0);
            return hours * 3600 + minutes * 60 + seconds;
        }
        
        return text;
    }

    function setupTableFiltering() {
        // Add filter controls if they don't exist
        const tables = document.querySelectorAll('.comparison-table');
        
        tables.forEach(table => {
            if (!table.querySelector('.table-filters')) {
                addTableFilters(table);
            }
        });
    }

    function addTableFilters(tableContainer) {
        const table = tableContainer.querySelector('table');
        const headers = table.querySelectorAll('th');
        
        const filtersDiv = document.createElement('div');
        filtersDiv.className = 'table-filters';
        filtersDiv.style.cssText = `
            margin-bottom: 10px;
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            align-items: center;
        `;
        
        // Status filter
        const statusFilter = document.createElement('select');
        statusFilter.innerHTML = `
            <option value="">All Statuses</option>
            <option value="both">Both</option>
            <option value="different">Different</option>
            <option value="only_first">Only First</option>
            <option value="only_second">Only Second</option>
            <option value="identical">Identical</option>
        `;
        statusFilter.style.cssText = `
            padding: 4px 8px;
            border: 1px solid var(--vscode-input-border);
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 3px;
        `;
        
        statusFilter.addEventListener('change', function() {
            filterTable(table, 'status', this.value);
        });
        
        const statusLabel = document.createElement('label');
        statusLabel.textContent = 'Status: ';
        statusLabel.appendChild(statusFilter);
        
        filtersDiv.appendChild(statusLabel);
        
        // Search filter
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Search...';
        searchInput.style.cssText = `
            padding: 4px 8px;
            border: 1px solid var(--vscode-input-border);
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 3px;
            min-width: 150px;
        `;
        
        searchInput.addEventListener('input', function() {
            filterTable(table, 'search', this.value);
        });
        
        const searchLabel = document.createElement('label');
        searchLabel.textContent = 'Search: ';
        searchLabel.appendChild(searchInput);
        
        filtersDiv.appendChild(searchLabel);
        
        // Clear filters button
        const clearButton = document.createElement('button');
        clearButton.textContent = 'Clear Filters';
        clearButton.className = 'btn btn-sm';
        clearButton.addEventListener('click', function() {
            statusFilter.value = '';
            searchInput.value = '';
            filterTable(table, 'clear', '');
        });
        
        filtersDiv.appendChild(clearButton);
        
        tableContainer.insertBefore(filtersDiv, table);
    }

    function filterTable(table, filterType, filterValue) {
        const rows = table.querySelectorAll('tbody tr');
        
        rows.forEach(row => {
            let show = true;
            
            if (filterType === 'status' && filterValue) {
                const statusClass = Array.from(row.classList).find(cls => cls.startsWith('status-'));
                const status = statusClass ? statusClass.replace('status-', '').replace('-', '_') : '';
                show = show && status === filterValue;
            }
            
            if (filterType === 'search' && filterValue) {
                const text = row.textContent.toLowerCase();
                show = show && text.includes(filterValue.toLowerCase());
            }
            
            if (filterType === 'clear') {
                show = true;
            }
            
            row.style.display = show ? '' : 'none';
        });
        
        // Update visible row count
        updateRowCount(table);
    }

    function updateRowCount(table) {
        const totalRows = table.querySelectorAll('tbody tr').length;
        const visibleRows = table.querySelectorAll('tbody tr:not([style*="display: none"])').length;
        
        let countElement = table.parentElement.querySelector('.row-count');
        if (!countElement) {
            countElement = document.createElement('div');
            countElement.className = 'row-count';
            countElement.style.cssText = `
                font-size: 0.9em;
                color: var(--vscode-descriptionForeground);
                margin-top: 5px;
            `;
            table.parentElement.appendChild(countElement);
        }
        
        countElement.textContent = visibleRows === totalRows ? 
            `${totalRows} items` : 
            `${visibleRows} of ${totalRows} items`;
    }

    function toggleRowDetails(row) {
        // Add expandable row details functionality
        const existingDetails = row.nextElementSibling;
        
        if (existingDetails && existingDetails.classList.contains('row-details')) {
            existingDetails.remove();
            row.classList.remove('expanded');
        } else {
            // Create details row
            const detailsRow = document.createElement('tr');
            detailsRow.className = 'row-details';
            
            const detailsCell = document.createElement('td');
            detailsCell.colSpan = row.cells.length;
            detailsCell.style.cssText = `
                background-color: var(--vscode-editor-inactiveSelectionBackground);
                padding: 15px;
                border-top: none;
            `;
            
            // Add detailed information based on row type
            const rowData = extractRowData(row);
            detailsCell.innerHTML = generateRowDetails(rowData);
            
            detailsRow.appendChild(detailsCell);
            row.parentNode.insertBefore(detailsRow, row.nextSibling);
            row.classList.add('expanded');
        }
    }

    function extractRowData(row) {
        const cells = Array.from(row.cells);
        return {
            name: cells[0]?.textContent.trim(),
            status: cells[1]?.textContent.trim(),
            run1Result: cells[2]?.textContent.trim(),
            run2Result: cells[3]?.textContent.trim(),
            run1Duration: cells[4]?.textContent.trim(),
            run2Duration: cells[5]?.textContent.trim(),
            change: cells[6]?.textContent.trim()
        };
    }

    function generateRowDetails(data) {
        return `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                <div>
                    <strong>Item:</strong> ${data.name}<br>
                    <strong>Status:</strong> ${data.status}
                </div>
                <div>
                    <strong>Run 1:</strong><br>
                    Result: ${data.run1Result}<br>
                    Duration: ${data.run1Duration}
                </div>
                <div>
                    <strong>Run 2:</strong><br>
                    Result: ${data.run2Result}<br>
                    Duration: ${data.run2Duration}
                </div>
                <div>
                    <strong>Change:</strong> ${data.change}<br>
                    ${data.change !== 'N/A' ? (data.change.includes('-') ? '⬇ Faster' : '⬆ Slower') : ''}
                </div>
            </div>
        `;
    }

    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', function(event) {
            // Ctrl/Cmd + E for export
            if ((event.ctrlKey || event.metaKey) && event.key === 'e') {
                event.preventDefault();
                const exportButtons = document.querySelectorAll('[onclick*="exportComparison"]');
                if (exportButtons.length > 0) {
                    exportButtons[0].click();
                }
            }
            
            // Ctrl/Cmd + F for search
            if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
                event.preventDefault();
                const searchInput = document.querySelector('.table-filters input[type="text"]');
                if (searchInput) {
                    searchInput.focus();
                }
            }
            
            // Escape to clear selection/filters
            if (event.key === 'Escape') {
                const clearButtons = document.querySelectorAll('.table-filters button');
                clearButtons.forEach(button => {
                    if (button.textContent.includes('Clear')) {
                        button.click();
                    }
                });
            }
        });
    }

    // Utility functions
    function formatDuration(milliseconds) {
        if (!milliseconds || milliseconds === 'N/A') return 'N/A';
        
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    function formatPercentage(value) {
        if (value === null || value === undefined || isNaN(value)) return 'N/A';
        return (value > 0 ? '+' : '') + value.toFixed(1) + '%';
    }

    function getStatusIcon(status) {
        const icons = {
            'both': '●',
            'different': '◐',
            'only_first': '◯',
            'only_second': '●',
            'identical': '✓'
        };
        return icons[status] || '?';
    }

    // Export functions to global scope for onclick handlers
    window.exportComparison = function(format) {
        if (typeof vscode !== 'undefined' && typeof comparisonData !== 'undefined') {
            vscode.postMessage({
                command: 'exportComparison',
                comparison: comparisonData,
                format: format,
                config: {
                    includeTaskDetails: true,
                    includeCharts: false,
                    summaryOnly: false,
                    title: 'Pipeline Run Comparison: #' + comparisonData.runs[0].id + ' vs #' + comparisonData.runs[1].id
                }
            });
        }
    };

    // Add CSS for sorting indicators
    const style = document.createElement('style');
    style.textContent = `
        .comparison-table th.sort-asc::after {
            content: ' ↑';
            color: var(--vscode-textLink-foreground);
        }
        .comparison-table th.sort-desc::after {
            content: ' ↓';
            color: var(--vscode-textLink-foreground);
        }
        .comparison-table tr.expanded {
            background-color: var(--vscode-list-activeSelectionBackground);
        }
        .table-filters {
            font-size: 0.9em;
        }
        .table-filters label {
            display: flex;
            align-items: center;
            gap: 5px;
            color: var(--vscode-foreground);
        }
    `;
    document.head.appendChild(style);

})();