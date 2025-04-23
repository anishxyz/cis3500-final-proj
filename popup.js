// popup.js

// --- Constants ---
const REVIEW_PAGE_REGEX = /^https:\/\/www\.amazon\.com\/product-reviews\/([A-Z0-9]{10})/;
const PRODUCT_PAGE_REGEX = /^https:\/\/www\.amazon\.com\/.*\/dp\/([A-Z0-9]{10})/;

// --- DOM Elements ---
let contentDiv;
let loadingDiv;

// --- Helper Functions ---

/**
 * Toggles the visibility of the loading indicator.
 * @param {boolean} show - True to show, false to hide.
 */
function toggleLoading(show) {
    if (loadingDiv) {
        loadingDiv.style.display = show ? 'block' : 'none';
    }
}

/**
 * Updates the content of the popup and hides the loading indicator.
 * @param {string|null} htmlContent - HTML content to set.
 * @param {string|null} textContent - Text content to set (if htmlContent is null).
 */
function updatePopupContent(htmlContent = null, textContent = null) {
    if (contentDiv) {
        if (htmlContent !== null) {
            contentDiv.innerHTML = htmlContent;
        } else if (textContent !== null) {
            contentDiv.textContent = textContent;
        }
    }
    toggleLoading(false);
}

/**
 * Gets the current active tab.
 * @returns {Promise<chrome.tabs.Tab | null>} The active tab or null if error.
 */
async function getCurrentTab() {
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        return tabs[0] || null;
    } catch (error) {
        console.error("Error querying tabs:", error);
        return null;
    }
}

/**
 * Analyzes the URL to determine page type and ASIN.
 * @param {string} url - The URL to analyze.
 * @returns {{ type: 'review'|'product'|'other', asin: string|null }}
 */
function getPageInfo(url) {
    const reviewMatch = url.match(REVIEW_PAGE_REGEX);
    if (reviewMatch) {
        return { type: 'review', asin: reviewMatch[1] };
    }
    const productMatch = url.match(PRODUCT_PAGE_REGEX);
    if (productMatch) {
        return { type: 'product', asin: productMatch[1] };
    }
    return { type: 'other', asin: null };
}

/**
 * Placeholder function to retrieve the OpenAI API key.
 * **IMPORTANT:** Implement secure storage, e.g., via chrome.storage.local 
 * and an options page for the user to input their key.
 * @returns {Promise<string|null>} The API key or null if not found.
 */
async function getApiKey() {
    return "API KEY HERE";
}

/**
 * Appends streamed summary content to the designated output area.
 * Clears previous content on the first call for a new summary.
 * @param {string} chunk - The piece of text content to append.
 * @param {boolean} isFirstChunk - Whether this is the first chunk of a new summary.
 */
function displaySummaryStream(chunk, isFirstChunk = false) {
    const summaryOutputDiv = document.getElementById('summaryOutput');
    if (!summaryOutputDiv) {
        console.error("Summary output element not found.");
        return;
    }
    if (isFirstChunk) {
        summaryOutputDiv.innerHTML = ''; // Clear previous summary
        summaryOutputDiv.style.display = 'block'; // Make visible
    }
    // Append chunk - handle potential markdown later or use a library
    summaryOutputDiv.textContent += chunk;
}

/**
 * Creates and configures the 'Summarize Reviews' button.
 * @returns {HTMLButtonElement} The configured button element.
 */
function createSummarizeButton() {
    const summarizeBtn = document.createElement('button');
    summarizeBtn.id = 'summarizeBtn';
    summarizeBtn.textContent = 'Summarize Reviews';
    summarizeBtn.style.marginBottom = '10px'; // Add some spacing below

    summarizeBtn.addEventListener('click', async () => {
        console.log("Summarize button clicked.");
        // Ensure reviews are available (they should be if button is visible)
        if (window.allReviews && window.allReviews.length > 0) {
            summarizeBtn.disabled = true; // Disable button during API call
            summarizeBtn.textContent = 'Summarizing...';
            displaySummaryStream('', true); // Clear previous summary display

            const apiKey = await getApiKey();
            if (!apiKey) {
                console.error("OpenAI API key not found. Please configure it in extension options.");
                updatePopupContent(null, 'Error: OpenAI API key not set. Please configure it via extension options.');
                summarizeBtn.disabled = false;
                summarizeBtn.textContent = 'Summarize Reviews';
                return;
            }

            // Combine reviews into a single string (Potential token limit issue!)
            const reviewsText = window.allReviews.join('\n---\n'); 
            // Consider truncating or sampling if reviewsText is too long

            console.log(`Summarizing ${window.allReviews.length} reviews...`);
            updatePopupContent(null, 'Summarization started...'); // Update main content area

            try {
                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: "gpt-4o",
                        messages: [
                            {"role": "system", "content": "You are a helpful assistant. Please summarize the provided Amazon product reviews in markdown format. Focus on common pros and cons mentioned across multiple reviews and provide a concise overall summary conclusion. Structure it clearly with headings like 'Pros', 'Cons', and 'Summary'."},
                            {"role": "user", "content": `Here are the product reviews to summarize:\n\n${reviewsText}`}
                        ],
                        stream: true,
                    }),
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({})); // Try to get error details
                    throw new Error(`OpenAI API Error: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`);
                }

                if (!response.body) {
                    throw new Error('Response body is null, cannot read stream.');
                }

                // Process the stream
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let isFirst = true;
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const chunk = decoder.decode(value, { stream: true });
                    // SSE format sends data in lines like: data: { ... }
                    const lines = chunk.split('\n').filter(line => line.trim().startsWith('data:'));
                    for (const line of lines) {
                        const jsonStr = line.substring(5).trim(); // Remove 'data: '
                        if (jsonStr === '[DONE]') break; // Stream finished signal
                        try {
                            const parsed = JSON.parse(jsonStr);
                            const content = parsed.choices?.[0]?.delta?.content;
                            if (content) {
                                displaySummaryStream(content, isFirst);
                                isFirst = false;
                            }
                        } catch (parseError) {
                            console.error('Error parsing stream chunk:', jsonStr, parseError);
                        }
                    }
                }
                console.log("Stream finished.");

            } catch (error) {
                console.error("Error calling OpenAI API:", error);
                displaySummaryStream(`\n\n--- ERROR ---\n${error.message}`, isFirst);
                updatePopupContent(null, `Error during summarization: ${error.message}`);
            } finally {
                summarizeBtn.disabled = false; // Re-enable button
                summarizeBtn.textContent = 'Summarize Reviews';
            }

        } else {
            console.error("No reviews available to summarize.");
            updatePopupContent(null, 'Error: No reviews found to summarize.');
        }
    });
    return summarizeBtn;
}

/**
 * Displays the list of reviews in the popup.
 * @param {string[]} reviews - Array of review texts.
 */
function displayReviews(reviews) {
    if (!contentDiv) return;

    if (reviews.length > 0) {
        let html = `<h4>Reviews (${reviews.length}):</h4>`;
        updatePopupContent(html); // Set the title first

        // --- Create and Add Summarize Button --- 
        const summarizeBtn = createSummarizeButton();
        contentDiv.appendChild(summarizeBtn); // Append the button first
        // ---------------------------

        // --- Create and Add Reviews List ---
        const list = document.createElement('ul');
        // Display first 5 reviews
        reviews.slice(0, 5).forEach(review => {
            const item = document.createElement('li');
            item.textContent = review.substring(0, 100) + (review.length > 100 ? '...' : ''); // Truncate
            list.appendChild(item);
        });
        if (reviews.length > 5) {
            const moreItem = document.createElement('li');
            moreItem.textContent = `... and ${reviews.length - 5} more.`;
            list.appendChild(moreItem);
        }
        contentDiv.appendChild(list); // Append the list after the button
        // -----------------------------

        // Store the full list globally (consider chrome.storage.local for persistence)
        window.allReviews = reviews;
        console.log("Stored all reviews:", window.allReviews);
    } else {
        updatePopupContent(null, "No reviews found on this page.");
    }
}

/**
 * Handles logic for when the user is on a review page.
 * @param {number} tabId - The ID of the current tab.
 */
function handleReviewPage(tabId) {
    console.log("On review page. Sending message to content script.");
    chrome.tabs.sendMessage(tabId, { action: "getReviews" }, (response) => {
        if (chrome.runtime.lastError) {
            console.error("Error sending message:", chrome.runtime.lastError.message);
            updatePopupContent(null, `Error: ${chrome.runtime.lastError.message}. Try reloading the page.`);
            return;
        }

        if (response && response.reviews) {
            console.log("Received reviews:", response.reviews.length);
            displayReviews(response.reviews);
        } else {
            console.log("No response or reviews array missing.");
            updatePopupContent(null, "Could not retrieve reviews. Make sure you are on the reviews page and refresh.");
        }
    });
}

/**
 * Handles logic for when the user is on a product page.
 * @param {string} asin - The ASIN of the product.
 */
function handleProductPage(asin) {
    console.log("On product page. ASIN:", asin);
    const reviewUrl = `https://www.amazon.com/product-reviews/${asin}`;
    updatePopupContent(`You are on a product page. <a href="${reviewUrl}" target="_blank">Go to the Reviews Page</a> to summarize.`);
}

/**
 * Handles logic for when the user is on a non-relevant page.
 */
function handleGenericPage() {
    console.log("Not a relevant Amazon page.");
    updatePopupContent(null, "This extension works on Amazon product pages and product review pages.");
}

// --- Main Execution ---

document.addEventListener('DOMContentLoaded', async () => {
    contentDiv = document.getElementById('content');
    loadingDiv = document.getElementById('loading');

    if (!contentDiv || !loadingDiv) {
        console.error("Required DOM elements not found.");
        return;
    }

    toggleLoading(true);

    const currentTab = await getCurrentTab();

    if (!currentTab || !currentTab.url) {
        updatePopupContent(null, 'Could not get tab information.');
        return;
    }

    console.log("Current URL:", currentTab.url);
    const { type, asin } = getPageInfo(currentTab.url);

    switch (type) {
        case 'review':
            if (currentTab.id) {
                handleReviewPage(currentTab.id);
            } else {
                updatePopupContent(null, 'Could not get tab ID.');
            }
            break;
        case 'product':
            if (asin) {
                handleProductPage(asin);
            } else {
                // Should not happen if regex is correct, but handle defensively
                console.error("Product page detected but ASIN is missing.");
                handleGenericPage();
            }
            break;
        default: // 'other'
            handleGenericPage();
            break;
    }
});
