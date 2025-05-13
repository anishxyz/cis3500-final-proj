# Amazon Review Summarizer

**Team: Anders Amlie, Juno Kim, Anish Agrawal**

---

## Project Description

Amazon Review Summarizer is a lightweight Chrome extension that provides a one-click summary of customer reviews on Amazon product pages. It uses GPT to extract and return a concise **pros and cons list**, helping users make quick and informed decisions without sifting through hundreds of lengthy, unstructured reviews.

---

## Setup Instructions

1. Clone or download this repository.

   ```bash
   git clone https://github.com/anishxyz/cis3500-final-proj.git
   ```

2. Navigate to chrome://extensions in your browser.
3. Enable Developer Mode (top right).
4. Click "Load unpacked" and select the project folder.
5. Navigate to any Amazon product page and click the extension icon to activate the summarizer.
6. When prompted in popup, enter OpenAI API Key

## Implemented Features

- One-click summarization of Amazon product reviews
- Clean, structured output with Pros & Cons
- GPT-powered review interpretation
- Popup UI
- Review scraping optimized for Amazon DOM structure
- Minimalist, Amazon-style design integration

## Individual Contributions

Juno Kim
- Frontend formatting for GPT response
- E2E Testing
- Final presentation and demo walkthrough

Anders Amlie
- Frontend logic for popup UI
- UI Styling

Anish Agrawal
- Integrated GPT summarization backend
- Prompt engineering for effective summarization

## Known Issues / Future Work
Known Issues
- May encounter rate-limiting when scraping large amounts of reviews
- Non-standard Amazon layouts (e.g., some international pages) may break scraping logic

Future Improvements
- Add conversational query support (e.g., “What did people say about battery life?”)
- Mobile device support via responsive UI
- Support for other review-heavy sites like Yelp, eBay, BestBuy
- Enhanced accessibility and screen reader support
- Display of pro/con frequency counts for data-driven shoppers
- Keyboard shortcut support for power users