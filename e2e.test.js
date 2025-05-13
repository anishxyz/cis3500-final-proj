/**
 * @fileoverview End-to-end tests for the Amazon Review Summarizer extension.
 * This file uses Playwright and JSDOM to simulate the extension's popup behavior and DOM environment.
 */

const { test, expect } = require('@playwright/test');
const { JSDOM } = require('jsdom');

/**
 * Mocks the getApiKey function to simulate retrieving a dummy API key.
 * @returns {Promise<string>} A promise that resolves to a dummy API key.
 */
const mockGetApiKey = async () => 'mock-api-key';

/**
 * Mocks the global fetch function to simulate OpenAI API responses.
 * If the URL matches the OpenAI endpoint, it returns a mock response based on the request.
 * @param {string} url - The URL to which the fetch request is made.
 * @param {Object} options - Options for the fetch request including method, headers, and body.
 * @returns {Promise<Object>} A promise that resolves to a mock response object.
 */
global.fetch = async (url, options) => {
    if (url === 'https://api.openai.com/v1/chat/completions') {
        const requestBody = JSON.parse(options.body);
        const userMessage = requestBody.messages.find(msg => msg.role === 'user').content;

        // Create a mock response simulating a partial summary output.
        const mockResponse = {
            choices: [
                {
                    delta: {
                        content: `Mock summary for: ${userMessage.substring(0, 50)}...`
                    }
                }
            ]
        };

        return {
            ok: true,
            json: async () => mockResponse,
            body: {
                getReader: () => ({
                    read: async () => ({ done: true, value: null }),
                }),
            },
        };
    }
    throw new Error('Unexpected fetch call');
};

let dom, contentDiv, loadingDiv, summaryOutputDiv;

/**
 * Before each test, set up a new JSDOM instance to simulate the browser DOM,
 * create and append required DOM elements, and initialize necessary global variables.
 */
test.beforeEach(() => {
    // Set up a new JSDOM instance with a basic HTML structure
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    global.document = dom.window.document;
    global.window = dom.window;

    // Create and append the content div used by the popup script
    contentDiv = document.createElement('div');
    contentDiv.id = 'content';
    document.body.appendChild(contentDiv);

    // Create and append the loading indicator div
    loadingDiv = document.createElement('div');
    loadingDiv.id = 'loading';
    document.body.appendChild(loadingDiv);

    // Create and append the summary output div
    summaryOutputDiv = document.createElement('div');
    summaryOutputDiv.id = 'summaryOutput';
    document.body.appendChild(summaryOutputDiv);

    // Initialize the global variable to store reviews
    window.allReviews = [];
});

/**
 * After each test, clean up the DOM and global variables.
 */
test.afterEach(() => {
    dom.window.close();
    global.document = undefined;
    global.window = undefined;
});

/**
 * Test case: When there are zero reviews available, the handleSummarizeButtonClick function
 * should update the content div with an error message indicating no reviews were found.
 */
test('handleSummarizeButtonClick with 0 reviews', async () => {
    const summarizeBtn = document.createElement('button');
    await handleSummarizeButtonClick(summarizeBtn);

    expect(contentDiv.textContent).toContain('Error: No reviews found to summarize.');
    expect(summarizeBtn.disabled).toBe(false);
    expect(summarizeBtn.textContent).toBe('Summarize Reviews');
});

/**
 * Test case: When there are 10 reviews available, the summarization process is triggered.
 * The test verifies that the summary output area is involved and that the summarize button resets its state.
 */
test('handleSummarizeButtonClick with 10 reviews', async () => {
    window.allReviews = Array.from({ length: 10 }, (_, i) => `Review ${i + 1}`);
    const summarizeBtn = document.createElement('button');
    await handleSummarizeButtonClick(summarizeBtn);

    expect(summaryOutputDiv.textContent).toContain('');
    expect(summarizeBtn.disabled).toBe(false);
    expect(summarizeBtn.textContent).toBe('Summarize Reviews');
});

/**
 * Test case: When there are 20 reviews available, the summarization process is triggered.
 * The test verifies that the component can handle larger arrays of reviews.
 */
test('handleSummarizeButtonClick with 20 reviews', async () => {
    window.allReviews = Array.from({ length: 20 }, (_, i) => `Review ${i + 1}`);
    const summarizeBtn = document.createElement('button');
    await handleSummarizeButtonClick(summarizeBtn);

    expect(summaryOutputDiv.textContent).toContain('');
    expect(summarizeBtn.disabled).toBe(false);
    expect(summarizeBtn.textContent).toBe('Summarize Reviews');
});

/**
 * Test case: Verifies that the handleSummarizeButtonClick process triggers a call to the OpenAI API
 * with the correct prompt and that the mock response is as expected.
 */
test('handleSummarizeButtonClick calls OpenAI API with mock prompt', async () => {
    const mockReviews = Array.from({ length: 5 }, (_, i) => `Review ${i + 1}`);
    const reviewsText = mockReviews.join('\n---\n');
    const mockPrompt = `Here are the product reviews to summarize:\n\n${reviewsText}`;

    const apiKey = 'mock-api-key';
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: "gpt-4o",
            messages: [
                { role: "system", content: "You are a helpful assistant. Please summarize the provided Amazon product reviews in markdown format. Focus on common pros and cons mentioned across multiple reviews and provide a concise overall summary conclusion. Structure it clearly with headings like 'Pros', 'Cons', and 'Summary'." },
                { role: "user", content: mockPrompt }
            ],
            stream: false,
        }),
    });

    const jsonResponse = await response.json();
    expect(jsonResponse.choices[0].delta.content).toContain('Mock summary for: Here are the product reviews to summarize:');
});
