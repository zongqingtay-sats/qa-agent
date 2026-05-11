/**
 * @file background/messaging.js
 * @description Registers all Chrome message listeners:
 *
 * 1. **External connections** (`onConnectExternal`) — long-lived ports
 *    from the QA Agent web app for test execution and page scraping.
 * 2. **External one-time messages** (`onMessageExternal`) — PING/PONG
 *    handshake used by the web app to detect the extension.
 * 3. **Internal messages** (`onMessage`) — commands from the popup
 *    (pause / resume / retry / get-status).
 */

import { get, set } from './state.js';
import { broadcastStatus } from './badge.js';
import { startTestExecution } from './execution.js';
import { stopTestExecution } from './flow.js';
import { handleScrapePage } from './scraper.js';

/**
 * Initialise all message listeners.
 * Called once from the service-worker entry point.
 */
export function registerListeners() {
  // ── Long-lived connections from the web app ──
  chrome.runtime.onConnectExternal.addListener((port) => {
    console.log('[QA Agent] External connection from:', port.sender?.origin);
    get('connectedPorts').set(port.sender?.origin, port);

    port.onMessage.addListener(async (message) => {
      console.log('[QA Agent] Received message:', message.type);

      switch (message.type) {
        case 'CONNECT':
          set('hasConnectedBefore', true);
          port.postMessage({ type: 'CONNECTED', extensionId: chrome.runtime.id });
          broadcastStatus('connected');
          break;

        case 'EXECUTE_TEST':
          await startTestExecution(
            port, message.testFlow, message.testCaseId,
            message.baseUrl, message.testName, message.testRunId,
          );
          break;

        case 'STOP_TEST':
          stopTestExecution(port);
          break;

        case 'SCRAPE_PAGE':
          await handleScrapePage(port, message.url);
          break;

        case 'PICK_ELEMENT':
          await handlePickElement(port, message.tabId);
          break;

        case 'LIST_TABS':
          await handleListTabs(port);
          break;

        case 'OPEN_TAB':
          await handleOpenTab(port, message.url);
          break;
      }
    });

    port.onDisconnect.addListener(() => {
      get('connectedPorts').delete(port.sender?.origin);
      console.log('[QA Agent] Port disconnected');

      // Only show disconnected if no other ports remain and we're not mid-test
      const status = get('currentStatus');
      if (get('connectedPorts').size === 0 && status !== 'completed' && status !== 'failed') {
        broadcastStatus('disconnected');
      }
    });
  });

  // ── One-time messages from the web app (PING handshake) ──
  chrome.runtime.onMessageExternal.addListener((message, _sender, sendResponse) => {
    if (message.type === 'PING') {
      set('hasConnectedBefore', true);
      sendResponse({ type: 'PONG', extensionId: chrome.runtime.id });
      return true; // keep the message channel open for async response
    }
  });

  // ── Internal messages from the popup ──
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'GET_STATUS') {
      sendResponse(getStatusPayloadFromState());
      return true;
    }

    const testName = get('currentTestName');
    const step = get('currentStepIndex') + 1;
    const total = get('actionableStepCount') || 0;

    if (message.type === 'PAUSE_TEST') {
      set('isPaused', true);
      broadcastStatus('paused', { testName, currentStep: step, totalSteps: total });
    } else if (message.type === 'RESUME_TEST') {
      set('isPaused', false);
      broadcastStatus('running', { testName, currentStep: step, totalSteps: total });
      resolvePause('resume');
    } else if (message.type === 'RETRY_STEP') {
      set('isPaused', false);
      broadcastStatus('running', { testName, currentStep: step, totalSteps: total });
      resolvePause('retry');
    }
  });
}

// ── Private helpers ────────────────────────────────────────────────

/**
 * Send PICK_ELEMENT to the active tab's content script and relay the result.
 * @param {chrome.runtime.Port} port
 * @param {number} [tabId] - Optional specific tab to target.
 */
async function handlePickElement(port, tabId) {
  try {
    let targetTabId = tabId;
    if (!targetTabId) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('No active tab found');
      targetTabId = tab.id;
    }
    // Focus the tab so user can interact
    await chrome.tabs.update(targetTabId, { active: true });
    // Ensure content scripts are injected (no-op if already present)
    try {
      await chrome.scripting.executeScript({
        target: { tabId: targetTabId },
        files: [
          'content/utils.js',
          'content/actions.js',
          'content/assertions.js',
          'content/element-picker.js',
          'content-script.js',
        ],
      });
    } catch { /* already injected or restricted page */ }
    const result = await chrome.tabs.sendMessage(targetTabId, { type: 'PICK_ELEMENT' });
    port.postMessage({ type: 'PICK_ELEMENT_RESULT', ...result });
  } catch (err) {
    port.postMessage({ type: 'PICK_ELEMENT_RESULT', selector: '', error: err.message });
  }
}

/**
 * Return a list of open browser tabs to the web app.
 * @param {chrome.runtime.Port} port
 */
async function handleListTabs(port) {
  try {
    const tabs = await chrome.tabs.query({});
    const list = tabs
      .filter((t) => t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('chrome-extension://'))
      .map((t) => ({ id: t.id, title: t.title, url: t.url, favIconUrl: t.favIconUrl, active: t.active }));
    port.postMessage({ type: 'LIST_TABS_RESULT', tabs: list });
  } catch (err) {
    port.postMessage({ type: 'LIST_TABS_RESULT', tabs: [], error: err.message });
  }
}

/**
 * Open a new tab with the given URL and return its id.
 * @param {chrome.runtime.Port} port
 * @param {string} url
 */
async function handleOpenTab(port, url) {
  try {
    const tab = await chrome.tabs.create({ url, active: true });
    // Wait a moment for the page to start loading
    await new Promise((r) => setTimeout(r, 1500));
    port.postMessage({ type: 'OPEN_TAB_RESULT', tabId: tab.id });
  } catch (err) {
    port.postMessage({ type: 'OPEN_TAB_RESULT', error: err.message });
  }
}

/**
 * Build the status payload by reading directly from state.
 * @private
 * @returns {object}
 */
function getStatusPayloadFromState() {
  const payload = {
    status: get('currentStatus'),
    testCaseId: get('currentTestCaseId'),
    testRunId: get('currentTestRunId'),
    testName: get('currentTestName'),
    stepDescription: get('currentStepDescription'),
    error: get('currentError'),
    result: get('currentResult'),
    hasConnectedBefore: get('hasConnectedBefore'),
  };

  const order = get('currentExecutionOrder');
  if (order) {
    payload.currentStep = get('currentStepIndex') + 1;
    payload.totalSteps = get('actionableStepCount') || 0;
  }

  return payload;
}

/**
 * Resolve the pending pause promise (if one exists) and clear it.
 * @private
 * @param {'resume'|'retry'} action
 */
function resolvePause(action) {
  const resolve = get('pauseResolve');
  if (resolve) {
    resolve(action);
    set('pauseResolve', null);
  }
}
