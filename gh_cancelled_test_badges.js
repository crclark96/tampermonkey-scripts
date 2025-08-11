// ==UserScript==
// @name         GitHub Cancelled Test Status Badge
// @namespace    http://tampermonkey.net/
// @version      1.0.1
// @description  Replace red X with yield sign for cancelled GitHub CI tests
// @author       You
// @match        https://github.com/*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Yield sign SVG
    const yieldSignSVG = `
        <svg class="octicon octicon-alert mx-auto d-block color-fg-attention" viewBox="0 0 16 16" version="1.1" width="16" height="16" aria-hidden="true">
            <path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"></path>
        </svg>
    `;

    // Alternative: Cancelled/Stop sign SVG
    const cancelledSignSVG = `
        <svg class="octicon octicon-stop mx-auto d-block color-fg-attention" viewBox="0 0 16 16" version="1.1" width="16" height="16" aria-hidden="true">
            <path d="M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path>
        </svg>
    `;

    function replaceCancelledIcons() {
        console.log('[GitHub Status] Checking for cancelled icons...');

        // First, find any deferred status dropdowns and trigger them to load
        const deferredDropdowns = document.querySelectorAll('details.commit-build-statuses[data-deferred-details-content-url]:not([data-status-processed])');
        console.log(`[GitHub Status] Found ${deferredDropdowns.length} deferred status dropdowns`);

        if (deferredDropdowns.length > 0) {
            deferredDropdowns.forEach((dropdown, index) => {
                console.log(`[GitHub Status] Opening deferred dropdown ${index} to load content`);
                dropdown.setAttribute('data-status-processed', 'true'); // Mark as processed to avoid loops

                // Open the dropdown to trigger content loading
                dropdown.open = true;

                // Set up a listener for when the content loads
                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                            // Check if status content was added
                            const hasStatusContent = Array.from(mutation.addedNodes).some(node => {
                                if (node.nodeType === Node.ELEMENT_NODE) {
                                    return node.querySelector && node.querySelector('.merge-status-item');
                                }
                                return false;
                            });

                            if (hasStatusContent) {
                                console.log(`[GitHub Status] Content loaded for dropdown ${index}, processing...`);
                                observer.disconnect();
                                setTimeout(() => processStatusItems(dropdown), 100);
                            }
                        }
                    });
                });

                observer.observe(dropdown, {
                    childList: true,
                    subtree: true
                });

                // Fallback timeout in case the observer doesn't catch it
                setTimeout(() => {
                    observer.disconnect();
                    processStatusItems(dropdown);
                }, 2000);
                dropdown.open = false;
            });
        }

        // Also process any already-loaded status items
        processStatusItems();
    }

    function processStatusItems(container = document) {
        console.log('[GitHub Status] Processing status items in container:', container.tagName || 'document');

        // Find all merge status items
        const statusItems = container.querySelectorAll('.merge-status-item');
        console.log(`[GitHub Status] Found ${statusItems.length} status items`);

        let replacedCount = 0;
        statusItems.forEach((item, index) => {
            // Check if this item contains cancelled test text
            const statusText = item.querySelector('.color-fg-muted');
            if (statusText) {
                const textContent = statusText.textContent.trim();
                if (textContent.includes('canceled')) {
                    console.log(`[GitHub Status] Found cancelled test in item ${index}`);

                    // Find the icon container
                    const iconContainer = item.querySelector('.merge-status-icon');
                    if (iconContainer) {
                        const currentIcon = iconContainer.querySelector('svg.octicon-x, svg.octicon-alert');
                        if (currentIcon && !currentIcon.classList.contains('octicon-alert')) {
                            console.log(`[GitHub Status] Replacing X icon in item ${index}`);
                            iconContainer.innerHTML = yieldSignSVG;
                            replacedCount++;
                        } else if (currentIcon && currentIcon.classList.contains('octicon-alert')) {
                            console.log(`[GitHub Status] Item ${index} already has yield sign`);
                        } else {
                            console.log(`[GitHub Status] No X icon found in item ${index}, current icon:`, iconContainer.innerHTML);
                        }
                    } else {
                        console.log(`[GitHub Status] No icon container found in item ${index}`);
                    }
                }
            } else {
                console.log(`[GitHub Status] No status text found in item ${index}`);
            }
        });

        // Also handle the summary icon in the dropdown trigger (but only if we have cancelled items)
        if (replacedCount > 0 || container === document) {
            const summaryIcons = container.querySelectorAll('summary svg.octicon-x');
            console.log(`[GitHub Status] Found ${summaryIcons.length} summary X icons`);

            summaryIcons.forEach((icon, index) => {
                const dropdown = icon.closest('details');
                if (dropdown) {
                    // Check if this dropdown contains cancelled tests
                    const cancelledItems = dropdown.querySelectorAll('.merge-status-item .color-fg-muted');
                    const hasCancelledTests = Array.from(cancelledItems).some(item =>
                        item.textContent.includes('canceled')
                    );

                    console.log(`[GitHub Status] Summary ${index} has cancelled tests:`, hasCancelledTests);

                    if (hasCancelledTests) {
                        console.log(`[GitHub Status] Replacing summary X icon ${index}`);
                        icon.outerHTML = yieldSignSVG;
                        replacedCount++;
                    }
                }
            });
        }

        console.log(`[GitHub Status] Replaced ${replacedCount} icons in this container`);

        // Scroll to top after processing
        console.log('[GitHub Status] Scrolling to top after processing changes');
    }

    // Run on page load
    console.log('[GitHub Status] Script loaded, running initial check');
    setTimeout(replaceCancelledIcons, 500); // Give page time to load
    window.scrollTo({ top: 0, behavior: 'instant' });

    // Watch for dynamic content changes (GitHub uses AJAX navigation)
    const observer = new MutationObserver((mutations) => {
        let shouldCheck = false;
        let relevantChanges = [];

        mutations.forEach((mutation) => {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                // Check if any added nodes contain status-related content
                const hasStatusContent = Array.from(mutation.addedNodes).some(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        return node.querySelector && (
                            node.querySelector('.merge-status-item') ||
                            node.querySelector('.commit-build-statuses') ||
                            node.querySelector('.dropdown-menu') ||
                            node.classList?.contains('merge-status-item') ||
                            node.classList?.contains('commit-build-statuses') ||
                            node.classList?.contains('dropdown-menu')
                        );
                    }
                    return false;
                });

                if (hasStatusContent) {
                    shouldCheck = true;
                    relevantChanges.push({
                        target: mutation.target.className || mutation.target.tagName,
                        addedNodes: mutation.addedNodes.length
                    });
                }
            }

            // Also check for attribute changes (like 'open' attribute on details)
            if (mutation.type === 'attributes' &&
                mutation.target.tagName === 'DETAILS' &&
                mutation.target.classList.contains('commit-build-statuses')) {
                console.log('[GitHub Status] Details dropdown opened/closed');
                shouldCheck = true;
                relevantChanges.push({
                    target: 'DETAILS attribute change',
                    attribute: mutation.attributeName
                });
            }
        });

        if (shouldCheck) {
            console.log('[GitHub Status] Relevant DOM changes detected:', relevantChanges);
            setTimeout(() => {
                console.log('[GitHub Status] Running check after DOM mutation');
                replaceCancelledIcons();
            }, 100);
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['open', 'class']
    });

    // Also run when GitHub's pjax navigation occurs
    document.addEventListener('pjax:end', () => {
        console.log('[GitHub Status] PJAX navigation detected, running check');
        setTimeout(replaceCancelledIcons, 100);
    });

    // Additional event listeners for GitHub's navigation
    document.addEventListener('turbo:load', () => {
        console.log('[GitHub Status] Turbo load detected, running check');
        setTimeout(replaceCancelledIcons, 100);
    });

    // Listen for clicks on status dropdowns to trigger when they open
    document.addEventListener('click', (e) => {
        if (e.target.closest('summary') && e.target.closest('.commit-build-statuses')) {
            console.log('[GitHub Status] Status dropdown clicked, scheduling check');
            setTimeout(() => {
                console.log('[GitHub Status] Running check after dropdown click');
                replaceCancelledIcons();
            }, 150);
        }
    });

    // Listen for hover events that might trigger lazy loading
    document.addEventListener('mouseenter', (e) => {
        if (e.target.closest('.commit-build-statuses')) {
            console.log('[GitHub Status] Hovering over status area, scheduling check');
            setTimeout(() => {
                console.log('[GitHub Status] Running check after hover');
                replaceCancelledIcons();
            }, 150);
        }
    }, true);

})();
