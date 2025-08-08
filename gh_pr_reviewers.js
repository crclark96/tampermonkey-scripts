// ==UserScript==
// @name         GitHub PR Simple Reviewers
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Adds repository-specific reviewers to GitHub PRs
// @author       crclark96
// @match        https://github.com/*/*/pull/*
// @match        https://github.com/*/*/compare/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function() {
    'use strict';

    // Configuration storage
    const defaultReviewers = GM_getValue('github_reviewers', []);
    const repoConfigs = GM_getValue('repo_configs', {});
    const debugMode = GM_getValue('debug_mode', false);

    // Debug helper
    function log(...args) {
        if (debugMode) console.log('[GitHub Reviewers]', ...args);
    }

    // Helper function for sleeping
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Get current repository from URL
    function getCurrentRepo() {
        const pathParts = window.location.pathname.split('/');
        if (pathParts.length < 3) return null;

        return {
            owner: pathParts[1],
            repo: pathParts[2]
        };
    }

    // Configure default reviewers
    function configureDefaultReviewers() {
        const current = GM_getValue('github_reviewers', []);
        const newValue = prompt(
            'Enter DEFAULT GitHub usernames separated by commas:',
            current.join(', ')
        );

        if (newValue !== null) {
            const reviewers = newValue.split(',').map(r => r.trim()).filter(r => r);
            GM_setValue('github_reviewers', reviewers);
            alert(`Saved ${reviewers.length} default reviewers`);
            refreshButton();
        }
    }

    // Configure repository-specific reviewers
    function configureRepoReviewers() {
        const repoInfo = getCurrentRepo();
        if (!repoInfo) {
            alert('Please navigate to a GitHub repository first');
            return;
        }

        const repoKey = `${repoInfo.owner}/${repoInfo.repo}`;
        const configs = GM_getValue('repo_configs', {});
        const current = configs[repoKey] || [];

        // Show current configuration
        if (Object.keys(configs).length > 0) {
            let configList = 'Current repo configurations:\n';
            Object.keys(configs).forEach(repo => {
                configList += `- ${repo}: ${configs[repo].join(', ')}\n`;
            });
            alert(configList);
        }

        const newValue = prompt(
            `Enter reviewers for ${repoKey}:`,
            current.join(', ')
        );

        if (newValue !== null) {
            const reviewers = newValue.split(',').map(r => r.trim()).filter(r => r);

            // Get existing configs to avoid overwriting
            const allConfigs = GM_getValue('repo_configs', {});

            if (reviewers.length > 0) {
                allConfigs[repoKey] = reviewers;
                GM_setValue('repo_configs', allConfigs);
                alert(`Saved ${reviewers.length} reviewers for ${repoKey}`);
            } else {
                delete allConfigs[repoKey];
                GM_setValue('repo_configs', allConfigs);
                alert(`Removed configuration for ${repoKey}`);
            }

            refreshButton();
        }
    }

    // Toggle debug mode
    function toggleDebug() {
        const newValue = !GM_getValue('debug_mode', false);
        GM_setValue('debug_mode', newValue);
        alert(`Debug mode ${newValue ? 'enabled' : 'disabled'}`);
    }

    // Refresh button after configuration changes
    function refreshButton() {
        const container = document.getElementById('reviewers-button-container');
        if (container) {
            container.remove();
            addButton();
        }
    }

    // Add button to page
    function addButton() {
        if (document.getElementById('reviewers-button-container')) return;

        // Find sidebar or reviewer section
        const sidebar = document.querySelector('.discussion-sidebar, .Layout-sidebar');
        const reviewersPane = document.querySelector(".sidebar-assignee");
        if (!sidebar) {
            log('Could not find sidebar');
            return;
        }

        // Get current repo's reviewers or default
        const repoInfo = getCurrentRepo();
        let reviewers = defaultReviewers;
        let isRepoSpecific = false;

        if (repoInfo) {
            const repoKey = `${repoInfo.owner}/${repoInfo.repo}`;
            if (repoConfigs[repoKey]) {
                reviewers = repoConfigs[repoKey];
                isRepoSpecific = true;
                log(`Using repo-specific reviewers for ${repoKey}`);
            }
        }

        // Create button container
        const container = document.createElement('div');
        container.id = 'reviewers-button-container';
        container.className = 'discussion-sidebar-item';
        container.style.marginTop = '15px';

        // Create button
        const button = document.createElement('button');
        button.id = 'add-reviewers-button';
        button.className = 'btn btn-sm';
        button.style.width = '100%';
        button.onclick = addReviewers;

        // Set button content
        button.innerHTML = `
            <svg class="octicon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" style="vertical-align: text-bottom; margin-right: 4px;">
                <path fill-rule="evenodd" d="M5.5 3.5a2 2 0 100 4 2 2 0 000-4zM2 5.5a3.5 3.5 0 115.898 2.549 5.507 5.507 0 013.034 4.084.75.75 0 11-1.482.235 4.001 4.001 0 00-7.9 0 .75.75 0 01-1.482-.236A5.507 5.507 0 013.102 8.05 3.49 3.49 0 012 5.5zM11 4a.75.75 0 01.75.75v1.5h1.5a.75.75 0 010 1.5h-1.5v1.5a.75.75 0 01-1.5 0v-1.5h-1.5a.75.75 0 010-1.5h1.5v-1.5A.75.75 0 0111 4z"></path>
            </svg>
            Add ${isRepoSpecific ? 'Repo' : 'Default'} Reviewers
        `;

        // Add counter badge
        if (reviewers.length > 0) {
            const badge = document.createElement('span');
            badge.className = 'Counter';
            badge.textContent = reviewers.length;
            badge.style.marginLeft = '4px';
            button.appendChild(badge);
        }

        container.appendChild(button);
        reviewersPane.appendChild(container);
        log('Button added successfully');
    }

    // Main function to add reviewers
    async function addReviewers() {
        const button = document.getElementById('add-reviewers-button');
        const originalText = button.innerHTML;
        button.innerHTML = 'Adding...';
        button.disabled = true;

        try {
            // Get reviewers for current repo
            const repoInfo = getCurrentRepo();
            let reviewers = defaultReviewers;

            if (repoInfo) {
                const repoKey = `${repoInfo.owner}/${repoInfo.repo}`;
                if (repoConfigs[repoKey]) {
                    reviewers = repoConfigs[repoKey];
                }
            }

            if (reviewers.length === 0) {
                alert('No reviewers configured. Please configure reviewers first.');
                return;
            }

            // Find and click reviewers button
            const reviewersButton = findReviewersButton();
            if (!reviewersButton) {
                alert('Could not find reviewers button on page');
                return;
            }

            reviewersButton.click();
            await sleep(1000);

            // Add each reviewer
            let addedCount = 0;
            for (const reviewer of reviewers) {
                if (await addReviewer(reviewer)) {
                    addedCount++;
                }
            }

            // Close dropdown by clicking outside
            document.body.click();

            if (addedCount > 0) {
                showNotification(`Added ${addedCount} reviewer(s) successfully`, 'success');
            } else {
                showNotification('Could not add any reviewers', 'warning');
            }

        } catch (error) {
            console.error('Error adding reviewers:', error);
            showNotification(`Error: ${error.message}`, 'error');
        } finally {
            button.innerHTML = originalText;
            button.disabled = false;
        }
    }

    // Find the add reviewers button
    function findReviewersButton() {
        // Try various methods to find the button

        // 1. Try buttons with "reviewer" text
        const buttons = document.querySelectorAll('button, summary');
        for (const btn of buttons) {
            if (btn.textContent.toLowerCase().includes('reviewer')) {
                return btn;
            }
        }

        // 2. Try known selectors
        const selectors = [
            'button[aria-label="Add reviewers"]',
            '.js-reviews-toggle',
            'summary[aria-label*="reviewer"]'
        ];

        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) return element;
        }

        // 3. Find the reviewers section and look for a button
        const reviewersSections = document.querySelectorAll('.discussion-sidebar-item');
        for (const section of reviewersSections) {
            if (section.textContent.includes('Reviewer')) {
                const button = section.querySelector('button, summary');
                if (button) return button;
            }
        }

        return null;
    }

    // Add a single reviewer
    async function addReviewer(username) {
        log(`Trying to add reviewer: ${username}`);

        // Try to find reviewer in dropdown
        const items = document.querySelectorAll('.SelectMenu-item, .select-menu-item, [role="menuitem"]');
        for (const item of items) {
            if (item.textContent.includes(username)) {
                item.click();
                await sleep(500);
                return true;
            }
        }

        // Try search if available
        const searchInput = document.querySelector('.SelectMenu-filter input, input[placeholder*="search"]');
        if (searchInput) {
            searchInput.value = username;
            searchInput.dispatchEvent(new Event('input', {bubbles: true}));
            await sleep(1000);

            // Check for results after search
            const searchResults = document.querySelectorAll('.SelectMenu-item, .select-menu-item, [role="menuitem"]');
            for (const result of searchResults) {
                if (result.textContent.includes(username)) {
                    result.click();
                    await sleep(500);
                    return true;
                }
            }
        }

        log(`Could not find reviewer: ${username}`);
        return false;
    }

    // Show a notification
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `flash flash-${type}`;
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.left = '50%';
        notification.style.transform = 'translateX(-50%)';
        notification.style.zIndex = '100';
        notification.style.padding = '10px 15px';
        notification.style.borderRadius = '4px';
        notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => notification.remove(), 4000);
    }

    // Initialize script
    function init() {
        // Register menu commands
        GM_registerMenuCommand('Configure Default Reviewers', configureDefaultReviewers);
        GM_registerMenuCommand('Configure Repo-Specific Reviewers', configureRepoReviewers);
        GM_registerMenuCommand('Toggle Debug Mode', toggleDebug);

        // Add button to page
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', addButton);
        } else {
            addButton();
        }

        // Watch for navigation events in single-page app
        const observer = new MutationObserver(() => {
            if (!document.getElementById('reviewers-button-container') &&
                window.location.pathname.includes('/pull/')) {
                addButton();
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    init();
})();
