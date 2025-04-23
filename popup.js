// popup.js

document.addEventListener('DOMContentLoaded', () => {
  const contentDiv = document.getElementById('content');
  const loadingDiv = document.getElementById('loading');

  loadingDiv.style.display = 'block'; // Show loading indicator

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    if (!currentTab || !currentTab.url) {
        contentDiv.textContent = 'Could not get tab information.';
        loadingDiv.style.display = 'none';
        return;
    }

    const url = currentTab.url;
    console.log("Current URL:", url);

    // Regex for product review pages
    const reviewPageRegex = /^https:\/\/www\.amazon\.com\/product-reviews\/([A-Z0-9]{10})/; 
    // Regex for product detail pages
    const productPageRegex = /^https:\/\/www\.amazon\.com\/.*\/dp\/([A-Z0-9]{10})/; 

    const reviewMatch = url.match(reviewPageRegex);
    const productMatch = url.match(productPageRegex);

    if (reviewMatch) {
      // On a review page, ask content script for reviews
      console.log("On review page. Sending message to content script.");
      chrome.tabs.sendMessage(currentTab.id, { action: "getReviews" }, (response) => {
        loadingDiv.style.display = 'none'; // Hide loading
        if (chrome.runtime.lastError) {
          console.error("Error sending message:", chrome.runtime.lastError.message);
          contentDiv.textContent = `Error: ${chrome.runtime.lastError.message}. Try reloading the page.`;
          return;
        }
        if (response && response.reviews) {
          console.log("Received reviews:", response.reviews.length);
          if (response.reviews.length > 0) {
             contentDiv.innerHTML = `<h4>Reviews (${response.reviews.length}):</h4>`;
             const list = document.createElement('ul');
             // Display first 5 reviews for brevity in popup
             response.reviews.slice(0, 5).forEach(review => {
                 const item = document.createElement('li');
                 item.textContent = review.substring(0, 100) + (review.length > 100 ? '...' : ''); // Truncate long reviews
                 list.appendChild(item);
             });
             if (response.reviews.length > 5) {
                 const moreItem = document.createElement('li');
                 moreItem.textContent = `... and ${response.reviews.length - 5} more.`;
                 list.appendChild(moreItem);
             }
             contentDiv.appendChild(list);
             // Store the full list for potential summarization later
             // You might want to store this more robustly (e.g., chrome.storage.local) if needed
             window.allReviews = response.reviews;
             console.log("Stored all reviews:", window.allReviews);
          } else {
             contentDiv.textContent = "No reviews found on this page.";
          }
        } else {
          contentDiv.textContent = "Could not retrieve reviews. Make sure you are on the reviews page and refresh.";
           console.log("No response or reviews array missing.");
        }
      });
    } else if (productMatch) {
      // On a product page, provide a link to the review page
      const asin = productMatch[1];
      const reviewUrl = `https://www.amazon.com/product-reviews/${asin}`;
      console.log("On product page. ASIN:", asin);
      contentDiv.innerHTML = `You are on a product page. <a href="${reviewUrl}" target="_blank">Go to the Reviews Page</a> to summarize.`;
      loadingDiv.style.display = 'none'; // Hide loading
    } else {
      // Not an Amazon product or review page
      console.log("Not a relevant Amazon page.");
      contentDiv.textContent = "This extension works on Amazon product pages and product review pages.";
      loadingDiv.style.display = 'none'; // Hide loading
    }
  });
});
