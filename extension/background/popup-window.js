/**
 * @file background/popup-window.js
 * @description Manages the detached popup window that shows live test
 * progress. The popup is opened automatically when a test starts and is
 * tracked so that duplicate windows are not created.
 */

import { get, set } from './state.js';

/**
 * Open (or focus) the popup window.
 *
 * If the window is already open it will simply be brought to the front.
 * A `windows.onRemoved` listener is attached to clean up the stored
 * window ID when the user closes the popup manually.
 *
 * @returns {Promise<void>}
 */
export async function openPopupWindow() {
  const existingId = get('popupWindowId');

  // If a popup is already tracked, try to focus it
  if (existingId !== null) {
    try {
      const win = await chrome.windows.get(existingId);
      if (win) {
        await chrome.windows.update(existingId, { focused: true });
        return;
      }
    } catch {
      // Window no longer exists — fall through to create a new one
      set('popupWindowId', null);
    }
  }

  // Create a compact popup window sized for the popup UI
  const win = await chrome.windows.create({
    url: chrome.runtime.getURL('popup.html'),
    type: 'popup',
    width: 360,
    height: 420,
    focused: true,
  });

  set('popupWindowId', win.id);

  // Clean up tracking when the user closes the popup
  chrome.windows.onRemoved.addListener(function onRemoved(windowId) {
    if (windowId === win.id) {
      set('popupWindowId', null);
      chrome.windows.onRemoved.removeListener(onRemoved);

      // If a test is paused (e.g. on failure), closing the popup means abort
      if (get('isPaused')) {
        const resolve = get('pauseResolve');
        if (resolve) {
          resolve('abort');
          set('pauseResolve', null);
        }
        set('isPaused', false);
      }
    }
  });
}
