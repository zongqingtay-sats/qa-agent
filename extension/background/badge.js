/**
 * @file background/badge.js
 * @description Manages the extension toolbar badge and broadcasts status
 * updates to the popup and any other internal listeners.
 *
 * Badge text uses compact symbols so it remains legible at small sizes:
 *   ▶ = running,  II = paused,  ✕ = failed,  (blank) = idle/connected/completed
 */

import { get, set } from './state.js';

/**
 * Map of status → badge configuration.
 * Only statuses that display a visible badge are included.
 * @type {Record<string, { text: string, bg: string }>}
 */
const BADGE_CONFIG = {
  running: { text: '▶', bg: '#3b82f6' },
  paused:  { text: 'II', bg: '#f59e0b' },
  failed:  { text: '✕',  bg: '#ef4444' },
};

/**
 * Update the extension badge and notify all popup/internal listeners
 * of a status change.
 *
 * Also persists key fields (stepDescription, error, result) into
 * centralised state so they survive across popup open/close cycles.
 *
 * @param {string} status - The new status identifier.
 * @param {object} [extra={}] - Additional payload fields merged into the
 *   broadcast message (e.g. testName, currentStep, totalSteps, error).
 */
export function broadcastStatus(status, extra = {}) {
  // Persist status and optional fields into central state
  set('currentStatus', status);
  if (extra.stepDescription) set('currentStepDescription', extra.stepDescription);
  set('currentError', extra.error || '');
  if (extra.result !== undefined) set('currentResult', extra.result);

  // Update toolbar badge icon
  const badge = BADGE_CONFIG[status];
  if (badge) {
    chrome.action.setBadgeText({ text: badge.text });
    chrome.action.setBadgeBackgroundColor({ color: badge.bg });
    chrome.action.setBadgeTextColor({ color: '#ffffff' });
  } else {
    // Clear the badge for idle / connected / completed / disconnected
    chrome.action.setBadgeText({ text: '' });
  }

  // Broadcast to popup (and any other internal listeners)
  const message = {
    type: 'STATUS_UPDATE',
    status,
    testCaseId: get('currentTestCaseId'),
    testRunId: get('currentTestRunId'),
    hasConnectedBefore: get('hasConnectedBefore'),
    ...extra,
  };

  // sendMessage throws if no listener is registered — safe to swallow
  chrome.runtime.sendMessage(message).catch(() => {});
}
