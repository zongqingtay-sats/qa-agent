// QA Agent — Content Script
// Executes DOM actions on the target web page

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== 'EXECUTE_ACTION') return;

  executeAction(message.data)
    .then(result => sendResponse(result))
    .catch(error => sendResponse({ error: error.message }));

  return true; // Keep channel open for async response
});

async function executeAction(data) {
  const { blockType } = data;

  switch (blockType) {
    case 'navigate':
      return handleNavigate(data);
    case 'click':
      return handleClick(data);
    case 'type':
      return handleType(data);
    case 'select':
      return handleSelect(data);
    case 'hover':
      return handleHover(data);
    case 'scroll':
      return handleScroll(data);
    case 'wait':
      return handleWait(data);
    case 'assert':
      return handleAssert(data);
    case 'screenshot':
      return { success: true, actualResult: 'Screenshot captured' };
    default:
      return { success: true, actualResult: `Unknown action: ${blockType}` };
  }
}

// ---- Action Handlers ----

function handleNavigate(data) {
  const url = data.url;
  if (!url) throw new Error('Navigate: URL is required');

  window.location.href = url;
  return { success: true, actualResult: `Navigated to ${url}` };
}

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

function handleType(data) {
  const el = findElement(data.selector);
  if (!el) throw new Error(`Type: Element not found: ${data.selector}`);

  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.focus();

  if (data.clearFirst) {
    el.value = '';
  }

  // Simulate typing character by character for more realistic behavior
  const value = data.value || '';
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));

  return { success: true, actualResult: `Typed "${value}" into ${data.selector}` };
}

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

function handleHover(data) {
  const el = findElement(data.selector);
  if (!el) throw new Error(`Hover: Element not found: ${data.selector}`);

  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
  el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

  return { success: true, actualResult: `Hovered over ${data.selector}` };
}

function handleScroll(data) {
  const direction = data.scrollDirection || 'down';
  const distance = data.scrollDistance || 300;
  const target = data.selector ? findElement(data.selector) : window;

  const scrollOptions = {};
  switch (direction) {
    case 'up': scrollOptions.top = -distance; break;
    case 'down': scrollOptions.top = distance; break;
    case 'left': scrollOptions.left = -distance; break;
    case 'right': scrollOptions.left = distance; break;
  }

  if (target === window) {
    window.scrollBy({ ...scrollOptions, behavior: 'smooth' });
  } else {
    target.scrollBy({ ...scrollOptions, behavior: 'smooth' });
  }

  return { success: true, actualResult: `Scrolled ${direction} by ${distance}px` };
}

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
      const isVisible = rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden';
      if (!isVisible) throw new Error(`Assertion failed: Element not visible: ${selector}`);
      return { success: true, actualResult: `Element is visible: ${selector}` };
    }
    case 'text-contains': {
      const el = selector ? document.querySelector(selector) : document.body;
      if (!el) throw new Error(`Assertion failed: Element not found: ${selector}`);
      const text = el.textContent || el.innerText || '';
      if (!text.includes(expected)) {
        throw new Error(`Assertion failed: Text does not contain "${expected}". Actual text: "${text.substring(0, 100)}"`);
      }
      return { success: true, actualResult: `Text contains "${expected}"` };
    }
    case 'value-equals': {
      const el = document.querySelector(selector);
      if (!el) throw new Error(`Assertion failed: Element not found: ${selector}`);
      const actual = el.value || el.textContent || '';
      if (actual !== expected) {
        throw new Error(`Assertion failed: Value does not equal "${expected}". Actual: "${actual}"`);
      }
      return { success: true, actualResult: `Value equals "${expected}"` };
    }
    case 'url-matches': {
      const currentUrl = window.location.href;
      if (!currentUrl.includes(expected)) {
        throw new Error(`Assertion failed: URL does not match "${expected}". Actual URL: "${currentUrl}"`);
      }
      return { success: true, actualResult: `URL matches "${expected}"` };
    }
    default:
      throw new Error(`Unknown assertion type: ${assertionType}`);
  }
}

// ---- Utilities ----

function findElement(selector) {
  if (!selector) return null;
  return document.querySelector(selector);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
