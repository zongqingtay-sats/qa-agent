/**
 * @file background/step-handlers.js
 * @description Helpers for individual step execution within a test run.
 *
 * Handles navigation steps, step failure (screenshot + pause + retry),
 * and builds the uniform step-result objects sent back to the web app.
 */

import { get, set } from './state.js';
import { broadcastStatus } from './badge.js';
import { waitForTabLoad, captureScreenshot } from './tab-utils.js';

/**
 * Handle a navigation step by updating the tab URL directly instead of
 * going through the content script (which cannot change the page URL).
 *
 * @param {object} data        - Step data from the flow node.
 * @param {number} tabId       - Chrome tab ID.
 * @param {string} stepId      - Unique step identifier.
 * @param {object} node        - The flow graph node.
 * @param {number} stepStart   - Timestamp when the step started.
 * @param {Array}  stepResults - Accumulated results array (mutated in place).
 * @param {chrome.runtime.Port} port - Port to the web app.
 * @param {boolean} [isRetry=false] - Whether this is a retry attempt.
 * @returns {Promise<void>}
 */
export async function executeNavigationStep(data, tabId, stepId, node, stepStart, stepResults, port, isRetry = false) {
  let navUrl = data.url;

  // Resolve relative URLs against the configured base URL
  if (navUrl.startsWith('/')) {
    const base = get('currentBaseUrl').replace(/\/$/, '');
    navUrl = base + navUrl;
  }

  await chrome.tabs.update(tabId, { url: navUrl });
  await waitForTabLoad(tabId);

  const stepResult = buildStepResult(stepId, node, data, 'passed', stepStart, {
    actualResult: `Navigated to ${navUrl}`,
    retry: isRetry,
  });

  // Capture screenshot after navigation
  try {
    stepResult.screenshot = await captureScreenshot(tabId);
  } catch (e) {
    console.warn('[QA Agent] Screenshot failed:', e);
  }

  stepResults.push(stepResult);
  port.postMessage({ type: 'STEP_COMPLETE', ...stepResult });
}

/**
 * Handle a step failure: capture an error screenshot, pause execution,
 * and wait for the user to retry or abandon the test.
 *
 * @param {object} opts
 * @param {Error}  opts.error
 * @param {number} opts.tabId
 * @param {string} opts.stepId
 * @param {object} opts.node
 * @param {object} opts.data
 * @param {number} opts.stepStart
 * @param {string} opts.stepDescription
 * @param {Array}  opts.stepResults
 * @param {chrome.runtime.Port} opts.port
 * @param {Array}  opts.executionOrder
 * @param {number} opts.i                - Current loop index.
 * @param {string} opts.resolvedName
 * @param {string} opts.testCaseId
 * @returns {Promise<'retry'|'return'>} Instruction for the caller.
 */
export async function handleStepFailure(opts) {
  const {
    error, tabId, stepId, node, data, stepStart, stepDescription,
    stepResults, port, executionOrder, i, resolvedName, testCaseId, isRetry,
    actionableStepIndex,
  } = opts;

  // Capture screenshot at the point of failure
  let screenshot = null;
  try {
    screenshot = await captureScreenshot(tabId);
  } catch (e) {
    console.warn('[QA Agent] Error screenshot failed:', e);
  }

  const stepResult = buildStepResult(stepId, node, data, 'failed', stepStart, {
    screenshot,
    error: error.message || String(error),
    retry: isRetry || false,
  });

  stepResults.push(stepResult);
  port.postMessage({ type: 'STEP_ERROR', ...stepResult });

  // Immediately mark the test run as "failed" (completed) so the frontend
  // shows the correct status right away instead of staying "running".
  try {
    port.postMessage({
      type: 'TEST_COMPLETE',
      testCaseId,
      status: 'failed',
      stepResults,
      durationMs: Date.now() - get('testStartTime'),
    });
  } catch (e) {
    console.warn('[QA Agent] Could not send TEST_COMPLETE on failure:', e);
  }

  // Pause and show the failure in the popup so the user can decide
  set('isPaused', true);
  set('currentStepDescription', stepDescription);
  broadcastStatus('failed', {
    testName: resolvedName,
    currentStep: actionableStepIndex,
    totalSteps: get('actionableStepCount'),
    stepDescription,
    error: error.message || String(error),
  });

  const errorAction = await waitIfPausedLocal();

  if (errorAction === 'retry') {
    // Don't remove the failed result — keep it for history.
    // The retry will append a new step record with a retry flag.
    // Notify the frontend that the test is resuming (back to running).
    try {
      port.postMessage({
        type: 'TEST_RESUMED',
        testCaseId,
        status: 'running',
      });
    } catch (e) {
      console.warn('[QA Agent] Could not send TEST_RESUMED:', e);
    }
    return 'retry';
  }

  if (errorAction === 'abort') {
    // Popup or tab was closed while test was running — record as aborted
    set('stepResults', stepResults);
    try {
      port.postMessage({
        type: 'TEST_COMPLETE',
        testCaseId,
        status: 'stopped',
        stepResults,
        durationMs: Date.now() - get('testStartTime'),
      });
    } catch (e) {
      console.warn('[QA Agent] Could not send TEST_COMPLETE (abort):', e);
    }
    broadcastStatus('completed', {
      testName: resolvedName,
      result: 'stopped',
      error: 'Test aborted — popup or tab was closed',
      currentStep: actionableStepIndex,
      totalSteps: get('actionableStepCount'),
    });
    return 'return';
  }

  // 'dismiss' or no action — test stays failed (TEST_COMPLETE already sent above)
  set('stepResults', stepResults);
  broadcastStatus('completed', {
    testName: resolvedName,
    result: 'failed',
    error: error.message || String(error),
    currentStep: actionableStepIndex,
    totalSteps: get('actionableStepCount'),
  });

  return 'return';
}

/**
 * Build a uniform step-result object.
 *
 * @param {string} stepId               - Unique step identifier.
 * @param {object} node                 - The flow graph node.
 * @param {object} data                 - Step data from the node.
 * @param {'passed'|'failed'} status    - Outcome of the step.
 * @param {number} stepStart            - Timestamp when the step started.
 * @param {object} [extras={}]          - Additional fields (screenshot, actualResult, error).
 * @returns {object} The assembled step result.
 */
export function buildStepResult(stepId, node, data, status, stepStart, extras = {}) {
  return {
    stepId,
    blockId: node.id,
    blockType: data.blockType,
    status,
    durationMs: Date.now() - stepStart,
    description: data.label || data.description || data.blockType,
    target: data.selector || data.url,
    expectedResult: data.expectedValue || data.value,
    ...extras,
  };
}

/**
 * Local wrapper around the pause mechanism.
 * Reads from state directly so it always reflects the latest values.
 *
 * @returns {Promise<'resume'|'retry'>}
 */
export function waitIfPausedLocal() {
  if (!get('isPaused')) return Promise.resolve('resume');
  return new Promise((resolve) => {
    set('pauseResolve', resolve);
  });
}
