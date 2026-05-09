// QA Agent — Popup Script
document.getElementById('ext-id').textContent = chrome.runtime.id;

const APP_BASE = 'http://localhost:3000';

const btnPause = document.getElementById('btn-pause');
const btnResume = document.getElementById('btn-resume');
const btnRetry = document.getElementById('btn-retry');

btnPause.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'PAUSE_TEST' });
});
btnResume.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'RESUME_TEST' });
});
btnRetry.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'RETRY_STEP' });
});

function applyStatus(message) {
  const statusEl = document.getElementById('status');
  const statusText = document.getElementById('status-text');
  const execInfo = document.getElementById('execution-info');
  const stepInfo = document.getElementById('step-info');
  const progressEl = document.getElementById('progress');
  const testNameEl = document.getElementById('test-name');
  const testIdEl = document.getElementById('test-id');
  const runIdEl = document.getElementById('run-id');
  const currentStepDesc = document.getElementById('current-step-desc');
  const errorMessage = document.getElementById('error-message');

  // Hide error by default
  errorMessage.style.display = 'none';

  // Update test ID and run ID if present
  if (message.testCaseId) {
    testIdEl.textContent = `Case: ${message.testCaseId}`;
    testIdEl.onclick = () => chrome.tabs.create({ url: `${APP_BASE}/test-cases/${message.testCaseId}/editor` });
  } else {
    testIdEl.textContent = '';
    testIdEl.onclick = null;
  }
  if (message.testRunId) {
    runIdEl.textContent = `Run: ${message.testRunId}`;
    runIdEl.onclick = () => chrome.tabs.create({ url: `${APP_BASE}/test-runs/${message.testRunId}` });
  } else {
    runIdEl.textContent = '';
    runIdEl.onclick = null;
  }

  // Make test name clickable to open test run
  if (message.testRunId) {
    testNameEl.onclick = () => chrome.tabs.create({ url: `${APP_BASE}/test-runs/${message.testRunId}` });
  } else {
    testNameEl.onclick = null;
  }

  switch (message.status) {
    case 'connected':
      statusEl.className = 'status connected';
      statusText.textContent = 'Connected to QA Agent';
      execInfo.style.display = 'none';
      break;
    case 'running':
      statusEl.className = 'status running';
      statusText.textContent = 'Running test...';
      testNameEl.textContent = message.testName || 'Test';
      execInfo.style.display = 'block';
      btnPause.disabled = false;
      btnResume.disabled = true;
      btnRetry.disabled = true;
      if (message.currentStep !== undefined && message.totalSteps !== undefined) {
        stepInfo.textContent = `Step ${message.currentStep} of ${message.totalSteps}`;
        progressEl.style.width = `${(message.currentStep / message.totalSteps) * 100}%`;
      }
      if (message.stepDescription) {
        currentStepDesc.textContent = `▸ ${message.stepDescription}`;
      }
      break;
    case 'paused':
      statusEl.className = 'status paused';
      statusText.textContent = 'Paused';
      testNameEl.textContent = message.testName || testNameEl.textContent;
      execInfo.style.display = 'block';
      btnPause.disabled = true;
      btnResume.disabled = false;
      btnRetry.disabled = false;
      if (message.currentStep !== undefined && message.totalSteps !== undefined) {
        stepInfo.textContent = `Step ${message.currentStep} of ${message.totalSteps} (paused)`;
        progressEl.style.width = `${(message.currentStep / message.totalSteps) * 100}%`;
      }
      break;
    case 'failed':
      statusEl.className = 'status failed';
      statusText.textContent = 'Step Failed';
      testNameEl.textContent = message.testName || testNameEl.textContent;
      execInfo.style.display = 'block';
      btnPause.disabled = true;
      btnResume.disabled = true;
      btnRetry.disabled = false;
      if (message.currentStep !== undefined && message.totalSteps !== undefined) {
        stepInfo.textContent = `Step ${message.currentStep} of ${message.totalSteps} (failed)`;
        progressEl.style.width = `${(message.currentStep / message.totalSteps) * 100}%`;
      }
      if (message.stepDescription) {
        currentStepDesc.textContent = `▸ ${message.stepDescription}`;
      }
      if (message.error) {
        errorMessage.textContent = message.error;
        errorMessage.style.display = 'block';
      }
      break;
    case 'completed':
      if (message.result === 'failed') {
        statusEl.className = 'status failed';
        statusText.textContent = 'Test Failed';
      } else if (message.result === 'stopped') {
        statusEl.className = 'status disconnected';
        statusText.textContent = 'Test Stopped';
      } else {
        statusEl.className = 'status connected';
        statusText.textContent = 'Test Passed';
      }
      testNameEl.textContent = message.testName || '';
      execInfo.style.display = 'block';
      btnPause.disabled = true;
      btnResume.disabled = true;
      btnRetry.disabled = true;
      if (message.currentStep !== undefined && message.totalSteps !== undefined) {
        stepInfo.textContent = `Step ${message.currentStep} of ${message.totalSteps} (${message.result || 'done'})`;
        progressEl.style.width = `${(message.currentStep / message.totalSteps) * 100}%`;
      }
      currentStepDesc.textContent = '';
      if (message.error) {
        errorMessage.textContent = message.error;
        errorMessage.style.display = 'block';
      }
      break;
    case 'idle':
    case 'disconnected':
      if (message.hasConnectedBefore) {
        statusEl.className = 'status connected';
        statusText.textContent = 'Ready — no active test';
      } else {
        statusEl.className = 'status disconnected';
        statusText.textContent = 'Waiting for connection...';
      }
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
  if (response) {
    applyStatus(response);
  }
});
