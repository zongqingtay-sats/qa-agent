// QA Agent — Popup Script
document.getElementById('ext-id').textContent = chrome.runtime.id;

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
  const currentStepDesc = document.getElementById('current-step-desc');
  const errorMessage = document.getElementById('error-message');

  // Hide error by default
  errorMessage.style.display = 'none';

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
      statusEl.className = message.result === 'failed' ? 'status failed' : 'status connected';
      statusText.textContent = message.result === 'failed' ? 'Test Failed' : `Completed: ${message.result || 'Done'}`;
      execInfo.style.display = 'none';
      if (message.error) {
        execInfo.style.display = 'block';
        errorMessage.textContent = message.error;
        errorMessage.style.display = 'block';
        btnPause.disabled = true;
        btnResume.disabled = true;
        btnRetry.disabled = true;
      }
      break;
    case 'idle':
    case 'disconnected':
      statusEl.className = 'status disconnected';
      statusText.textContent = 'Waiting for connection...';
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
