// content.js

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getReviews") {
    console.log("Content script received getReviews request");
    const reviewElements = document.querySelectorAll('[data-hook="review-body"] > span');
    const reviews = [];
    reviewElements.forEach(span => {
      // Check if the span itself has text content before accessing child nodes
      const reviewText = span.textContent ? span.textContent.trim() : '';
      if (reviewText) {
         reviews.push(reviewText);
      }
      // Alternative: sometimes the text is nested deeper, try to get all text
      // const reviewText = span.innerText || span.textContent;
      // if (reviewText && reviewText.trim()) {
      //     reviews.push(reviewText.trim());
      // }

    });
    console.log(`Found ${reviews.length} reviews.`);
    sendResponse({ reviews: reviews });
    return true; // Keep the message channel open for async response
  }
});

// Optional: Add a log to confirm the script is injected on the correct pages
console.log("Amazon Review Summarizer content script loaded on:", window.location.href);
