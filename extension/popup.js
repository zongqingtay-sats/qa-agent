/**
 * @file popup.js
 * @description Entry point for the QA Agent popup UI.
 *
 * Initialises DOM references, wires up event listeners, and delegates
 * all rendering to the popup/renderer.js module.
 *
 * Loaded as an ES module via script type="module" in popup.html.
 */

import { applyStatus } from './popup/renderer.js';

/** Base URL for deep links into the web app */
const APP_BASE = 'http://localhost:3000';

// ── Cache DOM element references ──
// Gathered once at startup to avoid repeated lookups during rapid updates.
const els = {
  statusPill:      document.getElementById('status-pill'),
  idleView:        document.getElementById('idle-view'),
  execInfo:        document.getElementById('execution-info'),
  testNameEl:      document.getElementById('test-name'),
  stepLabel:       document.getElementById('step-label'),
  stepCount:       document.getElementById('step-count'),
  progressEl:      document.getElementById('progress'),
  currentStepDesc: document.getElementById('current-step-desc'),
  errorMessage:    document.getElementById('error-message'),
  failHint:        document.getElementById('fail-hint'),
  testIdEl:        document.getElementById('test-id'),
  runIdEl:         document.getElementById('run-id'),
  detailsToggle:   document.getElementById('details-toggle'),
  detailsContent:  document.getElementById('details-content'),
  btnPause:        document.getElementById('btn-pause'),
  btnResume:       document.getElementById('btn-resume'),
  btnRetry:        document.getElementById('btn-retry'),
};

const extIdEl     = document.getElementById('ext-id');
const appLink     = document.getElementById('app-link');
const copiedToast = document.getElementById('copied-toast');

// ── Extension ID ──
extIdEl.textContent = chrome.runtime.id;

// Copy extension ID to clipboard on click
extIdEl.addEventListener('click', () => {
  navigator.clipboard.writeText(chrome.runtime.id);
  copiedToast.classList.add('show');
  setTimeout(() => copiedToast.classList.remove('show'), 1200);
});

// ── Open web app ──
appLink.addEventListener('click', () => {
  chrome.tabs.create({ url: APP_BASE });
});

// ── Collapsible details toggle ──
els.detailsToggle.addEventListener('click', () => {
  els.detailsToggle.classList.toggle('open');
  els.detailsContent.classList.toggle('open');
});

// ── Test controls ──
els.btnPause.addEventListener('click',  () => chrome.runtime.sendMessage({ type: 'PAUSE_TEST' }));
els.btnResume.addEventListener('click', () => chrome.runtime.sendMessage({ type: 'RESUME_TEST' }));
els.btnRetry.addEventListener('click',  () => chrome.runtime.sendMessage({ type: 'RETRY_STEP' }));

// ── Listen for live status updates from the background worker ──
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'STATUS_UPDATE') {
    applyStatus(message, els);
  }
});

// ── Query current state when the popup first opens ──
chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
  if (response) applyStatus(response, els);
});
