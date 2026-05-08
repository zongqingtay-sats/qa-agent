// QA Agent — Popup Script
document.getElementById('ext-id').textContent = chrome.runtime.id;

// Listen for status updates from background
chrome.runtime.onMessage.addListener((message) => {
  const statusEl = document.getElementById('status');
  const statusText = document.getElementById('status-text');
  const execInfo = document.getElementById('execution-info');
  const stepInfo = document.getElementById('step-info');
  const progressEl = document.getElementById('progress');

  if (message.type === 'STATUS_UPDATE') {
    switch (message.status) {
      case 'connected':
        statusEl.className = 'status connected';
        statusText.textContent = 'Connected to QA Agent';
        execInfo.style.display = 'none';
        break;
      case 'running':
        statusEl.className = 'status running';
        statusText.textContent = `Running: ${message.testName || 'Test'}`;
        execInfo.style.display = 'block';
        if (message.currentStep !== undefined && message.totalSteps !== undefined) {
          stepInfo.textContent = `Step ${message.currentStep} of ${message.totalSteps}`;
          progressEl.style.width = `${(message.currentStep / message.totalSteps) * 100}%`;
        }
        break;
      case 'completed':
        statusEl.className = 'status connected';
        statusText.textContent = `Completed: ${message.result || 'Done'}`;
        execInfo.style.display = 'none';
        break;
      case 'disconnected':
        statusEl.className = 'status disconnected';
        statusText.textContent = 'Waiting for connection...';
        execInfo.style.display = 'none';
        break;
    }
  }
});
