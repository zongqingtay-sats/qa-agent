/**
 * High-level browser extension helpers.
 *
 * Re-exports core messaging primitives from `./extension-messaging` and
 * adds higher-level operations (page scraping, element picking, tab
 * management) that build on top of `connectToExtension`.
 *
 * @module extension
 */

// Re-export core messaging API so consumers can import everything from "extension"
export {
  setExtensionId, getExtensionId, pingExtension,
  connectToExtension, executeTestViaExtension, stopTestViaExtension,
  type ExtensionCallbacks, type ExtensionConnection,
} from "./extension-messaging";

import { connectToExtension } from "./extension-messaging";

// ─── Scrape ──────────────────────────────────────────────────────────

/**
 * Scrape the DOM of a page at `url` via the extension.
 *
 * Opens a connection, sends SCRAPE_PAGE, and waits up to 30 s for the
 * result before timing out.
 *
 * @param extensionId - Chrome extension ID.
 * @param url         - The page URL to scrape.
 * @returns An object with `html`, `title`, `url`, or `error`.
 */
export function scrapePageViaExtension(
  extensionId: string,
  url: string,
): Promise<{ html?: string; title?: string; url?: string; error?: string }> {
  return new Promise((resolve) => {
    const connection = connectToExtension(extensionId, {
      onConnected: () => { connection?.port.postMessage({ type: "SCRAPE_PAGE", url }); },
      onDisconnect: () => { resolve({ error: "Disconnected before scrape completed" }); },
    });
    if (!connection) { resolve({ error: "Could not connect to extension" }); return; }

    connection.port.onMessage.addListener((message: any) => {
      if (message.type === "SCRAPE_RESULT") {
        connection.disconnect();
        resolve(message.error ? { error: message.error } : { html: message.html, title: message.title, url: message.url });
      }
    });
    setTimeout(() => { connection.disconnect(); resolve({ error: "Scrape timed out" }); }, 30000);
  });
}

// ─── Element picker ──────────────────────────────────────────────────

/**
 * Activate the element picker on the active (or specified) tab.
 *
 * Sends PICK_ELEMENT and waits up to 60 s for the user to click.
 *
 * @param extensionId - Chrome extension ID.
 * @param tabId       - Optional tab ID to pick from.
 * @returns The captured CSS selector, or empty string on failure.
 */
export function pickElementViaExtension(
  extensionId: string,
  tabId?: number,
): Promise<{ selector: string; error?: string }> {
  return new Promise((resolve) => {
    const connection = connectToExtension(extensionId, {
      onConnected: () => { connection?.port.postMessage({ type: "PICK_ELEMENT", tabId }); },
      onDisconnect: () => { resolve({ selector: "", error: "Disconnected" }); },
    });
    if (!connection) { resolve({ selector: "", error: "Could not connect to extension" }); return; }

    connection.port.onMessage.addListener((message: any) => {
      if (message.type === "PICK_ELEMENT_RESULT") {
        connection.disconnect();
        resolve({ selector: message.selector || "", error: message.error });
      }
    });
    setTimeout(() => { connection.disconnect(); resolve({ selector: "", error: "Element pick timed out" }); }, 60000);
  });
}

// ─── Tab management ──────────────────────────────────────────────────

/** Represents a browser tab returned by the extension. */
export interface BrowserTab {
  id: number;
  title: string;
  url: string;
  favIconUrl?: string;
  active?: boolean;
}

/**
 * List open browser tabs via the extension.
 *
 * @param extensionId - Chrome extension ID.
 * @returns An array of {@link BrowserTab} objects, or an error.
 */
export function listTabsViaExtension(
  extensionId: string,
): Promise<{ tabs: BrowserTab[]; error?: string }> {
  return new Promise((resolve) => {
    const connection = connectToExtension(extensionId, {
      onConnected: () => { connection?.port.postMessage({ type: "LIST_TABS" }); },
      onDisconnect: () => { resolve({ tabs: [], error: "Disconnected" }); },
    });
    if (!connection) { resolve({ tabs: [], error: "Could not connect to extension" }); return; }

    connection.port.onMessage.addListener((message: any) => {
      if (message.type === "LIST_TABS_RESULT") {
        connection.disconnect();
        resolve({ tabs: message.tabs || [], error: message.error });
      }
    });
    setTimeout(() => { connection.disconnect(); resolve({ tabs: [], error: "Timed out" }); }, 10000);
  });
}

/**
 * Open a new browser tab at `url` via the extension.
 *
 * @param extensionId - Chrome extension ID.
 * @param url         - URL to open.
 * @returns The new tab's ID, or an error.
 */
export function openTabViaExtension(
  extensionId: string,
  url: string,
): Promise<{ tabId?: number; error?: string }> {
  return new Promise((resolve) => {
    const connection = connectToExtension(extensionId, {
      onConnected: () => { connection?.port.postMessage({ type: "OPEN_TAB", url }); },
      onDisconnect: () => { resolve({ error: "Disconnected" }); },
    });
    if (!connection) { resolve({ error: "Could not connect to extension" }); return; }

    connection.port.onMessage.addListener((message: any) => {
      if (message.type === "OPEN_TAB_RESULT") {
        connection.disconnect();
        resolve({ tabId: message.tabId, error: message.error });
      }
    });
    setTimeout(() => { connection.disconnect(); resolve({ error: "Timed out" }); }, 15000);
  });
}
