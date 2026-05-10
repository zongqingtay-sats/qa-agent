/**
 * @file background/scraper.js
 * @description Handles the SCRAPE_PAGE flow: opens a background tab,
 * waits for the page to settle, scrapes the HTML via the content script,
 * then closes the tab and returns the result to the web app.
 */

import { waitForTabLoad, waitForPageReady } from './tab-utils.js';

/**
 * Scrape the DOM of a given URL and send the result back through the port.
 *
 * A new tab is created in the background (not focused) to avoid
 * interrupting the user. The content script strips large data-URIs,
 * inline scripts, and style blocks to keep the payload manageable.
 *
 * @param {chrome.runtime.Port} port - The port to send the result back on.
 * @param {string}              url  - The URL to scrape.
 * @returns {Promise<void>}
 */
export async function handleScrapePage(port, url) {
  try {
    // Open a hidden tab for scraping
    const tab = await chrome.tabs.create({ url, active: false });
    await waitForTabLoad(tab.id);

    // Inject all content-script files (manifest auto-injects on page load,
    // but programmatic injection requires listing them explicitly)
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content/utils.js', 'content/actions.js', 'content/assertions.js', 'content-script.js'],
      });
    } catch (e) {
      console.warn('[QA Agent] Content script injection skipped:', e.message);
    }

    // Wait for the page DOM to stabilise before scraping
    await waitForPageReady(tab.id);

    // Request scraped HTML from the content script
    const result = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tab.id, { type: 'SCRAPE_PAGE' }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response?.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });

    // Cleanup
    await chrome.tabs.remove(tab.id);

    port.postMessage({ type: 'SCRAPE_RESULT', ...result });
  } catch (error) {
    port.postMessage({ type: 'SCRAPE_RESULT', error: error.message || String(error) });
  }
}
