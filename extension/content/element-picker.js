/**
 * @file content/element-picker.js
 * @description Interactive element picker overlay.
 *
 * When activated, highlights elements on hover and captures a unique
 * CSS selector when the user clicks.  The result is sent back via
 * `sendResponse` from the triggering message.
 */

/** Build a reasonably unique CSS selector for the given element. */
function buildSelector(el) {
  // Prefer data-testid
  const testId = el.getAttribute('data-testid');
  if (testId) return `[data-testid="${testId}"]`;

  // Prefer id — but still include tag + classes for readability
  if (el.id) {
    const tag = el.tagName.toLowerCase();
    const classes = Array.from(el.classList)
      .filter((c) => !c.startsWith('hover') && !c.startsWith('focus') && !c.startsWith('qa-agent-') && c.length < 50)
      .map((c) => `.${CSS.escape(c)}`)
      .join('');
    return `${tag}${classes}#${CSS.escape(el.id)}`;
  }

  // Try unique class combination
  if (el.classList.length > 0) {
    const classes = Array.from(el.classList)
      .filter((c) => !c.startsWith('hover') && !c.startsWith('focus') && !c.startsWith('qa-agent-') && c.length < 50)
      .map((c) => `.${CSS.escape(c)}`)
      .join('');
    if (classes && document.querySelectorAll(`${el.tagName.toLowerCase()}${classes}`).length === 1) {
      return `${el.tagName.toLowerCase()}${classes}`;
    }
  }

  // Fallback: walk up the DOM to build a path
  const parts = [];
  let current = el;
  while (current && current !== document.body && parts.length < 5) {
    let seg = current.tagName.toLowerCase();
    if (current.id) { parts.unshift(`#${current.id}`); break; }
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter((c) => c.tagName === current.tagName);
      if (siblings.length > 1) {
        seg += `:nth-of-type(${siblings.indexOf(current) + 1})`;
      }
    }
    parts.unshift(seg);
    current = parent;
  }
  return parts.join(' > ');
}

/**
 * Activate the element picker.
 *
 * Creates an overlay that intercepts mouse events.  On click the
 * selected element's CSS selector is returned and the overlay removed.
 *
 * @returns {Promise<{ selector: string, tagName: string }>}
 */
function activateElementPicker() {
  return new Promise((resolve) => {
    // Highlight outline element
    let highlighted = null;
    const HIGHLIGHT = 'qa-agent-picker-highlight';

    // Inject highlight style
    const style = document.createElement('style');
    style.id = 'qa-agent-picker-style';
    style.textContent = `
      .${HIGHLIGHT} {
        outline: 2px solid #3b82f6 !important;
        outline-offset: 2px !important;
        cursor: crosshair !important;
      }
      .qa-agent-picker-banner {
        position: fixed; top: 0; left: 0; right: 0; z-index: 2147483647;
        background: #3b82f6; color: white; text-align: center;
        padding: 8px; font: 14px/1 system-ui, sans-serif;
      }
    `;
    document.head.appendChild(style);

    // Banner
    const banner = document.createElement('div');
    banner.className = 'qa-agent-picker-banner';
    banner.textContent = 'Click an element to capture its selector — press Esc to cancel';
    document.body.appendChild(banner);

    function cleanup() {
      if (highlighted) highlighted.classList.remove(HIGHLIGHT);
      document.removeEventListener('mouseover', onHover, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKey, true);
      style.remove();
      banner.remove();
    }

    function onHover(e) {
      if (highlighted) highlighted.classList.remove(HIGHLIGHT);
      // Ignore the banner itself
      if (e.target === banner) return;
      highlighted = e.target;
      highlighted.classList.add(HIGHLIGHT);
    }

    function onClick(e) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (e.target === banner) return;
      // Remove highlight class before building selector so it's not included
      if (highlighted) highlighted.classList.remove(HIGHLIGHT);
      const selector = buildSelector(e.target);
      cleanup();
      resolve({ selector, tagName: e.target.tagName.toLowerCase() });
    }

    function onKey(e) {
      if (e.key === 'Escape') {
        cleanup();
        resolve({ selector: '', tagName: '', cancelled: true });
      }
    }

    document.addEventListener('mouseover', onHover, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey, true);
  });
}

// Expose globally for use in content-script.js
// eslint-disable-next-line no-unused-vars
var pickElement = activateElementPicker;
