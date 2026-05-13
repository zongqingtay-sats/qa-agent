/**
 * Low-level messaging primitives for communicating with the QA Agent
 * Chrome extension via `chrome.runtime`.
 *
 * Exports connection management (`connectToExtension`), test execution
 * helpers, and extension-id persistence.
 *
 * @module extension-messaging
 */

import type { FlowData } from "@/types/api";

// ─── Extension ID persistence ────────────────────────────────────────

/**
 * Persist the extension ID to localStorage.
 *
 * @param id - Chrome extension ID string.
 */
export function setExtensionId(id: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("qa-agent-extension-id", id);
  }
}

/**
 * Read the persisted extension ID from localStorage.
 *
 * @returns The extension ID, or empty string if unavailable.
 */
export function getExtensionId(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem("qa-agent-extension-id") || "";
  }
  return "";
}

// ─── Ping ────────────────────────────────────────────────────────────

/**
 * Send a PING to the extension and resolve `true` if it responds PONG.
 *
 * @param extensionId - Optional override; defaults to stored ID.
 * @returns Whether the extension is reachable.
 */
export async function pingExtension(extensionId?: string): Promise<boolean> {
  const id = extensionId || getExtensionId();
  if (!id || typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return false;

  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(id, { type: "PING" }, (response: any) => {
        if (chrome.runtime.lastError || !response) resolve(false);
        else resolve(response.type === "PONG");
      });
    } catch { resolve(false); }
  });
}

// ─── Connection ──────────────────────────────────────────────────────

/** Callbacks accepted by {@link connectToExtension}. */
export interface ExtensionCallbacks {
  onConnected?: () => void;
  onStepStart?: (data: any) => void;
  onStepComplete?: (data: any) => void;
  onStepError?: (data: any) => void;
  onTestComplete?: (data: any) => void;
  onTestResumed?: (data: any) => void;
  onDisconnect?: () => void;
}

/** Return value of {@link connectToExtension}. */
export interface ExtensionConnection {
  port: any;
  disconnect: () => void;
}

/**
 * Open a persistent port to the extension and wire up event callbacks.
 *
 * @param extensionId - Chrome extension ID.
 * @param callbacks   - Event handlers for messages / disconnect.
 * @returns A connection handle, or `null` if Chrome APIs are unavailable.
 */
export function connectToExtension(
  extensionId: string,
  callbacks: ExtensionCallbacks,
): ExtensionConnection | null {
  if (typeof chrome === "undefined" || !chrome.runtime?.connect) return null;

  try {
    const port = chrome.runtime.connect(extensionId);

    port.onMessage.addListener((message: any) => {
      switch (message.type) {
        case "CONNECTED":     callbacks.onConnected?.();          break;
        case "STEP_START":    callbacks.onStepStart?.(message);   break;
        case "STEP_COMPLETE": callbacks.onStepComplete?.(message); break;
        case "STEP_ERROR":    callbacks.onStepError?.(message);   break;
        case "TEST_COMPLETE": callbacks.onTestComplete?.(message); break;
        case "TEST_RESUMED":  callbacks.onTestResumed?.(message); break;
      }
    });

    port.onDisconnect.addListener(() => callbacks.onDisconnect?.());
    port.postMessage({ type: "CONNECT" });

    return { port, disconnect: () => { try { port.disconnect(); } catch { /* ignore */ } } };
  } catch { return null; }
}

// ─── Test execution helpers ──────────────────────────────────────────

/**
 * Send an EXECUTE_TEST message through an open port.
 *
 * @param port       - An open extension port.
 * @param testFlow   - The flow graph to execute.
 * @param testCaseId - Associated test case ID.
 * @param baseUrl    - Base URL for the test.
 * @param testName   - Optional human-readable name.
 * @param testRunId  - Optional run ID for result tracking.
 */
export function executeTestViaExtension(
  port: { postMessage: (msg: Record<string, unknown>) => void },
  testFlow: FlowData,
  testCaseId: string,
  baseUrl: string,
  testName?: string,
  testRunId?: string,
) {
  port.postMessage({ type: "EXECUTE_TEST", testFlow, testCaseId, baseUrl, testName, testRunId });
}

/**
 * Send a STOP_TEST message through an open port.
 *
 * @param port - An open extension port.
 */
export function stopTestViaExtension(port: any) {
  port.postMessage({ type: "STOP_TEST" });
}
