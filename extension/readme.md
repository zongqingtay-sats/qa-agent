# QA Agent Browser Extension

Chrome/Edge extension that executes automated QA test flows on web applications. It receives test flow instructions from the QA Agent web app and runs them step-by-step in a browser tab, capturing screenshots at each step.

## Prerequisites

- Google Chrome or Microsoft Edge
- QA Agent frontend running at `http://localhost:3000`

## Installation

1. Open your browser's extensions page:
   - **Chrome**: Navigate to `chrome://extensions`
   - **Edge**: Navigate to `edge://extensions`

2. Enable **Developer mode** using the toggle in the top-right corner.

3. Click **Load unpacked**.

4. Select the `extension/` folder from this repository:
   ```
   qa-agent/extension/
   ```

5. The extension should now appear in your extensions list with the name **QA Agent Test Runner**.

6. Copy the **Extension ID** displayed under the extension name (e.g. `abcdefghijklmnopqrstuvwxyz`).

## Connecting to the Web App

1. Open the QA Agent web app at `http://localhost:3000`.
2. Navigate to **Settings** in the sidebar.
3. Paste the Extension ID into the **Extension ID** field and click **Save**.
4. Click **Test Connection** to verify the extension is reachable.

## How It Works

When you run a test case from the web app:

1. The web app connects to the extension via `chrome.runtime.connect`.
2. The extension opens a new browser tab navigated to the test's base URL.
3. It traverses the test flow graph (BFS from Start node) and executes each block:
   - **Navigate** — navigates the tab to the specified URL
   - **Click** — clicks the element matching the CSS selector
   - **Type** — types text into an input element
   - **Select** — selects an option from a dropdown
   - **Hover** — hovers over an element
   - **Scroll** — scrolls the page or element
   - **Wait** — waits for a timeout or element visibility
   - **Assert** — validates element existence, visibility, text content, or URL
   - **Screenshot** — captures a screenshot of the current page
4. A screenshot is captured after every step (pass or fail).
5. Results are sent back to the web app and saved as a test run.

## Permissions

| Permission | Purpose |
|---|---|
| `activeTab` | Access the active tab to execute test actions |
| `scripting` | Inject the content script into test pages |
| `tabs` | Create, navigate, and query browser tabs |
| `<all_urls>` | Run tests on any website |

## Troubleshooting

### Extension not connecting
- Verify the Extension ID in Settings matches exactly.
- Make sure the extension is enabled (not disabled) in the extensions page.
- Check that `http://localhost:3000` is listed in `externally_connectable.matches` in `manifest.json`.

### Steps failing with "Could not establish connection"
- The content script may not be injected. Reload the extension and try again.
- Some pages (e.g. `chrome://` URLs, browser internal pages) cannot be automated.

### No screenshots captured
- Ensure the test tab window is not minimized.
- The extension needs the tab to be visible to capture screenshots.

### After updating extension files
- Go to `chrome://extensions` and click the **reload** button (circular arrow) on the QA Agent extension.
