/**
 * @file content-script.js
 * @description Entry point for the QA Agent content script.
 *
 * Listens for messages from the background service worker and dispatches
 * them to the appropriate handler (page scraping or step execution).
 *
 * This file is loaded AFTER content/utils.js, content/actions.js, and
 * content/assertions.js via the manifest js array, so all handler
 * functions are already available in the shared scope.
 */

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // ── Element picker (used by the editor) ──
  if (message.type === 'PICK_ELEMENT') {
    pickElement().then((result) => sendResponse(result));
    return true; // keep channel open for async response
  }

  // ── Page scraping (used by the generate flow) ──
  if (message.type === 'SCRAPE_PAGE') {
    try {
      const html = document.documentElement.outerHTML
        .replace(/data:[^"')\s]{200,}/g, 'data:...')   // strip large data URIs
        .replace(/<script[\s\S]*?<\/script>/gi, '')      // strip inline scripts
        .replace(/<style[\s\S]*?<\/style>/gi, '');       // strip style blocks

      sendResponse({
        html: html.substring(0, 200000),  // cap at ~200 KB
        title: document.title,
        url: window.location.href,
      });
    } catch (error) {
      sendResponse({ error: error.message });
    }
    return true; // keep channel open for synchronous response
  }

  // ── Step execution ──
  if (message.type !== 'EXECUTE_ACTION') return;

  executeAction(message.data)
    .then((result) => sendResponse(result))
    .catch((error) => sendResponse({ error: error.message }));

  return true; // keep channel open for async response
});

/**
 * Dispatch a test step to the correct handler based on blockType.
 *
 * Each handler is defined in content/actions.js or content/assertions.js
 * and is available in the shared content-script scope.
 *
 * @param {object} data            - Step data from the flow node.
 * @param {string} data.blockType  - Identifies the action to perform.
 * @returns {Promise<{ success: boolean, actualResult: string }>}
 */
async function executeAction(data) {
  switch (data.blockType) {
    case 'navigate':   return handleNavigate(data);
    case 'click':      return handleClick(data);
    case 'type':       return handleType(data);
    case 'select':     return handleSelect(data);
    case 'hover':      return handleHover(data);
    case 'scroll':     return handleScroll(data);
    case 'wait':       return handleWait(data);
    case 'assert':     return handleAssert(data);
    case 'screenshot': return { success: true, actualResult: 'Screenshot captured' };
    default:           return { success: true, actualResult: `Unknown action: ${data.blockType}` };
  }
}
