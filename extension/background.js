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

// Listen for connections from the web app
chrome.runtime.onConnectExternal.addListener((port) => {
  console.log('[QA Agent] External connection from:', port.sender?.origin);
  connectedPorts.set(port.sender?.origin, port);

  port.onMessage.addListener(async (message) => {
    console.log('[QA Agent] Received message:', message.type);

    switch (message.type) {
      case 'CONNECT':
        port.postMessage({ type: 'CONNECTED', extensionId: chrome.runtime.id });
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
  });
});

// Also listen for one-time messages from the web app
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message.type === 'PING') {
    sendResponse({ type: 'PONG', extensionId: chrome.runtime.id });
    return true;
  }
});

async function startTestExecution(port, testFlow, testCaseId, baseUrl) {
  currentTestFlow = testFlow;
  currentTestCaseId = testCaseId;
  currentBaseUrl = baseUrl;
  stepResults = [];
  currentStepIndex = 0;
  testStartTime = Date.now();

  // Determine execution order by traversing edges from start node
  const executionOrder = getExecutionOrder(testFlow);

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
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    executingTabId = tabs[0]?.id;

    if (!executingTabId) {
      const tab = await chrome.tabs.create({ url: baseUrl || 'about:blank' });
      executingTabId = tab.id;
    }

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
      port.postMessage({
        type: 'STEP_START',
        stepId,
        blockId: node.id,
        blockType: data.blockType,
      });

      const stepStart = Date.now();

      try {
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

        // Halt entire flow on error
        port.postMessage({
          type: 'TEST_COMPLETE',
          testCaseId,
          status: 'failed',
          stepResults,
          durationMs: Date.now() - testStartTime,
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

async function executeStepInTab(tabId, blockData) {
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
