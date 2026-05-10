// QA Agent — Popup Script
const APP_BASE = 'http://localhost:3000';

// Elements
const statusPill = document.getElementById('status-pill');
const idleView = document.getElementById('idle-view');
const execInfo = document.getElementById('execution-info');
const testNameEl = document.getElementById('test-name');
const stepLabel = document.getElementById('step-label');
const stepCount = document.getElementById('step-count');
const progressEl = document.getElementById('progress');
const currentStepDesc = document.getElementById('current-step-desc');
const errorMessage = document.getElementById('error-message');
const failHint = document.getElementById('fail-hint');
const testIdEl = document.getElementById('test-id');
const runIdEl = document.getElementById('run-id');
const detailsToggle = document.getElementById('details-toggle');
const detailsContent = document.getElementById('details-content');
const extIdEl = document.getElementById('ext-id');
const appLink = document.getElementById('app-link');
const copiedToast = document.getElementById('copied-toast');

const btnPause = document.getElementById('btn-pause');
const btnResume = document.getElementById('btn-resume');
const btnRetry = document.getElementById('btn-retry');

// Set extension ID
extIdEl.textContent = chrome.runtime.id;

// Copy extension ID on click
extIdEl.addEventListener('click', () => {
  navigator.clipboard.writeText(chrome.runtime.id);
  copiedToast.classList.add('show');
  setTimeout(() => copiedToast.classList.remove('show'), 1200);
});

// Open app link
appLink.addEventListener('click', () => {
  chrome.tabs.create({ url: APP_BASE });
});

// Details toggle
detailsToggle.addEventListener('click', () => {
  detailsToggle.classList.toggle('open');
  detailsContent.classList.toggle('open');
});

// Controls
btnPause.addEventListener('click', () => chrome.runtime.sendMessage({ type: 'PAUSE_TEST' }));
btnResume.addEventListener('click', () => chrome.runtime.sendMessage({ type: 'RESUME_TEST' }));
btnRetry.addEventListener('click', () => chrome.runtime.sendMessage({ type: 'RETRY_STEP' }));

// Shorten a UUID for display: "abc12345-..." → "abc123…"
function shortId(id) {
  if (!id) return '';
  return id.length > 8 ? id.substring(0, 8) + '…' : id;
}

function applyStatus(message) {
  // Reset transient elements
  errorMessage.style.display = 'none';
  failHint.style.display = 'none';
  progressEl.className = 'progress-bar-fill';

  // Update IDs in details section
  const hasIds = message.testCaseId || message.testRunId;
  if (message.testCaseId) {
    testIdEl.textContent = shortId(message.testCaseId);
    testIdEl.title = message.testCaseId;
    testIdEl.onclick = () => chrome.tabs.create({ url: `${APP_BASE}/test-cases/${message.testCaseId}/editor` });
  } else {
    testIdEl.textContent = '—';
    testIdEl.onclick = null;
  }
  if (message.testRunId) {
    runIdEl.textContent = shortId(message.testRunId);
    runIdEl.title = message.testRunId;
    runIdEl.onclick = () => chrome.tabs.create({ url: `${APP_BASE}/test-runs/${message.testRunId}` });
  } else {
    runIdEl.textContent = '—';
    runIdEl.onclick = null;
  }

  // Make test name clickable to open test run
  if (message.testRunId) {
    testNameEl.onclick = () => chrome.tabs.create({ url: `${APP_BASE}/test-runs/${message.testRunId}` });
  } else {
    testNameEl.onclick = null;
  }

  // Helper to update progress
  function setProgress(current, total, suffix) {
    if (current !== undefined && total !== undefined && total > 0) {
      stepLabel.textContent = suffix ? `Step ${current} of ${total}` : `Step ${current} of ${total}`;
      stepCount.textContent = suffix || '';
      progressEl.style.width = `${(current / total) * 100}%`;
    }
  }

  switch (message.status) {
    case 'connected':
      statusPill.className = 'status-pill connected';
      statusPill.textContent = 'Connected';
      idleView.style.display = 'block';
      execInfo.style.display = 'none';
      break;

    case 'running':
      statusPill.className = 'status-pill running';
      statusPill.textContent = 'Running';
      idleView.style.display = 'none';
      execInfo.style.display = 'block';
      testNameEl.textContent = message.testName || 'Test';
      btnPause.disabled = false;
      btnResume.disabled = true;
      btnRetry.disabled = true;
      setProgress(message.currentStep, message.totalSteps);
      if (message.stepDescription) {
        currentStepDesc.textContent = `▸ ${message.stepDescription}`;
      }
      detailsToggle.style.display = hasIds ? 'flex' : 'none';
      break;

    case 'paused':
      statusPill.className = 'status-pill paused';
      statusPill.textContent = 'Paused';
      idleView.style.display = 'none';
      execInfo.style.display = 'block';
      testNameEl.textContent = message.testName || testNameEl.textContent;
      btnPause.disabled = true;
      btnResume.disabled = false;
      btnRetry.disabled = false;
      setProgress(message.currentStep, message.totalSteps, 'paused');
      progressEl.classList.add('paused');
      detailsToggle.style.display = hasIds ? 'flex' : 'none';
      break;

    case 'failed':
      statusPill.className = 'status-pill failed';
      statusPill.textContent = 'Failed';
      idleView.style.display = 'none';
      execInfo.style.display = 'block';
      testNameEl.textContent = message.testName || testNameEl.textContent;
      btnPause.disabled = true;
      btnResume.disabled = true;
      btnRetry.disabled = false;
      setProgress(message.currentStep, message.totalSteps, 'failed');
      progressEl.classList.add('failed');
      if (message.stepDescription) {
        currentStepDesc.textContent = `▸ ${message.stepDescription}`;
      }
      if (message.error) {
        errorMessage.textContent = message.error;
        errorMessage.style.display = 'block';
      }
      failHint.style.display = 'block';
      detailsToggle.style.display = hasIds ? 'flex' : 'none';
      break;

    case 'completed': {
      const result = message.result || 'done';
      if (result === 'failed') {
        statusPill.className = 'status-pill failed';
        statusPill.textContent = 'Failed';
      } else if (result === 'stopped') {
        statusPill.className = 'status-pill disconnected';
        statusPill.textContent = 'Stopped';
      } else {
        statusPill.className = 'status-pill connected';
        statusPill.textContent = 'Passed';
      }
      idleView.style.display = 'none';
      execInfo.style.display = 'block';
      testNameEl.textContent = message.testName || '';
      btnPause.disabled = true;
      btnResume.disabled = true;
      btnRetry.disabled = true;
      setProgress(message.currentStep, message.totalSteps, result);
      if (result === 'failed') progressEl.classList.add('failed');
      currentStepDesc.textContent = '';
      if (message.error) {
        errorMessage.textContent = message.error;
        errorMessage.style.display = 'block';
      }
      detailsToggle.style.display = hasIds ? 'flex' : 'none';
      break;
    }

    case 'idle':
    case 'disconnected':
      if (message.hasConnectedBefore) {
        statusPill.className = 'status-pill connected';
        statusPill.textContent = 'Ready';
      } else {
        statusPill.className = 'status-pill disconnected';
        statusPill.textContent = 'Disconnected';
      }
      idleView.style.display = 'block';
      execInfo.style.display = 'none';
      break;
  }
}

// Listen for status updates from background
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'STATUS_UPDATE') {
    applyStatus(message);
  }
});

// Query current state on popup open
chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
  if (response) applyStatus(response);
});
