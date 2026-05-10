/**
 * @file popup/renderer.js
 * @description Status rendering logic for the popup UI.
 *
 * Exports a single `applyStatus` function that takes a status message
 * from the background service worker and updates all DOM elements to
 * reflect the current execution state.
 */

/** @type {string} Base URL for deep links into the QA Agent web app */
const APP_BASE = 'http://localhost:3000';

/**
 * Truncate a UUID for compact display.
 * Example: "abc12345-6789-..." → "abc12345…"
 *
 * @param {string} id - Full UUID string.
 * @returns {string} Shortened string.
 */
export function shortId(id) {
  if (!id) return '';
  return id.length > 8 ? id.substring(0, 8) + '…' : id;
}

/**
 * Apply a status update to all popup DOM elements.
 *
 * This function is the single entry point for all UI updates. It reads
 * the status message shape broadcast by the background worker and maps
 * it onto the popup's HTML structure.
 *
 * @param {object} message - The status payload.
 * @param {string} message.status - Current status identifier.
 * @param {string} [message.testName] - Human-readable test name.
 * @param {string} [message.testCaseId] - Test case UUID.
 * @param {string} [message.testRunId] - Test run UUID.
 * @param {number} [message.currentStep] - 1-based current step index.
 * @param {number} [message.totalSteps] - Total step count.
 * @param {string} [message.stepDescription] - Description of the active step.
 * @param {string} [message.error] - Error message, if any.
 * @param {string} [message.result] - Final result (passed|failed|stopped).
 * @param {boolean} [message.hasConnectedBefore] - Whether a connection has been established.
 * @param {object} els - Object containing all cached DOM element references.
 */
export function applyStatus(message, els) {
  const {
    statusPill, idleView, execInfo, testNameEl, stepLabel, stepCount,
    progressEl, currentStepDesc, errorMessage, failHint, testIdEl,
    runIdEl, detailsToggle, btnPause, btnResume, btnRetry,
  } = els;

  // Reset transient elements at the start of every update
  errorMessage.style.display = 'none';
  failHint.style.display = 'none';
  progressEl.className = 'progress-bar-fill';

  // ── Update collapsible IDs section ──
  const hasIds = message.testCaseId || message.testRunId;
  updateIdLink(testIdEl, message.testCaseId, `${APP_BASE}/test-cases/${message.testCaseId}/editor`);
  updateIdLink(runIdEl, message.testRunId, `${APP_BASE}/test-runs/${message.testRunId}`);

  // Make test name clickable → opens the test run page
  testNameEl.onclick = message.testRunId
    ? () => chrome.tabs.create({ url: `${APP_BASE}/test-runs/${message.testRunId}` })
    : null;

  // ── Status-specific rendering ──
  switch (message.status) {
    case 'connected':
      setPill(statusPill, 'connected', 'Connected');
      showIdle(idleView, execInfo);
      break;

    case 'running':
      setPill(statusPill, 'running', 'Running');
      showExec(idleView, execInfo);
      testNameEl.textContent = message.testName || 'Test';
      setButtons(btnPause, btnResume, btnRetry, false, true, true);
      setProgress(stepLabel, stepCount, progressEl, message.currentStep, message.totalSteps);
      if (message.stepDescription) currentStepDesc.textContent = `▸ ${message.stepDescription}`;
      detailsToggle.style.display = hasIds ? 'flex' : 'none';
      break;

    case 'paused':
      setPill(statusPill, 'paused', 'Paused');
      showExec(idleView, execInfo);
      testNameEl.textContent = message.testName || testNameEl.textContent;
      setButtons(btnPause, btnResume, btnRetry, true, false, false);
      setProgress(stepLabel, stepCount, progressEl, message.currentStep, message.totalSteps, 'paused');
      progressEl.classList.add('paused');
      detailsToggle.style.display = hasIds ? 'flex' : 'none';
      break;

    case 'failed':
      setPill(statusPill, 'failed', 'Failed');
      showExec(idleView, execInfo);
      testNameEl.textContent = message.testName || testNameEl.textContent;
      setButtons(btnPause, btnResume, btnRetry, true, true, false);
      setProgress(stepLabel, stepCount, progressEl, message.currentStep, message.totalSteps, 'failed');
      progressEl.classList.add('failed');
      if (message.stepDescription) currentStepDesc.textContent = `▸ ${message.stepDescription}`;
      if (message.error) { errorMessage.textContent = message.error; errorMessage.style.display = 'block'; }
      failHint.style.display = 'block';
      detailsToggle.style.display = hasIds ? 'flex' : 'none';
      break;

    case 'completed':
      renderCompleted(message, els, hasIds);
      break;

    case 'idle':
    case 'disconnected':
      if (message.hasConnectedBefore) {
        setPill(statusPill, 'connected', 'Ready');
      } else {
        setPill(statusPill, 'disconnected', 'Disconnected');
      }
      showIdle(idleView, execInfo);
      break;
  }
}

// ── Private helpers ────────────────────────────────────────────────

/** @param {HTMLElement} pill @param {string} cls @param {string} text */
function setPill(pill, cls, text) {
  pill.className = `status-pill ${cls}`;
  pill.textContent = text;
}

/** Show idle view, hide execution info */
function showIdle(idleView, execInfo) {
  idleView.style.display = 'block';
  execInfo.style.display = 'none';
}

/** Show execution info, hide idle view */
function showExec(idleView, execInfo) {
  idleView.style.display = 'none';
  execInfo.style.display = 'block';
}

/** @param {HTMLElement} btn1 @param {HTMLElement} btn2 @param {HTMLElement} btn3 */
function setButtons(btn1, btn2, btn3, d1, d2, d3) {
  btn1.disabled = d1;
  btn2.disabled = d2;
  btn3.disabled = d3;
}

/** Update progress label and bar width */
function setProgress(label, count, bar, current, total, suffix) {
  if (current !== undefined && total !== undefined && total > 0) {
    label.textContent = `Step ${current} of ${total}`;
    count.textContent = suffix || '';

    const completed = current - 1;
    const completedPct = (Math.max(0, completed) / total) * 100;
    const currentPct = (current / total) * 100;

    if (suffix) {
      // Step finished (failed/paused/passed) — fill up to current, solid color
      bar.style.width = `${currentPct}%`;
      bar.style.background = '';  // let CSS class handle color
    } else {
      // Running — show completed solid + current step lighter
      bar.style.width = `${currentPct}%`;
      if (completed > 0) {
        const splitPct = (completedPct / currentPct) * 100;
        bar.style.background = `linear-gradient(to right, #6366f1 ${splitPct}%, #a5b4fc ${splitPct}%)`;
      } else {
        bar.style.background = '#a5b4fc';
      }
    }
  }
}

/** Update a clickable ID link element */
function updateIdLink(el, id, url) {
  if (id) {
    el.textContent = shortId(id);
    el.title = id;
    el.onclick = () => chrome.tabs.create({ url });
  } else {
    el.textContent = '—';
    el.onclick = null;
  }
}

/** Render the "completed" status (passed / failed / stopped) */
function renderCompleted(message, els, hasIds) {
  const { statusPill, idleView, execInfo, testNameEl, stepLabel, stepCount,
    progressEl, currentStepDesc, errorMessage, detailsToggle, btnPause, btnResume, btnRetry } = els;

  const result = message.result || 'done';
  if (result === 'failed') setPill(statusPill, 'failed', 'Failed');
  else if (result === 'stopped') setPill(statusPill, 'disconnected', 'Stopped');
  else setPill(statusPill, 'connected', 'Passed');

  showExec(idleView, execInfo);
  testNameEl.textContent = message.testName || '';
  setButtons(btnPause, btnResume, btnRetry, true, true, true);
  setProgress(stepLabel, stepCount, progressEl, message.currentStep, message.totalSteps, result);
  if (result === 'failed') progressEl.classList.add('failed');
  currentStepDesc.textContent = '';
  if (message.error) { errorMessage.textContent = message.error; errorMessage.style.display = 'block'; }
  detailsToggle.style.display = hasIds ? 'flex' : 'none';
}
