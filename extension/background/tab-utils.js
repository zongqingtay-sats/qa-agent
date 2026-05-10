/**
 * @file background/tab-utils.js
 * @description Low-level helpers for interacting with Chrome tabs:
 * waiting for loads, executing content-script actions, capturing
 * screenshots, and waiting for page DOM stability.
 */

/**
 * Wait for a tab to reach the `complete` loading status.
 *
 * A 500 ms buffer is added after `complete` fires so that content scripts
 * have time to initialise before the caller sends messages to them.
 *
 * @param {number} tabId - Chrome tab ID to wait on.
 * @returns {Promise<void>}
 */
export async function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    /** @param {number} id @param {object} changeInfo */
    function listener(id, changeInfo) {
      if (id === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(resolve, 500);
      }
    }

    // The tab may already be loaded
    chrome.tabs.get(tabId, (tab) => {
      if (tab.status === 'complete') {
        setTimeout(resolve, 500);
      } else {
        chrome.tabs.onUpdated.addListener(listener);
      }
    });
  });
}

/**
 * Wait for the page DOM to stabilise (no more mutations) before scraping.
 *
 * The function injects a script that monitors `MutationObserver` activity.
 * If no mutations occur within 800 ms the page is considered settled.
 * A hard timeout prevents indefinite waiting on dynamic pages.
 *
 * @param {number} tabId              - Chrome tab ID.
 * @param {number} [timeout=10000]    - Hard timeout in milliseconds.
 * @returns {Promise<void>}
 */
export async function waitForPageReady(tabId, timeout = 10000) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (timeoutMs) => {
        return new Promise((resolve) => {
          // If the page hasn't finished loading, wait for the load event
          if (document.readyState !== 'complete') {
            window.addEventListener('load', () => setTimeout(resolve, 500), { once: true });
            setTimeout(resolve, timeoutMs);
            return;
          }

          // Monitor DOM mutations — resolve once they settle
          let timer = null;
          const observer = new MutationObserver(() => {
            clearTimeout(timer);
            timer = setTimeout(() => { observer.disconnect(); resolve(); }, 800);
          });
          observer.observe(document.body, { childList: true, subtree: true });

          // Default settle timer (no mutations at all → resolve quickly)
          timer = setTimeout(() => { observer.disconnect(); resolve(); }, 1500);

          // Hard timeout safety net
          setTimeout(() => { observer.disconnect(); resolve(); }, timeoutMs);
        });
      },
      args: [timeout],
    });
  } catch (e) {
    console.warn('[QA Agent] waitForPageReady failed, using fallback delay:', e.message);
    await new Promise((r) => setTimeout(r, 2000));
  }
}

/**
 * Execute a single test step in the target tab via the content script.
 *
 * The content script is (re-)injected before each message to handle cases
 * where page navigation has cleared the previous injection.
 *
 * @param {number} tabId     - Chrome tab ID.
 * @param {object} blockData - Step data from the test flow node.
 * @returns {Promise<object>} Result object from the content script.
 * @throws {Error} If the content script reports an error or communication fails.
 */
export async function executeStepInTab(tabId, blockData) {
  // Ensure the content script is present (idempotent).
  // All content-script files must be injected since they share scope.
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/utils.js', 'content/actions.js', 'content/assertions.js', 'content-script.js'],
    });
  } catch (e) {
    console.warn('[QA Agent] Content script injection skipped:', e.message);
  }

  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { type: 'EXECUTE_ACTION', data: blockData }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (response?.error) {
        reject(new Error(response.error));
        return;
      }
      resolve(response);
    });
  });
}

/**
 * Capture a PNG screenshot of the visible area in the given tab.
 *
 * The tab is focused first because `captureVisibleTab` only works on the
 * currently-active tab in a window. A brief delay lets the UI settle.
 *
 * @param {number} tabId - Chrome tab ID.
 * @returns {Promise<string>} data-URL of the captured PNG image.
 * @throws {Error} If screenshot capture fails.
 */
export async function captureScreenshot(tabId) {
  // Focus the tab so captureVisibleTab works
  try {
    const tab = await chrome.tabs.get(tabId);
    await chrome.windows.update(tab.windowId, { focused: true });
    await chrome.tabs.update(tabId, { active: true });
    await new Promise((r) => setTimeout(r, 200));
  } catch (e) {
    console.warn('[QA Agent] Could not focus tab:', e);
  }

  return new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(dataUrl);
      }
    });
  });
}
