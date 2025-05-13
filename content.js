// content.js

/**
 * Listener for messages from the extension popup or background scripts.
 * When a message with action "getReviews" is received, it queries the DOM for
 * review elements, extracts their text content, and returns an array of reviews.
 *
 * @param {Object} request - The message object received, expected to have an "action" property.
 * @param {Object} sender - The sender of the message.
 * @param {function} sendResponse - Function used to send the response back.
 * @returns {boolean} Returns true to indicate asynchronous response.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getReviews") {
    console.log("Content script received getReviews request");
    const reviewElements = document.querySelectorAll('[data-hook="review-body"] > span');
    const reviews = [];
    reviewElements.forEach(span => {
      // Check if the span has text content and trim it before adding to the reviews array.
      const reviewText = span.textContent ? span.textContent.trim() : '';
      if (reviewText) {
         reviews.push(reviewText);
      }
    });
    console.log(`Found ${reviews.length} reviews.`);
    sendResponse({ reviews: reviews });
    return true; // Keep the message channel open for async response
  }
});

// Log to confirm that the content script is loaded on the page.
console.log("Amazon Review Summarizer content script loaded on:", window.location.href);
