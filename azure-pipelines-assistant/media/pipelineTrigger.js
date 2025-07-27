// Pipeline Trigger UI JavaScript

(function() {
    'use strict';

    // DOM elements
    const form = document.getElementById('triggerForm');
    const sourceBranchInput = document.getElementById('sourceBranch');
    const variablesContainer = document.querySelector('.variables-container');
    const addVariableButton = document.getElementById('addVariable');
    const templateParamsTextarea = document.getElementById('templateParams');
    const cancelButton = document.getElementById('cancelButton');
    const triggerButton = document.getElementById('triggerButton');
    const validationErrors = document.getElementById('validationErrors');

    // Initialize the UI
    function init() {
        setupEventListeners();
        setupVariableManagement();
        validateForm();
    }

    // Set up event listeners
    function setupEventListeners() {
        form.addEventListener('submit', handleFormSubmit);
        cancelButton.addEventListener('click', handleCancel);
        addVariableButton.addEventListener('click', addVariableRow);
        
        // Real-time validation
        sourceBranchInput.addEventListener('input', validateForm);
        templateParamsTextarea.addEventListener('input', validateForm);
        
        // Listen for messages from the extension
        window.addEventListener('message', handleExtensionMessage);
    }

    // Handle form submission
    function handleFormSubmit(event) {
        event.preventDefault();
        
        const parameters = collectFormData();
        
        if (validateParameters(parameters)) {
            setLoadingState(true);
            
            vscode.postMessage({
                type: 'trigger',
                parameters: parameters
            });
        }
    }

    // Handle cancel button
    function handleCancel() {
        vscode.postMessage({
            type: 'cancel'
        });
    }

    // Collect form data
    function collectFormData() {
        const parameters = {
            sourceBranch: sourceBranchInput.value.trim(),
            variables: {},
            templateParameters: templateParamsTextarea.value.trim()
        };

        // Collect variables
        const variableRows = variablesContainer.querySelectorAll('.variable-row');
        variableRows.forEach(row => {
            const nameInput = row.querySelector('.variable-name');
            const valueInput = row.querySelector('.variable-value');
            
            if (nameInput && valueInput && nameInput.value.trim() && valueInput.value.trim()) {
                parameters.variables[nameInput.value.trim()] = valueInput.value.trim();
            }
        });

        return parameters;
    }

    // Validate parameters
    function validateParameters(parameters) {
        const errors = [];

        // Validate branch name
        if (parameters.sourceBranch) {
            const branchPattern = /^[a-zA-Z0-9._/-]+$/;
            if (!branchPattern.test(parameters.sourceBranch)) {
                errors.push('Branch name contains invalid characters');
            }
        }

        // Validate variables
        const variableNames = Object.keys(parameters.variables);
        const duplicateNames = variableNames.filter((name, index) => variableNames.indexOf(name) !== index);
        if (duplicateNames.length > 0) {
            errors.push('Duplicate variable names are not allowed');
        }

        // Validate template parameters JSON
        if (parameters.templateParameters) {
            try {
                JSON.parse(parameters.templateParameters);
            } catch (error) {
                errors.push('Template parameters must be valid JSON');
            }
        }

        if (errors.length > 0) {
            showValidationErrors(errors);
            return false;
        }

        hideValidationErrors();
        return true;
    }

    // Show validation errors
    function showValidationErrors(errors) {
        const errorList = errors.map(error => `<li>${error}</li>`).join('');
        validationErrors.innerHTML = `<ul>${errorList}</ul>`;
        validationErrors.style.display = 'block';
    }

    // Hide validation errors
    function hideValidationErrors() {
        validationErrors.style.display = 'none';
    }

    // Set loading state
    function setLoadingState(loading) {
        const buttonText = triggerButton.querySelector('.button-text');
        const loadingSpinner = triggerButton.querySelector('.loading-spinner');
        
        if (loading) {
            triggerButton.disabled = true;
            buttonText.style.display = 'none';
            loadingSpinner.style.display = 'inline';
        } else {
            triggerButton.disabled = false;
            buttonText.style.display = 'inline';
            loadingSpinner.style.display = 'none';
        }
    }

    // Variable management
    function setupVariableManagement() {
        // Remove the default empty variable row if it exists
        const defaultRow = variablesContainer.querySelector('.variable-row');
        if (defaultRow) {
            const nameInput = defaultRow.querySelector('.variable-name');
            const valueInput = defaultRow.querySelector('.variable-value');
            if (!nameInput.value && !valueInput.value) {
                defaultRow.remove();
            }
        }
    }

    // Add a new variable row
    function addVariableRow() {
        const row = document.createElement('div');
        row.className = 'variable-row';
        
        row.innerHTML = `
            <input type="text" placeholder="Variable name" class="variable-name">
            <input type="text" placeholder="Variable value" class="variable-value">
            <button type="button" class="remove-variable" title="Remove variable">×</button>
        `;

        // Add event listeners
        const removeButton = row.querySelector('.remove-variable');
        removeButton.addEventListener('click', () => {
            row.remove();
            validateForm();
        });

        const inputs = row.querySelectorAll('input');
        inputs.forEach(input => {
            input.addEventListener('input', validateForm);
        });

        variablesContainer.appendChild(row);
        
        // Focus on the name input
        const nameInput = row.querySelector('.variable-name');
        nameInput.focus();
    }

    // Validate the entire form
    function validateForm() {
        const parameters = collectFormData();
        const isValid = validateParameters(parameters);
        
        // Enable/disable trigger button based on validation
        if (isValid && (parameters.sourceBranch || Object.keys(parameters.variables).length > 0 || parameters.templateParameters)) {
            triggerButton.disabled = false;
        } else {
            triggerButton.disabled = true;
        }
    }

    // Handle messages from the extension
    function handleExtensionMessage(event) {
        const message = event.data;
        
        switch (message.type) {
            case 'validationError':
                setLoadingState(false);
                showValidationErrors(message.errors);
                break;
                
            case 'validationResult':
                if (!message.isValid) {
                    showValidationErrors(message.errors);
                } else {
                    hideValidationErrors();
                }
                break;
                
            case 'error':
                setLoadingState(false);
                showValidationErrors([message.message]);
                break;
                
            case 'triggering':
                setLoadingState(true);
                hideValidationErrors();
                break;
                
            case 'cancelled':
                setLoadingState(false);
                break;
                
            case 'success':
                setLoadingState(false);
                hideValidationErrors();
                // The webview will be closed by the extension
                break;
        }
    }

    // Initialize when DOM is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Add keyboard shortcuts
    document.addEventListener('keydown', (event) => {
        // Ctrl/Cmd + Enter to trigger
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault();
            if (!triggerButton.disabled) {
                handleFormSubmit(event);
            }
        }
        
        // Escape to cancel
        if (event.key === 'Escape') {
            event.preventDefault();
            handleCancel();
        }
    });

})();