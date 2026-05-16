/**
 * @file content/assertions.js
 * @description Assertion handlers for test steps.
 *
 * Each assertion type checks a DOM condition and either returns a
 * success result or throws an Error with a descriptive failure message.
 *
 * Depends on nothing from other content modules — all DOM access is
 * done inline via `document.querySelector`.
 */

/**
 * Run an assertion against the current page DOM.
 *
 * @param {object} data
 * @param {string} [data.assertionType='element-exists'] - The type of assertion.
 * @param {string} [data.selector]       - CSS selector for the target element.
 * @param {string} [data.expectedValue]  - Expected value (for text/value/URL checks).
 * @param {string} [data.value]          - Fallback for expectedValue.
 * @returns {{ success: boolean, actualResult: string }}
 * @throws {Error} If the assertion fails.
 */
function handleAssert(data) {
  const assertionType = data.assertionType || 'element-exists';
  const selector = data.selector;
  const expected = data.expectedValue || data.value || '';

  switch (assertionType) {
    case 'element-exists': {
      const el = document.querySelector(selector);
      if (!el) throw new Error(`Assertion failed: Element does not exist: ${selector}`);
      return { success: true, actualResult: `Element exists: ${selector}` };
    }

    case 'element-not-exists': {
      const el = document.querySelector(selector);
      if (el) throw new Error(`Assertion failed: Element exists but should not: ${selector}`);
      return { success: true, actualResult: `Element does not exist: ${selector}` };
    }

    case 'element-visible': {
      const el = document.querySelector(selector);
      if (!el) throw new Error(`Assertion failed: Element not found: ${selector}`);
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      const isVisible = rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden';
      if (!isVisible) throw new Error(`Assertion failed: Element not visible: ${selector}`);
      return { success: true, actualResult: `Element is visible: ${selector}` };
    }

    case 'text-contains': {
      const el = selector ? document.querySelector(selector) : document.body;
      if (!el) throw new Error(`Assertion failed: Element not found: ${selector}`);
      const text = el.textContent || el.innerText || '';
      if (!text.includes(expected)) {
        throw new Error(
          `Assertion failed: Text does not contain "${expected}". ` +
          `Actual text: "${text.substring(0, 100)}"`,
        );
      }
      return { success: true, actualResult: `Text contains "${expected}"` };
    }

    case 'value-equals': {
      const el = document.querySelector(selector);
      if (!el) throw new Error(`Assertion failed: Element not found: ${selector}`);
      const actual = el.value || el.textContent || '';
      if (actual !== expected) {
        throw new Error(
          `Assertion failed: Value does not equal "${expected}". Actual: "${actual}"`,
        );
      }
      return { success: true, actualResult: `Value equals "${expected}"` };
    }

    case 'url-matches': {
      const currentUrl = window.location.href;
      if (!currentUrl.includes(expected)) {
        throw new Error(
          `Assertion failed: URL does not match "${expected}". Actual URL: "${currentUrl}"`,
        );
      }
      return { success: true, actualResult: `URL matches "${expected}"` };
    }

    default:
      throw new Error(`Unknown assertion type: ${assertionType}`);
  }
}

/**
 * Wait Until — polls every 500ms for an assertion condition to be met.
 *
 * Uses the same assertion types as handleAssert but retries until the
 * condition passes or the timeout is reached.
 *
 * @param {object} data
 * @param {string} [data.assertionType='element-exists'] - The condition to wait for.
 * @param {string} [data.selector]       - CSS selector for the target element.
 * @param {string} [data.expectedValue]  - Expected value (for text/value/URL checks).
 * @param {number} [data.timeout=30000]  - Maximum wait time in milliseconds.
 * @returns {Promise<{ success: boolean, actualResult: string }>}
 * @throws {Error} If the condition is not met within the timeout.
 */
async function handleWaitUntil(data) {
  const timeout = data.timeout || 30000;
  const interval = 500;
  const deadline = Date.now() + timeout;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const result = handleAssert(data);
      return { success: true, actualResult: `Wait Until satisfied: ${result.actualResult}` };
    } catch (e) {
      lastError = e;
    }
    await new Promise((r) => setTimeout(r, interval));
  }

  throw new Error(
    `Wait Until timed out after ${timeout}ms: ${lastError?.message || 'condition not met'}`,
  );
}
