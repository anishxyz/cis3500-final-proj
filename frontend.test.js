const { test, expect } = require('@playwright/test');
const { JSDOM } = require('jsdom');

let dom, document, window, contentDiv, loadingDiv;

/**
 * Before each test, set up a new JSDOM instance to simulate the browser DOM,
 * create and append required DOM elements, and initialize necessary global variables.
 */
test.beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="content"></div><div id="loading"></div></body></html>');
    document = dom.window.document;
    window = dom.window;

    contentDiv = document.getElementById('content');
    loadingDiv = document.getElementById('loading');

    global.document = document;
    global.window = window;
    global.chrome = {
        runtime: {
            sendMessage: () => {}
        },
        tabs: {
            query: () => Promise.resolve([])
        },
        storage: {
            local: {
                get: () => Promise.resolve({}),
                set: () => Promise.resolve()
            }
        }
    };
});

/**
 * After each test, clean up the DOM and global variables.
 */
test.afterEach(() => {
    dom = null;
    document = null;
    window = null;
    contentDiv = null;
    loadingDiv = null;
    global.document = undefined;
    global.window = undefined;
    global.chrome = undefined;
});

/**
 * Test case: Simulate visiting a product page and verify the correct UI is displayed.
 */
test('Displays product page UI when URL matches product page regex', async () => {
    const mockUrl = 'https://www.amazon.com/asdfRandomProducName/dp/B0DLNYJ3YR/';
    global.chrome.tabs.query = () => Promise.resolve([{ url: mockUrl }]);

    const { getPageInfo, handleProductPage } = require('./popup.js');

    const pageInfo = getPageInfo(mockUrl);
    expect(pageInfo.type).toBe('product');
    expect(pageInfo.asin).toBe('B0DLNYJ3YR');

    handleProductPage(pageInfo.asin);

    expect(contentDiv.innerHTML).toContain('Go to the Reviews Page');
    expect(contentDiv.innerHTML).toContain('https://www.amazon.com/product-reviews/B0DLNYJ3YR');
});

/**
 * Test case: Simulate visiting a review page and verify the correct UI is displayed.
 */
test('Displays review page UI when URL matches review page regex', async () => {
    const mockUrl = 'https://www.amazon.com/product-reviews/B0DLNYJ3YR';
    global.chrome.tabs.query = () => Promise.resolve([{ url: mockUrl }]);

    const { getPageInfo, handleReviewPage } = require('./popup.js');

    const pageInfo = getPageInfo(mockUrl);
    expect(pageInfo.type).toBe('review');
    expect(pageInfo.asin).toBe('B0DLNYJ3YR');

    global.chrome.runtime.sendMessage = (message, callback) => {
        if (message.action === 'getReviews') {
            callback({ reviews: ['Great product!', 'Not worth the price.'] });
        }
    };

    handleReviewPage(1);

    expect(contentDiv.innerHTML).toContain('Reviews (2):');
    expect(contentDiv.innerHTML).toContain('Great product!');
    expect(contentDiv.innerHTML).toContain('Not worth the price.');
});

/**
 * Test case: Simulate visiting a non-relevant page and verify the correct UI is displayed.
 */
test('Displays generic page UI when URL does not match any regex', async () => {
    const mockUrl = 'https://www.google.com';
    global.chrome.tabs.query = () => Promise.resolve([{ url: mockUrl }]);

    const { getPageInfo, handleGenericPage } = require('./popup.js');

    const pageInfo = getPageInfo(mockUrl);
    expect(pageInfo.type).toBe('other');
    expect(pageInfo.asin).toBeNull();

    handleGenericPage();

    expect(contentDiv.innerHTML).toContain('This extension works on Amazon product pages and product review pages.');
});
