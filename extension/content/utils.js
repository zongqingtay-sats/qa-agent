/**
 * @file content/utils.js
 * @description DOM utility functions shared by all content-script action
 * handlers. Loaded first so that action and assertion modules can call
 * these helpers without import statements (content scripts share scope).
 */

/**
 * Locate a single DOM element using a CSS selector.
 *
 * @param {string} selector - A valid CSS selector string.
 * @returns {Element|null} The first matching element, or null.
 */
function findElement(selector) {
  if (!selector) return null;
  return document.querySelector(selector);
}

/**
 * Pause execution for the given number of milliseconds.
 *
 * @param {number} ms - Duration in milliseconds.
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Poll for an element to appear or disappear within a timeout.
 *
 * Checks every 100 ms. Throws if the condition is not met before the
 * deadline.
 *
 * @param {string}  selector    - CSS selector to watch.
 * @param {number}  timeout     - Maximum wait time in milliseconds.
 * @param {boolean} shouldExist - `true` to wait for appearance,
 *                                `false` to wait for disappearance.
 * @returns {Promise<Element|null>} The element (if waiting for existence)
 *   or null (if waiting for removal).
 * @throws {Error} If the timeout is reached.
 */
async function waitForElement(selector, timeout, shouldExist) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const el = document.querySelector(selector);
    if (shouldExist && el) return el;
    if (!shouldExist && !el) return null;
    await sleep(100);
  }

  if (shouldExist) {
    throw new Error(`Timeout waiting for element: ${selector}`);
  }
  throw new Error(`Timeout waiting for element to disappear: ${selector}`);
}
