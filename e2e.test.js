const { test, expect } = require('@playwright/test');
const { JSDOM } = require('jsdom');

// Mock the `getApiKey` function to return a dummy API key
const mockGetApiKey = async () => 'mock-api-key';

// Mock the `fetch` function to simulate OpenAI API responses
global.fetch = async (url, options) => {
    if (url === 'https://api.openai.com/v1/chat/completions') {
        const requestBody = JSON.parse(options.body);
        const userMessage = requestBody.messages.find(msg => msg.role === 'user').content;

        // Simulate a response based on the mock prompt
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

test.beforeEach(() => {
    // Set up a new JSDOM instance
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    global.document = dom.window.document;
    global.window = dom.window;

    // Set up mock DOM elements
    contentDiv = document.createElement('div');
    contentDiv.id = 'content';
    document.body.appendChild(contentDiv);

    loadingDiv = document.createElement('div');
    loadingDiv.id = 'loading';
    document.body.appendChild(loadingDiv);

    summaryOutputDiv = document.createElement('div');
    summaryOutputDiv.id = 'summaryOutput';
    document.body.appendChild(summaryOutputDiv);

    // Mock global variables
    window.allReviews = [];
});

test.afterEach(() => {
    // Clean up DOM elements
    dom.window.close();
    global.document = undefined;
    global.window = undefined;
});

test('handleSummarizeButtonClick with 0 reviews', async () => {
    const summarizeBtn = document.createElement('button');
    await handleSummarizeButtonClick(summarizeBtn);

    expect(contentDiv.textContent).toContain('Error: No reviews found to summarize.');
    expect(summarizeBtn.disabled).toBe(false);
    expect(summarizeBtn.textContent).toBe('Summarize Reviews');
});

test('handleSummarizeButtonClick with 10 reviews', async () => {
    window.allReviews = Array.from({ length: 10 }, (_, i) => `Review ${i + 1}`);
    const summarizeBtn = document.createElement('button');
    await handleSummarizeButtonClick(summarizeBtn);

    expect(summaryOutputDiv.textContent).toContain('');
    expect(summarizeBtn.disabled).toBe(false);
    expect(summarizeBtn.textContent).toBe('Summarize Reviews');
});

test('handleSummarizeButtonClick with 20 reviews', async () => {
    window.allReviews = Array.from({ length: 20 }, (_, i) => `Review ${i + 1}`);
    const summarizeBtn = document.createElement('button');
    await handleSummarizeButtonClick(summarizeBtn);

    expect(summaryOutputDiv.textContent).toContain('');
    expect(summarizeBtn.disabled).toBe(false);
    expect(summarizeBtn.textContent).toBe('Summarize Reviews');
});

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
