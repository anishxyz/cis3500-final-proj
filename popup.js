// popup.js

// Constants
const REVIEW_PAGE_REGEX = /^https:\/\/www\.amazon\.com\/product-reviews\/([A-Z0-9]{10})/;
const PRODUCT_PAGE_REGEX = /^https:\/\/www\.amazon\.com\/.*\/dp\/([A-Z0-9]{10})/;

// DOM Elements
let contentDiv;
let loadingDiv;

// Helper Functions

/** Toggles loading indicator visibility */
function toggleLoading(show) {
    if (loadingDiv) {
        loadingDiv.style.display = show ? 'block' : 'none';
    }
}

/** Updates popup content and hides loading */
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

/** Gets current active tab */
async function getCurrentTab() {
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        return tabs[0] || null;
    } catch (error) {
        console.error("Error querying tabs:", error);
        return null;
    }
}

/** Analyzes URL for page type and ASIN */
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
 * Placeholder to get OpenAI API key. 
 * **IMPORTANT:** Replace with secure storage (chrome.storage.local).
 */
async function getApiKey() {
    try {
        const result = await chrome.storage.local.get('openaiApiKey');
        console.log('Stored API key:', result.openaiApiKey);
        return result.openaiApiKey || null;
    } catch (error) {
        console.error("Error retrieving API key from storage:", error);
        return null;
    }
}


/** Appends streamed summary content to #summaryOutput in DOM format */
function displaySummaryStream(chunk, isFirstChunk = false) {
    let summaryOutputDiv = document.getElementById('summaryOutput');

    // Create the element if it doesn't exist
    if (!summaryOutputDiv) {
        summaryOutputDiv = document.createElement('div');
        summaryOutputDiv.id = 'summaryOutput';
        summaryOutputDiv.style.display = 'none'; // Initially hidden
        summaryOutputDiv.style.marginTop = '10px'; // Add some spacing
        contentDiv.appendChild(summaryOutputDiv); // Append to the main content area
    }

    if (isFirstChunk) {
        summaryOutputDiv.innerHTML = ''; // Clear previous summary
        summaryOutputDiv.style.display = 'block'; // Make visible
    }

    // Parse the chunk as HTML and append it to the summaryOutputDiv
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = chunk; // Parse the chunk as HTML
    while (tempDiv.firstChild) {
        summaryOutputDiv.appendChild(tempDiv.firstChild); // Append each child element
    }
}

/** Creates the 'Summarize Reviews' button */
function createSummarizeButton() {
    const summarizeBtn = document.createElement('button');
    summarizeBtn.id = 'summarizeBtn';
    summarizeBtn.textContent = 'Summarize Reviews';
    summarizeBtn.style.marginBottom = '10px'; // Add some spacing below

    summarizeBtn.addEventListener('click', async () => {
        console.log("Summarize button clicked.");
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

            const reviewsText = window.allReviews.join('\n---\n'); 
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
                            {"role": "system", "content": "You are a helpful assistant. Please summarize the provided Amazon product reviews in raw text format. Focus on common pros and cons mentioned across multiple reviews and provide a concise overall summary conclusion. Structure it clearly with headings like 'Pros', 'Cons', and 'Summary', but don't use asterixes to bold any headings, this is raw text."},
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


                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let isFirst = true;
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const chunk = decoder.decode(value, { stream: true });
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
                displaySummaryStream('\n\n--- END OF SUMMARY ---', false);

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

/** Displays review list (and summarize button) */
function displayReviews(reviews) {
    if (!contentDiv) return;

    if (reviews.length > 0) {
        let html = `<h4>Reviews (${reviews.length}):</h4>`;
        updatePopupContent(html); // Set the title first

        const summarizeBtn = createSummarizeButton();
        contentDiv.appendChild(summarizeBtn); // Append the button first

        const list = document.createElement('ul');
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

        window.allReviews = reviews;
        console.log("Stored all reviews:", window.allReviews);
    } else {
        updatePopupContent(null, "No reviews found on this page.");
    }
}

/** Handles review page logic (sends message to content script) */
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

/** Handles product page logic (shows link to reviews) */
function handleProductPage(asin) {
    console.log("On product page. ASIN:", asin);
    const reviewUrl = `https://www.amazon.com/product-reviews/${asin}`;
    updatePopupContent(`You are on a product page. <a href="${reviewUrl}" target="_blank">Go to the Reviews Page</a> to summarize.`);
}

/** Handles non-relevant page logic */
function handleGenericPage() {
    console.log("Not a relevant Amazon page.");
    updatePopupContent(null, "This extension works on Amazon product pages and product review pages.");
}

/** Checks for OpenAI API key and displays status */
async function checkApiKeyStatus() {
    const apiKeyStatusDiv = document.getElementById('apiKeyStatus');
    if (!apiKeyStatusDiv) {
        console.error("API key status element not found.");
        return;
    }

    try {
        const result = await chrome.storage.local.get('openaiApiKey');
        const apiKey = result.openaiApiKey;

        if (apiKey) {
            apiKeyStatusDiv.innerHTML = 'OpenAI API key detected.';
        } else {
            apiKeyStatusDiv.innerHTML = 'No OpenAI API key found. Please enter your API key below.';
            displayApiKeyInputForm();
        }
    } catch (error) {
        console.error("Error checking API key status:", error);
        apiKeyStatusDiv.innerHTML = 'Error checking API key status.';
    }
}

/** Displays a form for the user to input their OpenAI API key */
function displayApiKeyInputForm() {
    const apiKeyFormDiv = document.getElementById('apiKeyForm');
    if (!apiKeyFormDiv) {
        console.error("API key form element not found.");
        return;
    }

    apiKeyFormDiv.innerHTML = `
        <label for="apiKeyInput">Enter OpenAI API Key:</label>
        <input type="text" id="apiKeyInput" placeholder="Your API Key" style="width: 100%; margin-bottom: 10px;">
        <button id="saveApiKeyBtn">Save API Key</button>
    `;

    const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
    saveApiKeyBtn.addEventListener('click', async () => {
        const apiKeyInput = document.getElementById('apiKeyInput');
        const apiKey = apiKeyInput.value.trim();

        if (apiKey) {
            try {
                await chrome.storage.local.set({ openaiApiKey: apiKey });
                console.log("API key saved successfully.");
                document.getElementById('apiKeyStatus').innerHTML = 'OpenAI API key saved successfully.';
                apiKeyFormDiv.innerHTML = ''; // Clear the form
            } catch (error) {
                console.error("Error saving API key:", error);
                document.getElementById('apiKeyStatus').innerHTML = 'Error saving API key.';
            }
        } else {
            alert("Please enter a valid API key.");
        }
    });
}

// Main Execution

// Call the function to check API key status on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    const apiKeyStatusDiv = document.createElement('div');
    apiKeyStatusDiv.id = 'apiKeyStatus';
    apiKeyStatusDiv.style.marginBottom = '10px';

    const apiKeyFormDiv = document.createElement('div');
    apiKeyFormDiv.id = 'apiKeyForm';

    const apiKeyDiv = document.getElementById('apiKey');
    if (apiKeyDiv) {
        apiKeyDiv.appendChild(apiKeyFormDiv);
        apiKeyDiv.appendChild(apiKeyStatusDiv);
        console.log("API key status div added to content.", apiKeyStatusDiv);
    }

    checkApiKeyStatus();
});

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
                console.error("Product page detected but ASIN is missing.");
                handleGenericPage();
            }
            break;
        default: // 'other'
            handleGenericPage();
            break;
    }
});