/**
 * @file background/state.js
 * @description Centralized state management for the QA Agent background service worker.
 *
 * All mutable state lives here so that other modules can import getters/setters
 * instead of reaching into shared globals. This keeps the dependency graph
 * explicit and makes the state surface area easy to audit.
 */

/** @type {{ [key: string]: any }} Internal state store */
const _state = {
  /** @type {object|null} The current test flow graph (nodes + edges) */
  currentTestFlow: null,
  /** @type {string|null} ID of the test case being executed */
  currentTestCaseId: null,
  /** @type {string|null} ID of the test run being executed */
  currentTestRunId: null,
  /** @type {string} Base URL used to resolve relative navigation paths */
  currentBaseUrl: '',
  /** @type {number|null} Chrome tab ID where the test is running */
  executingTabId: null,
  /** @type {Array<object>} Accumulated step results for the current test */
  stepResults: [],
  /** @type {number} Index of the step currently being executed */
  currentStepIndex: 0,
  /** @type {number} Timestamp (ms) when the current test started */
  testStartTime: 0,
  /** @type {Map<string, chrome.runtime.Port>} Active external port connections keyed by origin */
  connectedPorts: new Map(),
  /** @type {boolean} Whether execution is currently paused */
  isPaused: false,
  /** @type {Function|null} Resolve callback for the pause promise */
  pauseResolve: null,
  /** @type {Array<object>|null} Ordered list of nodes to execute */
  currentExecutionOrder: null,
  /** @type {number} Count of actionable steps (excludes start/end) */
  actionableStepCount: 0,
  /** @type {chrome.runtime.Port|null} The port used by the current test session */
  currentPort: null,
  /** @type {string} Human-readable name of the current test */
  currentTestName: '',
  /** @type {string} Current high-level status (idle|connected|running|paused|failed|completed) */
  currentStatus: 'idle',
  /** @type {string} Description of the step currently being executed */
  currentStepDescription: '',
  /** @type {string} Most recent error message, if any */
  currentError: '',
  /** @type {string} Final result of the completed test (passed|failed|stopped) */
  currentResult: '',
  /** @type {number|null} Chrome window ID of the popup window, if open */
  popupWindowId: null,
  /** @type {boolean} Whether the extension has ever connected to the web app */
  hasConnectedBefore: false,
};

/**
 * Read a value from state.
 * @param {string} key - The state key to read.
 * @returns {any} The current value.
 */
export function get(key) {
  return _state[key];
}

/**
 * Write a value to state.
 * @param {string} key   - The state key to write.
 * @param {any}    value - The new value.
 */
export function set(key, value) {
  _state[key] = value;
}

/**
 * Build the status payload sent to the popup when it requests current state.
 * Includes step progress only when an execution order exists.
 * @returns {object} A plain object describing the current execution state.
 */
export function getStatusPayload() {
  const payload = {
    status: _state.currentStatus,
    testCaseId: _state.currentTestCaseId,
    testRunId: _state.currentTestRunId,
    testName: _state.currentTestName,
    stepDescription: _state.currentStepDescription,
    error: _state.currentError,
    result: _state.currentResult,
    hasConnectedBefore: _state.hasConnectedBefore,
  };

  if (_state.currentExecutionOrder) {
    payload.currentStep = _state.currentStepIndex + 1;
    payload.totalSteps = _state.actionableStepCount || 0;
  }

  return payload;
}

/**
 * Returns a promise that resolves immediately when not paused, or blocks
 * until the user resumes / retries from the popup.
 *
 * The resolved value is a string indicating the action taken:
 * - `'resume'` — execution was not paused or the user clicked Resume
 * - `'retry'`  — the user clicked Retry
 *
 * @returns {Promise<'resume'|'retry'>}
 */
export function waitIfPaused() {
  if (!_state.isPaused) return Promise.resolve('resume');
  return new Promise((resolve) => {
    _state.pauseResolve = resolve;
  });
}
