const { test, expect } = require('@playwright/test');
const { JSDOM } = require('jsdom');
const { displayReviews } = require('./popup');

// Enhanced Mock DOM setup
function setupMockDOM() {
    const dom = new JSDOM('<!DOCTYPE html><html><body><div id="content"></div><div id="loading" style="display:none;"></div></body></html>');
    global.document = dom.window.document;
    global.window = dom.window;
    global.console = dom.window.console; // Ensure console logs are captured
    return {
        contentDiv: document.getElementById('content'),
        loadingDiv: document.getElementById('loading'),
    };
}

test.describe('Amazon Review Summarizer Function Tests', () => {

    test('No reviews found on the review page', async () => {
        const { contentDiv } = setupMockDOM();

        // Call the function with no reviews
        displayReviews([]);

        // Check for the no reviews message
        expect(contentDiv.textContent).toContain('No reviews found on this page.');
    });

    test('More than 10 reviews found on the review page', async () => {
        const { contentDiv } = setupMockDOM();

        // Mock reviews
        const mockReviews = Array.from({ length: 15 }, (_, i) => `Review ${i + 1}`);

        // Call the function with more than 10 reviews
        displayReviews(mockReviews);

        // Check for the reviews displayed
        const listItems = contentDiv.querySelectorAll('ul > li');
        expect(listItems.length).toBe(6); // 5 reviews + 1 "... and X more" item

        // Check for the summarize button
        const summarizeButton = contentDiv.querySelector('#summarizeBtn');
        expect(summarizeButton).not.toBeNull();
    });

    test('Exactly 10 reviews found on the review page', async () => {
        const { contentDiv } = setupMockDOM();

        // Mock reviews
        const mockReviews = Array.from({ length: 10 }, (_, i) => `Review ${i + 1}`);

        // Call the function with exactly 10 reviews
        displayReviews(mockReviews);

        // Check for the reviews displayed
        const listItems = contentDiv.querySelectorAll('ul > li');
        expect(listItems.length).toBe(5); // Only 5 reviews are shown in the list

        // Check for the summarize button
        const summarizeButton = contentDiv.querySelector('#summarizeBtn');
        expect(summarizeButton).not.toBeNull();
    });

});
