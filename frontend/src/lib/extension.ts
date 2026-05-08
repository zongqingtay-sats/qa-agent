// Browser extension communication helper
// Communicates with the QA Agent browser extension via chrome.runtime messaging

const EXTENSION_ID = typeof window !== 'undefined'
  ? (localStorage.getItem('qa-agent-extension-id') || '')
  : '';

export function setExtensionId(id: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('qa-agent-extension-id', id);
  }
}

export function getExtensionId(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('qa-agent-extension-id') || '';
  }
  return '';
}

export async function pingExtension(extensionId?: string): Promise<boolean> {
  const id = extensionId || getExtensionId();
  if (!id || typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    return false;
  }

  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(id, { type: 'PING' }, (response: any) => {
        if (chrome.runtime.lastError || !response) {
          resolve(false);
        } else {
          resolve(response.type === 'PONG');
        }
      });
    } catch {
      resolve(false);
    }
  });
}

export function connectToExtension(
  extensionId: string,
  callbacks: {
    onConnected?: () => void;
    onStepStart?: (data: any) => void;
    onStepComplete?: (data: any) => void;
    onStepError?: (data: any) => void;
    onTestComplete?: (data: any) => void;
    onDisconnect?: () => void;
  }
): { port: any; disconnect: () => void } | null {
  if (typeof chrome === 'undefined' || !chrome.runtime?.connect) {
    return null;
  }

  try {
    const port = chrome.runtime.connect(extensionId);

    port.onMessage.addListener((message: any) => {
      switch (message.type) {
        case 'CONNECTED':
          callbacks.onConnected?.();
          break;
        case 'STEP_START':
          callbacks.onStepStart?.(message);
          break;
        case 'STEP_COMPLETE':
          callbacks.onStepComplete?.(message);
          break;
        case 'STEP_ERROR':
          callbacks.onStepError?.(message);
          break;
        case 'TEST_COMPLETE':
          callbacks.onTestComplete?.(message);
          break;
      }
    });

    port.onDisconnect.addListener(() => {
      callbacks.onDisconnect?.();
    });

    // Send connect message
    port.postMessage({ type: 'CONNECT' });

    return {
      port,
      disconnect: () => {
        try { port.disconnect(); } catch { /* ignore */ }
      },
    };
  } catch {
    return null;
  }
}

export function executeTestViaExtension(
  port: any,
  testFlow: any,
  testCaseId: string,
  baseUrl: string
) {
  port.postMessage({
    type: 'EXECUTE_TEST',
    testFlow,
    testCaseId,
    baseUrl,
  });
}

export function stopTestViaExtension(port: any) {
  port.postMessage({ type: 'STOP_TEST' });
}
