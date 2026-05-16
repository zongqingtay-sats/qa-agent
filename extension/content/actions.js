/**
 * @file content/actions.js
 * @description DOM action handlers for test step execution.
 *
 * Each handler receives the step's `data` object (from the flow node)
 * and returns a result object `{ success, actualResult }` on success,
 * or throws on failure.
 *
 * Depends on `findElement`, `sleep`, and `waitForElement` from
 * `content/utils.js` (loaded earlier via manifest ordering).
 */

/**
 * Navigate the current page to a new URL.
 *
 * @param {object} data
 * @param {string} data.url - Target URL.
 * @returns {{ success: boolean, actualResult: string }}
 * @throws {Error} If no URL is provided.
 */
function handleNavigate(data) {
  const url = data.url;
  if (!url) throw new Error('Navigate: URL is required');
  window.location.href = url;
  return { success: true, actualResult: `Navigated to ${url}` };
}

/**
 * Click an element. Supports single, double, and right-click.
 *
 * @param {object} data
 * @param {string} data.selector  - CSS selector for the target element.
 * @param {string} [data.clickType='single'] - 'single' | 'double' | 'right'.
 * @returns {{ success: boolean, actualResult: string }}
 * @throws {Error} If the element is not found.
 */
function handleClick(data) {
  const el = findElement(data.selector);
  if (!el) throw new Error(`Click: Element not found: ${data.selector}`);

  el.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const clickType = data.clickType || 'single';
  if (clickType === 'double') {
    el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
  } else if (clickType === 'right') {
    el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
  } else {
    el.click();
  }

  return { success: true, actualResult: `Clicked ${data.selector}` };
}

/**
 * Type text into an input or textarea element.
 *
 * Sets the value directly and dispatches `input` + `change` events so
 * that frameworks (React, Vue, etc.) pick up the change.
 *
 * @param {object} data
 * @param {string} data.selector   - CSS selector for the input element.
 * @param {string} [data.value=''] - Text to type.
 * @param {boolean} [data.clearFirst=false] - Clear existing value first.
 * @returns {{ success: boolean, actualResult: string }}
 * @throws {Error} If the element is not found.
 */
function handleType(data) {
  const el = findElement(data.selector);
  if (!el) throw new Error(`Type: Element not found: ${data.selector}`);

  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.focus();

  if (data.clearFirst) el.value = '';

  const value = data.value || '';
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));

  return { success: true, actualResult: `Typed "${value}" into ${data.selector}` };
}

/**
 * Select an option in a `<select>` element.
 *
 * @param {object} data
 * @param {string} data.selector    - CSS selector for the select element.
 * @param {string} data.selectValue - The option value to select.
 * @returns {{ success: boolean, actualResult: string }}
 * @throws {Error} If the element is not found or is not a `<select>`.
 */
function handleSelect(data) {
  const el = findElement(data.selector);
  if (!el) throw new Error(`Select: Element not found: ${data.selector}`);

  el.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const selectValue = data.selectValue || data.value;
  if (el.tagName === 'SELECT') {
    el.value = selectValue;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    throw new Error(`Select: Element is not a <select>: ${data.selector}`);
  }

  return { success: true, actualResult: `Selected "${selectValue}" in ${data.selector}` };
}

/**
 * Dispatch hover (mouseenter + mouseover) events on an element.
 *
 * @param {object} data
 * @param {string} data.selector - CSS selector for the target element.
 * @returns {{ success: boolean, actualResult: string }}
 * @throws {Error} If the element is not found.
 */
function handleHover(data) {
  const el = findElement(data.selector);
  if (!el) throw new Error(`Hover: Element not found: ${data.selector}`);

  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
  el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

  return { success: true, actualResult: `Hovered over ${data.selector}` };
}

/**
 * Scroll the page or a specific element.
 *
 * @param {object} data
 * @param {string} [data.selector]              - Optional element to scroll (defaults to window).
 * @param {string} [data.scrollDirection='down'] - 'up' | 'down' | 'left' | 'right'.
 * @param {number} [data.scrollDistance=300]     - Distance in pixels.
 * @returns {{ success: boolean, actualResult: string }}
 */
function handleScroll(data) {
  const direction = data.scrollDirection || 'down';
  const distance = data.scrollDistance || 300;
  const target = data.selector ? findElement(data.selector) : window;

  const opts = {};
  switch (direction) {
    case 'up':    opts.top = -distance; break;
    case 'down':  opts.top = distance;  break;
    case 'left':  opts.left = -distance; break;
    case 'right': opts.left = distance;  break;
  }

  if (target === window) {
    window.scrollBy({ ...opts, behavior: 'smooth' });
  } else {
    target.scrollBy({ ...opts, behavior: 'smooth' });
  }

  return { success: true, actualResult: `Scrolled ${direction} by ${distance}px` };
}

/**
 * Wait for a fixed duration, or until an element appears / disappears.
 *
 * @param {object} data
 * @param {string} [data.waitType='time']  - 'time' | 'element-visible' | 'element-hidden'.
 * @param {number} [data.timeout=3000]     - Duration or timeout in ms.
 * @param {string} [data.selector]         - Selector (for element-based waits).
 * @returns {Promise<{ success: boolean, actualResult: string }>}
 */
async function handleWait(data) {
  const waitType = data.waitType || 'time';
  const timeout = data.timeout || 3000;

  if (waitType === 'time') {
    await sleep(timeout);
    return { success: true, actualResult: `Waited ${timeout}ms` };
  }

  if (waitType === 'element-visible') {
    await waitForElement(data.selector, timeout, true);
    return { success: true, actualResult: `Element ${data.selector} is visible` };
  }

  if (waitType === 'element-hidden') {
    await waitForElement(data.selector, timeout, false);
    return { success: true, actualResult: `Element ${data.selector} is hidden` };
  }

  return { success: true, actualResult: `Waited (${waitType})` };
}

/**
 * Capture the text content of an element and store it as a variable.
 *
 * The variable value is returned in `actualResult` and stored in the
 * global `__qaAgentVariables` map for use by subsequent steps.
 *
 * @param {object} data
 * @param {string} data.selector      - CSS selector for the element.
 * @param {string} data.variableName  - Name to store the value under.
 * @returns {{ success: boolean, actualResult: string, variableName: string, variableValue: string }}
 * @throws {Error} If the element is not found or variable name is missing.
 */
function handleSetVariable(data) {
  const { selector, variableName } = data;
  if (!variableName) throw new Error('Set Variable: Variable name is required');
  if (!selector) throw new Error('Set Variable: CSS selector is required');

  const el = findElement(selector);
  if (!el) throw new Error(`Set Variable: Element not found: ${selector}`);

  const capturedValue = el.value !== undefined && el.value !== '' ? el.value : (el.textContent || '').trim();

  // Store globally for use in subsequent steps
  if (!window.__qaAgentVariables) window.__qaAgentVariables = {};
  window.__qaAgentVariables[variableName] = capturedValue;

  return {
    success: true,
    actualResult: `Captured @${variableName} = "${capturedValue}"`,
    variableName,
    variableValue: capturedValue,
  };
}
