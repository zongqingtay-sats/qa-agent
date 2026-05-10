/**
 * @file background.js
 * @description Entry point for the QA Agent background service worker.
 *
 * This file is intentionally minimal — it imports and initialises the
 * modular subsystems that handle messaging, test execution, badge
 * management, and popup window lifecycle.
 *
 * Module structure:
 *   background/state.js        – centralised mutable state
 *   background/badge.js        – toolbar badge + status broadcasting
 *   background/messaging.js    – Chrome message listeners
 *   background/execution.js    – test step execution engine
 *   background/flow.js         – execution order (BFS) + stop logic
 *   background/scraper.js      – page scraping handler
 *   background/tab-utils.js    – tab helpers (load, screenshot, etc.)
 *   background/popup-window.js – detached popup window management
 */

import { registerListeners } from './background/messaging.js';

// Bootstrap: wire up all Chrome message listeners
registerListeners();

console.log('[QA Agent] Background service worker initialised.');
