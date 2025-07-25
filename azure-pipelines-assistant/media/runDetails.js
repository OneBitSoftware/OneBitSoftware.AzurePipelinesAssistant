// Run Details Webview JavaScript

(function() {
    'use strict';

    // Initialize the webview
    document.addEventListener('DOMContentLoaded', function() {
        console.log('Run Details webview loaded');
        
        // Add keyboard shortcuts
        document.addEventListener('keydown', function(event) {
            // Ctrl/Cmd + R to refresh
            if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
                event.preventDefault();
                refreshRun();
            }
            
            // Escape to close expanded sections
            if (event.key === 'Escape') {
                collapseAllSections();
            }
        });
        
        // Add smooth scrolling for anchor links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function(e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth' });
                }
            });
        });
        
        // Auto-refresh for running builds
        if (window.runData && window.runData.state === 'inProgress') {
            startAutoRefresh();
        }
        
        // Initialize search box
        addSearchBox();
    });

    // Auto-refresh functionality
    let autoRefreshInterval;
    
    function startAutoRefresh() {
        // Refresh every 30 seconds for running builds
        autoRefreshInterval = setInterval(() => {
            if (window.runData && window.runData.state === 'inProgress') {
                refreshRun();
            } else {
                stopAutoRefresh();
            }
        }, 30000);
    }
    
    function stopAutoRefresh() {
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
            autoRefreshInterval = null;
        }
    }
    
    // Utility functions
    function collapseAllSections() {
        // Collapse all stages
        document.querySelectorAll('.stage .jobs').forEach(jobs => {
            jobs.style.display = 'none';
        });
        document.querySelectorAll('.stage .toggle').forEach(toggle => {
            toggle.textContent = '▶';
        });
        
        // Collapse all jobs
        document.querySelectorAll('.job .tasks').forEach(tasks => {
            tasks.style.display = 'none';
        });
        document.querySelectorAll('.job .toggle').forEach(toggle => {
            toggle.textContent = '▶';
        });
    }
    
    function expandAllSections() {
        // Expand all stages
        document.querySelectorAll('.stage .jobs').forEach(jobs => {
            jobs.style.display = 'block';
        });
        document.querySelectorAll('.stage .toggle').forEach(toggle => {
            toggle.textContent = '▼';
        });
        
        // Expand all jobs
        document.querySelectorAll('.job .tasks').forEach(tasks => {
            tasks.style.display = 'block';
        });
        document.querySelectorAll('.job .toggle').forEach(toggle => {
            toggle.textContent = '▼';
        });
    }
    
    // Add context menu for right-click actions
    document.addEventListener('contextmenu', function(event) {
        event.preventDefault();
        
        const target = event.target.closest('.stage, .job, .task');
        if (target) {
            showContextMenu(event, target);
        }
    });
    
    function showContextMenu(event, target) {
        // Create context menu
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.position = 'fixed';
        menu.style.left = event.clientX + 'px';
        menu.style.top = event.clientY + 'px';
        menu.style.background = 'var(--vscode-menu-background)';
        menu.style.border = '1px solid var(--vscode-menu-border)';
        menu.style.borderRadius = '4px';
        menu.style.padding = '4px 0';
        menu.style.zIndex = '1000';
        menu.style.minWidth = '150px';
        menu.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
        
        // Add menu items based on target type
        if (target.classList.contains('stage')) {
            addMenuItem(menu, 'Expand/Collapse', () => {
                const stageId = target.id.replace('stage-', '');
                toggleStage(stageId);
            });
        } else if (target.classList.contains('job')) {
            addMenuItem(menu, 'View Logs', () => {
                const jobId = target.id.replace('job-', '');
                viewLogs(window.runData.id, jobId);
            });
            addMenuItem(menu, 'Expand/Collapse', () => {
                const jobId = target.id.replace('job-', '');
                toggleJob(jobId);
            });
        } else if (target.classList.contains('task')) {
            addMenuItem(menu, 'View Logs', () => {
                // Extract task info from the task element
                const taskName = target.querySelector('.name').textContent;
                viewLogs(window.runData.id, taskName);
            });
        }
        
        // Add common menu items
        addMenuItem(menu, 'Copy Name', () => {
            const name = target.querySelector('.name').textContent;
            navigator.clipboard.writeText(name);
        });
        
        document.body.appendChild(menu);
        
        // Remove menu when clicking elsewhere
        const removeMenu = () => {
            if (menu.parentNode) {
                menu.parentNode.removeChild(menu);
            }
            document.removeEventListener('click', removeMenu);
        };
        
        setTimeout(() => {
            document.addEventListener('click', removeMenu);
        }, 100);
    }
    
    function addMenuItem(menu, text, onClick) {
        const item = document.createElement('div');
        item.textContent = text;
        item.style.padding = '6px 12px';
        item.style.cursor = 'pointer';
        item.style.color = 'var(--vscode-menu-foreground)';
        
        item.addEventListener('mouseenter', () => {
            item.style.background = 'var(--vscode-menu-selectionBackground)';
            item.style.color = 'var(--vscode-menu-selectionForeground)';
        });
        
        item.addEventListener('mouseleave', () => {
            item.style.background = 'transparent';
            item.style.color = 'var(--vscode-menu-foreground)';
        });
        
        item.addEventListener('click', () => {
            onClick();
            // Remove menu
            if (menu.parentNode) {
                menu.parentNode.removeChild(menu);
            }
        });
        
        menu.appendChild(item);
    }
    
    // Add search functionality
    function addSearchBox() {
        const searchContainer = document.createElement('div');
        searchContainer.className = 'search-container';
        searchContainer.style.margin = '10px 0';
        
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Search stages, jobs, tasks...';
        searchInput.style.width = '100%';
        searchInput.style.padding = '8px 12px';
        searchInput.style.border = '1px solid var(--vscode-input-border)';
        searchInput.style.background = 'var(--vscode-input-background)';
        searchInput.style.color = 'var(--vscode-input-foreground)';
        searchInput.style.borderRadius = '4px';
        
        searchInput.addEventListener('input', function(e) {
            filterContent(e.target.value);
        });
        
        searchContainer.appendChild(searchInput);
        
        const timelineSection = document.querySelector('.section:nth-child(3)');
        if (timelineSection) {
            timelineSection.insertBefore(searchContainer, timelineSection.querySelector('.timeline'));
        }
    }
    
    function filterContent(searchTerm) {
        const term = searchTerm.toLowerCase();
        
        // Filter stages
        document.querySelectorAll('.stage').forEach(stage => {
            const stageName = stage.querySelector('.name').textContent.toLowerCase();
            const stageVisible = stageName.includes(term);
            
            // Filter jobs within stage
            let hasVisibleJob = false;
            stage.querySelectorAll('.job').forEach(job => {
                const jobName = job.querySelector('.name').textContent.toLowerCase();
                const jobVisible = jobName.includes(term);
                
                // Filter tasks within job
                let hasVisibleTask = false;
                job.querySelectorAll('.task').forEach(task => {
                    const taskName = task.querySelector('.name').textContent.toLowerCase();
                    const taskVisible = taskName.includes(term);
                    task.style.display = taskVisible || !term ? 'flex' : 'none';
                    if (taskVisible) hasVisibleTask = true;
                });
                
                const showJob = jobVisible || hasVisibleTask || !term;
                job.style.display = showJob ? 'block' : 'none';
                if (showJob) hasVisibleJob = true;
            });
            
            const showStage = stageVisible || hasVisibleJob || !term;
            stage.style.display = showStage ? 'block' : 'none';
        });
    }
    
    // Export functions to global scope for inline event handlers
    window.refreshRun = refreshRun;
    window.openInBrowser = openInBrowser;
    window.cancelRun = cancelRun;
    window.viewLogs = viewLogs;
    window.toggleStage = toggleStage;
    window.toggleJob = toggleJob;
    window.collapseAllSections = collapseAllSections;
    window.expandAllSections = expandAllSections;
    
})();