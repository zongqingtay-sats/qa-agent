// QA Agent — Background Service Worker
// Orchestrates test execution between the web app and content scripts

let currentTestFlow = null;
let currentTestCaseId = null;
let currentBaseUrl = '';
let executingTabId = null;
let stepResults = [];
let currentStepIndex = 0;
let testStartTime = 0;
let connectedPorts = new Map();
let isPaused = false;
let pauseResolve = null;
let currentExecutionOrder = null;
let currentPort = null;
let currentTestName = '';
let currentStatus = 'idle';
let currentStepDescription = '';
let currentError = '';

// Listen for connections from the web app
chrome.runtime.onConnectExternal.addListener((port) => {
  console.log('[QA Agent] External connection from:', port.sender?.origin);
  connectedPorts.set(port.sender?.origin, port);

  port.onMessage.addListener(async (message) => {
    console.log('[QA Agent] Received message:', message.type);

    switch (message.type) {
      case 'CONNECT':
        port.postMessage({ type: 'CONNECTED', extensionId: chrome.runtime.id });
        broadcastStatus('connected');
        break;

      case 'EXECUTE_TEST':
        await startTestExecution(port, message.testFlow, message.testCaseId, message.baseUrl);
        break;

      case 'STOP_TEST':
        stopTestExecution(port);
        break;
    }
  });

  port.onDisconnect.addListener(() => {
    connectedPorts.delete(port.sender?.origin);
    console.log('[QA Agent] Port disconnected');
    if (connectedPorts.size === 0) {
      broadcastStatus('disconnected');
    }
  });
});

// Also listen for one-time messages from the web app
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message.type === 'PING') {
    sendResponse({ type: 'PONG', extensionId: chrome.runtime.id });
    return true;
  }
});

// Listen for messages from popup (pause/resume/retry/get-status)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_STATUS') {
    sendResponse(getStatusPayload());
    return true;
  } else if (message.type === 'PAUSE_TEST') {
    isPaused = true;
    broadcastStatus('paused', { testName: currentTestName, currentStep: currentStepIndex + 1, totalSteps: currentExecutionOrder?.length || 0 });
  } else if (message.type === 'RESUME_TEST') {
    isPaused = false;
    broadcastStatus('running', { testName: currentTestName, currentStep: currentStepIndex + 1, totalSteps: currentExecutionOrder?.length || 0 });
    if (pauseResolve) {
      pauseResolve('resume');
      pauseResolve = null;
    }
  } else if (message.type === 'RETRY_STEP') {
    isPaused = false;
    broadcastStatus('running', { testName: currentTestName, currentStep: currentStepIndex + 1, totalSteps: currentExecutionOrder?.length || 0 });
    if (pauseResolve) {
      pauseResolve('retry');
      pauseResolve = null;
    }
  }
});

function broadcastStatus(status, extra = {}) {
  currentStatus = status;
  if (extra.stepDescription) currentStepDescription = extra.stepDescription;
  currentError = extra.error || '';

  // Update badge based on status
  switch (status) {
    case 'running':
      chrome.action.setBadgeText({ text: 'RUN' });
      chrome.action.setBadgeBackgroundColor({ color: '#6366f1' });
      break;
    case 'paused':
      chrome.action.setBadgeText({ text: 'II' });
      chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });
      break;
    case 'failed':
      chrome.action.setBadgeText({ text: 'ERR' });
      chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
      break;
    case 'connected':
    case 'completed':
    case 'disconnected':
    case 'idle':
      chrome.action.setBadgeText({ text: '' });
      break;
  }

  chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', status, ...extra }).catch(() => {});
}

function getStatusPayload() {
  const payload = {
    status: currentStatus,
    testName: currentTestName,
    stepDescription: currentStepDescription,
    error: currentError,
  };
  if (currentExecutionOrder) {
    payload.currentStep = currentStepIndex + 1;
    payload.totalSteps = currentExecutionOrder.length;
  }
  return payload;
}

function waitIfPaused() {
  if (!isPaused) return Promise.resolve('resume');
  return new Promise((resolve) => { pauseResolve = resolve; });
}

async function startTestExecution(port, testFlow, testCaseId, baseUrl) {
  currentTestFlow = testFlow;
  currentTestCaseId = testCaseId;
  currentBaseUrl = baseUrl;
  currentPort = port;
  stepResults = [];
  currentStepIndex = 0;
  testStartTime = Date.now();
  isPaused = false;

  // Set badge to indicate running
  chrome.action.setBadgeText({ text: 'RUN' });
  chrome.action.setBadgeBackgroundColor({ color: '#6366f1' });

  // Determine execution order by traversing edges from start node
  const executionOrder = getExecutionOrder(testFlow);
  currentExecutionOrder = executionOrder;

  // Derive test name from the start node label or fallback
  const startNode = executionOrder.find(n => n.data?.blockType === 'start');
  currentTestName = startNode?.data?.label || testCaseId || 'Test';

  if (executionOrder.length === 0) {
    port.postMessage({
      type: 'TEST_COMPLETE',
      testCaseId,
      status: 'failed',
      stepResults: [],
    });
    return;
  }

  // Get or create tab for test execution
  try {
    // Always create a fresh tab for test execution
    const startNode = executionOrder.find(n => n.data?.blockType === 'start');
    const initialUrl = startNode?.data?.baseUrl || baseUrl || 'about:blank';
    const tab = await chrome.tabs.create({ url: initialUrl, active: true });
    executingTabId = tab.id;

    // Wait for the tab to finish loading
    await waitForTabLoad(executingTabId);

    // Execute steps sequentially
    for (let i = 0; i < executionOrder.length; i++) {
      const node = executionOrder[i];
      const data = node.data;
      currentStepIndex = i;

      // Skip start/end nodes for execution but still report them
      if (data.blockType === 'start' || data.blockType === 'end') {
        continue;
      }

      const stepId = `step-${i}`;
      const stepDescription = data.label || data.description || data.blockType;

      // Check pause before step
      const action = await waitIfPaused();
      if (action === 'retry' && i > 0) {
        i--; // Will be incremented by the loop
        continue;
      }

      broadcastStatus('running', {
        testName: currentTestName,
        currentStep: i + 1,
        totalSteps: executionOrder.length,
        stepDescription,
      });

      port.postMessage({
        type: 'STEP_START',
        stepId,
        blockId: node.id,
        blockType: data.blockType,
      });

      const stepStart = Date.now();

      try {
        // Handle navigation at the background level (tab navigation, not content script)
        if (data.blockType === 'navigate' && data.url) {
          let navUrl = data.url;
          // If it's a relative URL, resolve against baseUrl
          if (navUrl.startsWith('/')) {
            const base = currentBaseUrl.replace(/\/$/, '');
            navUrl = base + navUrl;
          }
          await chrome.tabs.update(executingTabId, { url: navUrl });
          await waitForTabLoad(executingTabId);

          const stepResult = {
            stepId,
            blockId: node.id,
            blockType: data.blockType,
            status: 'passed',
            durationMs: Date.now() - stepStart,
            actualResult: `Navigated to ${navUrl}`,
            description: data.label || data.description || 'Navigate',
            target: data.url,
          };

          // Capture screenshot after navigation
          try {
            stepResult.screenshot = await captureScreenshot(executingTabId);
          } catch (e) {
            console.warn('[QA Agent] Screenshot failed:', e);
          }

          stepResults.push(stepResult);
          port.postMessage({ type: 'STEP_COMPLETE', ...stepResult });
          continue;
        }

        // Execute the action via content script
        const result = await executeStepInTab(executingTabId, data);

        // Capture screenshot
        let screenshot = null;
        try {
          screenshot = await captureScreenshot(executingTabId);
        } catch (e) {
          console.warn('[QA Agent] Screenshot failed:', e);
        }

        const stepResult = {
          stepId,
          blockId: node.id,
          blockType: data.blockType,
          status: 'passed',
          screenshot,
          durationMs: Date.now() - stepStart,
          actualResult: result?.actualResult || 'OK',
          description: data.label || data.description || data.blockType,
          target: data.selector || data.url,
          expectedResult: data.expectedValue || data.value,
        };

        stepResults.push(stepResult);
        port.postMessage({ type: 'STEP_COMPLETE', ...stepResult });

      } catch (error) {
        // Capture screenshot on error too
        let screenshot = null;
        try {
          screenshot = await captureScreenshot(executingTabId);
        } catch (e) {
          console.warn('[QA Agent] Error screenshot failed:', e);
        }

        const stepResult = {
          stepId,
          blockId: node.id,
          blockType: data.blockType,
          status: 'failed',
          screenshot,
          error: error.message || String(error),
          durationMs: Date.now() - stepStart,
          description: data.label || data.description || data.blockType,
          target: data.selector || data.url,
          expectedResult: data.expectedValue || data.value,
        };

        stepResults.push(stepResult);
        port.postMessage({ type: 'STEP_ERROR', ...stepResult });

        // Send TEST_COMPLETE immediately so the frontend can save results
        try {
          port.postMessage({
            type: 'TEST_COMPLETE',
            testCaseId,
            status: 'failed',
            stepResults,
            durationMs: Date.now() - testStartTime,
          });
        } catch (e) {
          console.warn('[QA Agent] Could not send TEST_COMPLETE:', e);
        }

        // Show failure in popup and wait for retry
        isPaused = true;
        currentStepDescription = stepDescription;
        broadcastStatus('failed', {
          testName: currentTestName,
          currentStep: i + 1,
          totalSteps: executionOrder.length,
          stepDescription,
          error: error.message || String(error),
        });

        const errorAction = await waitIfPaused();
        if (errorAction === 'retry') {
          // Remove the failed result and retry this step
          stepResults.pop();
          i--;
          continue;
        }

        // If not retried, we're done — results already sent
        broadcastStatus('completed', {
          testName: currentTestName,
          result: 'failed',
          error: error.message || String(error),
        });
        return;
      }
    }

    // All steps passed
    port.postMessage({
      type: 'TEST_COMPLETE',
      testCaseId,
      status: 'passed',
      stepResults,
      durationMs: Date.now() - testStartTime,
    });

  } catch (error) {
    port.postMessage({
      type: 'TEST_COMPLETE',
      testCaseId,
      status: 'failed',
      stepResults,
      error: error.message || String(error),
      durationMs: Date.now() - testStartTime,
    });
  }
}

function stopTestExecution(port) {
  port.postMessage({
    type: 'TEST_COMPLETE',
    testCaseId: currentTestCaseId,
    status: 'stopped',
    stepResults,
    durationMs: Date.now() - testStartTime,
  });
  currentTestFlow = null;
  executingTabId = null;
}

function getExecutionOrder(testFlow) {
  const { nodes, edges } = testFlow;
  if (!nodes || !edges) return [];

  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const adjacency = new Map();
  edges.forEach(e => {
    if (!adjacency.has(e.source)) adjacency.set(e.source, []);
    adjacency.get(e.source).push(e.target);
  });

  // Find start node
  const startNode = nodes.find(n => n.data?.blockType === 'start');
  if (!startNode) return nodes; // Fallback: return all nodes
  
  // BFS from start
  const order = [];
  const visited = new Set();
  const queue = [startNode.id];
  
  while (queue.length > 0) {
    const id = queue.shift();
    if (visited.has(id)) continue;
    visited.add(id);
    
    const node = nodeMap.get(id);
    if (node) order.push(node);
    
    const targets = adjacency.get(id) || [];
    targets.forEach(t => {
      if (!visited.has(t)) queue.push(t);
    });
  }
  
  return order;
}

async function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    function listener(id, changeInfo) {
      if (id === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        // Short delay for content scripts to initialize
        setTimeout(resolve, 500);
      }
    }
    // Check if already loaded
    chrome.tabs.get(tabId, (tab) => {
      if (tab.status === 'complete') {
        setTimeout(resolve, 500);
      } else {
        chrome.tabs.onUpdated.addListener(listener);
      }
    });
  });
}

async function executeStepInTab(tabId, blockData) {
  // Ensure the content script is injected
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content-script.js'],
    });
  } catch (e) {
    console.warn('[QA Agent] Content script injection skipped:', e.message);
  }

  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, {
      type: 'EXECUTE_ACTION',
      data: blockData,
    }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (response?.error) {
        reject(new Error(response.error));
        return;
      }
      resolve(response);
    });
  });
}

async function captureScreenshot(tabId) {
  // Focus the tab's window first to ensure captureVisibleTab works
  try {
    const tab = await chrome.tabs.get(tabId);
    await chrome.windows.update(tab.windowId, { focused: true });
    await chrome.tabs.update(tabId, { active: true });
    // Small delay for UI to settle
    await new Promise(r => setTimeout(r, 200));
  } catch (e) {
    console.warn('[QA Agent] Could not focus tab:', e);
  }

  return new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(dataUrl);
      }
    });
  });
}
