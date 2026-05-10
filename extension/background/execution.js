/**
 * @file background/execution.js
 * @description Core test execution engine. Walks the linearised execution
 * order, runs each step via the content script, and manages the pause,
 * retry, and failure lifecycle.
 *
 * Step-level helpers (navigation, failure handling, result building) live
 * in background/step-handlers.js to keep this file focused on the
 * top-level execution loop.
 */

import { get, set } from './state.js';
import { broadcastStatus } from './badge.js';
import { openPopupWindow } from './popup-window.js';
import { getExecutionOrder } from './flow.js';
import { waitForTabLoad, executeStepInTab, captureScreenshot } from './tab-utils.js';
import { executeNavigationStep, handleStepFailure, buildStepResult, waitIfPausedLocal } from './step-handlers.js';

/**
 * Start executing a test flow end-to-end.
 *
 * @param {chrome.runtime.Port} port       - Port to the web app.
 * @param {object}              testFlow   - Test flow graph ({ nodes, edges }).
 * @param {string}              testCaseId - Unique test case ID.
 * @param {string}              baseUrl    - Base URL for resolving relative paths.
 * @param {string}              testName   - Human-readable test name.
 * @param {string|null}         testRunId  - Optional test run ID.
 * @returns {Promise<void>}
 */
export async function startTestExecution(port, testFlow, testCaseId, baseUrl, testName, testRunId) {
  initState(testFlow, testCaseId, testRunId, baseUrl, port);

  chrome.action.setBadgeText({ text: '\u25B6' });
  chrome.action.setBadgeBackgroundColor({ color: '#3b82f6' });

  await openPopupWindow();

  const executionOrder = getExecutionOrder(testFlow);
  set('currentExecutionOrder', executionOrder);

  // Count only actionable steps (exclude start/end structural markers)
  const actionableSteps = executionOrder.filter(
    (n) => n.data?.blockType !== 'start' && n.data?.blockType !== 'end'
  ).length;
  set('actionableStepCount', actionableSteps);

  const startNode = executionOrder.find((n) => n.data?.blockType === 'start');
  const resolvedName = testName || startNode?.data?.label || testCaseId || 'Test';
  set('currentTestName', resolvedName);

  if (executionOrder.length === 0) {
    port.postMessage({ type: 'TEST_COMPLETE', testCaseId, status: 'failed', stepResults: [] });
    return;
  }

  const stepResults = [];

  try {
    // Start block is a structural marker only — the first Navigate block
    // will handle navigating to the target URL.
    const tab = await chrome.tabs.create({ url: 'about:blank', active: true });
    set('executingTabId', tab.id);

    // Monitor tab closure — if the testing tab is closed mid-run, abort
    const tabRemovedHandler = (tabId) => {
      if (tabId === tab.id) {
        chrome.tabs.onRemoved.removeListener(tabRemovedHandler);
        if (get('isPaused')) {
          const resolve = get('pauseResolve');
          if (resolve) {
            const status = get('currentStatus');
            resolve(status === 'failed' ? 'dismiss' : 'abort');
            set('pauseResolve', null);
          }
          set('isPaused', false);
        }
        // Mark the tab as gone so the loop can break
        set('executingTabId', null);
      }
    };
    chrome.tabs.onRemoved.addListener(tabRemovedHandler);

    let actionableStepIndex = 0; // Tracks the logical step position (excludes start/end, doesn't change on retry)

    for (let i = 0; i < executionOrder.length; i++) {
      const node = executionOrder[i];
      const data = node.data;
      set('currentStepIndex', i);

      if (data.blockType === 'start' || data.blockType === 'end') continue;

      const stepId = `step-${i}`;
      const stepDescription = data.label || data.description || data.blockType;
      const isRetry = get('nextStepIsRetry') || false;
      if (isRetry) set('nextStepIsRetry', false);

      // Only increment for new steps, not retries
      if (!isRetry) actionableStepIndex++;

      const action = await waitIfPausedLocal();
      if (action === 'retry' && i > 0) {
        set('nextStepIsRetry', true);
        i--; continue;
      }
      if (action === 'abort') {
        // Tab or popup closed while actively running — send stopped
        set('stepResults', stepResults);
        port.postMessage({
          type: 'TEST_COMPLETE', testCaseId, status: 'stopped',
          stepResults, durationMs: Date.now() - get('testStartTime'),
        });
        broadcastStatus('completed', {
          testName: resolvedName, result: 'stopped',
          error: 'Test aborted — popup or tab was closed',
          currentStep: actionableStepIndex, totalSteps: actionableSteps,
        });
        return;
      }

      broadcastStatus('running', {
        testName: resolvedName, currentStep: actionableStepIndex,
        totalSteps: actionableSteps, stepDescription,
      });

      port.postMessage({ type: 'STEP_START', stepId, blockId: node.id, blockType: data.blockType, retry: isRetry, stepIndex: actionableStepIndex });
      const stepStart = Date.now();

      try {
        if (data.blockType === 'navigate' && data.url) {
          await executeNavigationStep(data, tab.id, stepId, node, stepStart, stepResults, port, isRetry);
          continue;
        }

        const result = await executeStepInTab(tab.id, data);
        let screenshot = null;
        try { screenshot = await captureScreenshot(tab.id); } catch (e) {
          console.warn('[QA Agent] Screenshot failed:', e);
        }

        const stepResult = buildStepResult(stepId, node, data, 'passed', stepStart, {
          screenshot, actualResult: result?.actualResult || 'OK', retry: isRetry,
        });
        stepResults.push(stepResult);
        port.postMessage({ type: 'STEP_COMPLETE', ...stepResult });
      } catch (error) {
        const outcome = await handleStepFailure({
          error, tabId: tab.id, stepId, node, data, stepStart, stepDescription,
          stepResults, port, executionOrder, i, resolvedName, testCaseId, isRetry,
          actionableStepIndex,
        });
        if (outcome === 'return') return;
        if (outcome === 'retry') { set('nextStepIsRetry', true); i--; continue; }
      }
    }

    set('stepResults', stepResults);
    port.postMessage({
      type: 'TEST_COMPLETE', testCaseId, status: 'passed',
      stepResults, durationMs: Date.now() - get('testStartTime'),
    });
    broadcastStatus('completed', {
      testName: resolvedName, result: 'passed',
      currentStep: actionableSteps, totalSteps: actionableSteps,
    });
  } catch (error) {
    set('stepResults', stepResults);
    port.postMessage({
      type: 'TEST_COMPLETE', testCaseId, status: 'failed',
      stepResults, error: error.message || String(error),
      durationMs: Date.now() - get('testStartTime'),
    });
    broadcastStatus('completed', {
      testName: resolvedName, result: 'failed',
      error: error.message || String(error),
      currentStep: stepResults.length, totalSteps: actionableSteps,
    });
  }
}

/**
 * Reset all execution-related state before a new test run.
 * @private
 */
function initState(testFlow, testCaseId, testRunId, baseUrl, port) {
  set('currentTestFlow', testFlow);
  set('currentTestCaseId', testCaseId);
  set('currentTestRunId', testRunId || null);
  set('currentBaseUrl', baseUrl);
  set('currentPort', port);
  set('stepResults', []);
  set('currentStepIndex', 0);
  set('testStartTime', Date.now());
  set('isPaused', false);
}
