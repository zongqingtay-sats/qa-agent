# Functional Specifications — QA Agent

## 1. User Personas

### 1.1 QA Engineer (Primary)
- Creates and edits test cases using the visual editor
- Imports test cases from documents or generates them via AI
- Executes test cases and reviews results
- Exports result reports for stakeholders

### 1.2 Test Manager
- Oversees test projects and organizes test cases into projects/features/phases
- Reviews test results and tracks coverage
- Manages team access and permissions (Production)
- Comments on test cases to provide feedback

### 1.3 Developer
- Generates test cases from application source code
- Reviews failed test results to debug issues
- Provides source files for AI-based test generation

---

## 2. User Flows

### 2.1 Test Case Import Flow
```
Upload Document → Parse & Extract → Review Generated Test Cases → Edit (optional) → Save to Project
```
1. User navigates to Dashboard and clicks "Import Test Cases"
2. User selects file(s) — Word, PDF, Text, or JSON
3. System parses the document and extracts test case candidates
4. System displays parsed test cases in a review table
5. User can edit, delete, or accept each test case
6. User confirms and saves test cases

### 2.2 AI Test Case Generation Flow
```
Provide Input → Select Generation Mode → AI Generates → Review & Edit → Save
```
1. User navigates to "Generate Test Cases"
2. User selects input mode: Requirements Document, Natural Language, or Source Code
3. User provides the input (upload file, paste text, or upload source files)
4. System sends input to GitHub Copilot Chat API with appropriate prompt
5. AI returns structured test case suggestions
6. User reviews, edits, and saves accepted test cases

### 2.3 Test Flow Editing Flow
```
Open Test Case → Visual Editor → Add/Connect Blocks → Configure Properties → Validate → Save
```
1. User opens a test case from the test case list
2. Visual flow editor loads with existing blocks (or empty canvas for new)
3. User drags blocks from the palette onto the canvas
4. User connects blocks via edges to define execution order
5. User clicks a block to configure its properties (selector, URL, value, etc.)
6. User clicks "Validate" to check flow integrity
7. User saves the test flow

### 2.4 Test Execution Flow
```
Select Test Cases → Configure → Start Execution → Monitor Progress → View Results
```
1. User navigates to the Test Case Management page
2. User selects one or more test cases via checkboxes
3. User clicks "Run Selected Tests"
4. System verifies browser extension is connected
5. System sends test flow to the browser extension
6. Extension executes each step, capturing screenshots
7. Web app displays real-time progress with step status
8. On completion (or failure), results are saved and displayed

### 2.5 Result Review Flow
```
Open Test Run → View Summary → Inspect Steps → Export Report
```
1. User navigates to Test Results page
2. User sees a list of past test runs with pass/fail summary
3. User clicks a test run to view detailed results
4. User sees per-step breakdown: action, expected result, actual result, screenshot, pass/fail
5. For failed steps, the offending block is highlighted in the flow view
6. User clicks "Export" and selects format (JSON, DOCX, PDF)

### 2.6 Project Management Flow
```
Projects List → Select Project → View Grouped Test Cases → Toggle Grouping → Manage Visibility → Open Overview
```
1. User navigates to the Projects page and sees a list of projects
2. User clicks a project to open the Project Detail page
3. Test cases are displayed grouped by feature (default grouping)
4. User clicks grouping toggle buttons (Feature / Phase / Feature→Phase / Phase→Feature) to change the grouping
5. User clicks the eye icon on a group header to hide/show test cases within that group
6. User clicks a test case name to open the Test Case Overview page
7. User reviews description, comments, and the flow preview thumbnail
8. User clicks the flow preview to navigate to the full flow editor

### 2.7 Test Case Assignment Flow
```
Select Test Cases → Click Assign → Pick Users → Confirm
```
1. User navigates to the test case list (project detail page or global list)
2. User selects one or more test cases via checkboxes
3. User clicks the "Assign" button in the batch action bar
4. A dialog opens with a multi-select user picker
5. User selects one or more users and confirms
6. The selected users are assigned to all checked test cases
7. Assignee avatars appear on each test case row

### 2.8 Extension Setup Flow
```
Open Setup → Download Extension → Load in Browser → Copy ID → Configure & Test
```
1. User navigates to the Extension Setup page (via sidebar or first-visit prompt)
2. User downloads the extension package
3. User follows step-by-step instructions to load the extension in Chrome/Edge developer mode
4. User locates and copies the extension ID from the browser extensions page
5. User pastes the extension ID into the input field on the setup page
6. User clicks "Test Connection" to verify the extension is reachable
7. On success, setup is complete and user proceeds to create/run tests

---

## 3. Feature Specifications

### 3.1 Test Case Import & Generation Module (FR-1)

#### 3.1.1 Document Parsing Pipeline

**Supported formats and extraction logic:**

| Format | Parser | Extraction Strategy |
|--------|--------|-------------------|
| Word (.docx) | mammoth | Convert to HTML, then parse structured content (headings → test names, numbered lists → steps) |
| PDF | pdf-parse | Extract text, use AI to identify test case boundaries and structure |
| Text (.txt) | Built-in | Line-by-line parsing with heuristic detection of test case structure |
| JSON | Built-in | Validate against test case JSON schema, import directly |

**Test Case JSON Schema:**
```json
{
  "id": "string (UUID)",
  "name": "string",
  "description": "string",
  "preconditions": "string",
  "passingCriteria": "string",
  "tags": ["string"],
  "steps": [
    {
      "order": "number",
      "action": "string (block type)",
      "target": "string (CSS selector or URL)",
      "value": "string (input value or expected value)",
      "description": "string"
    }
  ]
}
```

#### 3.1.2 AI-Powered Test Case Generation

**Input Modes:**

1. **Requirements Document** — User uploads a requirements document. System extracts text and sends to Copilot Chat API with a prompt that requests structured test cases covering each requirement.

2. **Natural Language** — User types a free-text description of what to test. System wraps input in a structured prompt requesting test cases with steps, selectors, and expected outcomes.

3. **Source Code** — User uploads relevant source files (e.g., React components, API routes). System extracts component structure, event handlers, and routes, then prompts AI to generate test cases covering the UI interactions and data flows.

**AI Response Processing:**
- AI responses are parsed from markdown/JSON into structured test case objects
- Each generated test case is assigned a temporary ID and presented for review
- User can accept, edit, or discard each generated test case
- Accepted test cases are converted to test flows with appropriate blocks

### 3.2 Visual Test Flow Editor (FR-2)

#### 3.2.1 Canvas UI

The editor uses a node-based canvas (powered by React Flow) with the following capabilities:
- **Drag-and-drop** blocks from a left-side palette onto the canvas
- **Connect** blocks by dragging from an output handle to an input handle
- **Select** blocks to view/edit properties in a right-side panel
- **Zoom/Pan** via mouse wheel and drag
- **Minimap** in the bottom-right corner
- **Undo/Redo** via Ctrl+Z / Ctrl+Shift+Z
- **Auto-layout** option to organize blocks automatically

#### 3.2.2 Block Types

| Block Type | Category | Description | Configurable Properties |
|-----------|----------|-------------|------------------------|
| **Start** | Control | Entry point of the test flow | Test case name, base URL |
| **End** | Control | Exit point — test marked as passed if reached | — |
| **Navigate** | Action | Navigate browser to a URL | URL (absolute or relative) |
| **Click** | Action | Click an element on the page | CSS selector, click type (single/double/right) |
| **Type** | Action | Type text into an input field | CSS selector, text value, clear before typing |
| **Select** | Action | Select an option from a dropdown | CSS selector, value or label |
| **Hover** | Action | Hover over an element | CSS selector |
| **Scroll** | Action | Scroll the page or an element | Direction, distance (px), CSS selector (optional) |
| **Wait** | Action | Wait for a condition or timeout | Wait type (time/element visible/element hidden), timeout (ms), CSS selector |
| **Assert** | Validation | Verify a condition on the page | Assertion type (element exists, text contains, value equals, URL matches), CSS selector, expected value |
| **If-Else** | Control | Conditional branching based on a page condition | Condition type, CSS selector, expected value, true-branch edge, false-branch edge |
| **Screenshot** | Capture | Take an explicit screenshot (in addition to automatic ones) | Label/description |

#### 3.2.3 Block Properties Panel

When a block is selected, the right panel shows:
- Block type (read-only) and custom label
- Type-specific configuration fields (rendered dynamically)
- Description/notes field
- Expected outcome / passing criteria
- Delete block button

#### 3.2.4 Flow Validation Rules

| Rule | Error Level |
|------|------------|
| Flow must have exactly one Start block | Error |
| Flow must have at least one End block | Error |
| All blocks must be reachable from the Start block | Error |
| If-Else blocks must have both true and false edges | Warning |
| CSS selectors should be non-empty for action blocks | Error |
| Navigate blocks must have a valid URL | Error |
| Multiple edges connected to the same handle | Warning |

#### 3.2.5 Undo/Redo System

- **Undo stack**: Captures snapshots of nodes + edges (max 50 entries)
- **Redo stack**: Populated when undo is triggered, cleared on new edits
- **Debounced drag grouping**: Node drag operations are grouped into a single undo entry (300ms debounce) to prevent flooding the stack with per-pixel moves
- **Keyboard shortcuts**: Ctrl+Z (undo), Ctrl+Y / Ctrl+Shift+Z (redo)
- **Toolbar buttons**: Undo/Redo buttons with disabled state based on stack availability

#### 3.2.6 Copy/Cut/Paste

- **Copy (Ctrl+C)**: Stores selected nodes in an in-memory clipboard with relative positions
- **Cut (Ctrl+X)**: Copies selected nodes then deletes them from the canvas
- **Paste (Ctrl+V)**: Inserts clipboard nodes at an offset position with new IDs; strips `executionStatus` from pasted nodes to avoid stale highlights
- Internal edges between copied nodes are preserved

#### 3.2.7 Element Picker

Allows users to interactively select CSS selectors from the target web page:

1. User clicks the crosshair icon next to a CSS selector field in the properties panel
2. A dialog opens showing available browser tabs (fetched from extension via `LIST_TABS` message)
3. User selects a tab or enters a URL manually and clicks "Go & Pick"
4. Extension injects the element picker content script into the target tab
5. User hovers over elements (blue outline highlight) and clicks to select
6. Extension builds an optimal CSS selector (prefers `data-testid` → `id` → unique classes → `nth-of-type` path)
7. Selected selector is returned to the dialog and applied to the field

#### 3.2.8 Last Run Panel

A collapsible panel below the metadata panel in the editor showing:
- Last run ID (clickable link to test run detail page)
- Status badge (passed/failed/running)
- Error message (collapsed by default)
- When a node is selected: step detail and screenshot for that node from the last run
- On page load: automatically fetches the most recent run and applies highlight colors (green=passed, red=failed, blue=running) to flow blocks

#### 3.2.9 Save Shortcut

- **Ctrl+S**: Triggers save when the flow is dirty (prevents browser default save dialog)
- Save button is hidden when no unsaved changes exist (dirty-state via snapshot comparison)

#### 3.2.10 Export Formats

- **JSON** — Full test flow data including block positions, edges, and properties
- **DOCX** — Formatted document with test case name, description, numbered steps, and passing criteria
- **PDF** — Same content as DOCX rendered as PDF

### 3.3 Test Execution Engine (FR-3)

#### 3.3.1 Browser Extension Architecture

The browser extension (Chrome/Edge, Manifest V3) consists of:
- **Popup UI** — Shows connection status, current execution state, progress bar, step count, current step description, and pause/resume/retry/skip controls
- **Background Service Worker** — Receives test flows from the web app, orchestrates step execution, manages pause/resume state
- **Content Script** — Injected into the target page, performs DOM interactions (click, type, assert)
- **Page Scraper** — Content script also supports `SCRAPE_PAGE` message to extract page HTML for AI context

#### 3.3.2 Communication Protocol

```
Web App ←→ Background Service Worker ←→ Content Script
   (chrome.runtime.sendMessage)      (chrome.tabs.sendMessage)
```

**Message Types:**

| Message | Direction | Payload |
|---------|-----------|---------|
| `CONNECT` | Web App → Extension | `{ type: "CONNECT" }` |
| `CONNECTED` | Extension → Web App | `{ type: "CONNECTED", extensionId }` |
| `EXECUTE_TEST` | Web App → Extension | `{ type: "EXECUTE_TEST", testFlow }` |
| `STOP_TEST` | Web App → Extension | `{ type: "STOP_TEST" }` |
| `SCRAPE_PAGE` | Web App → Extension | `{ type: "SCRAPE_PAGE", url }` |
| `STEP_START` | Extension → Web App | `{ type: "STEP_START", stepId, blockType }` |
| `STEP_COMPLETE` | Extension → Web App | `{ type: "STEP_COMPLETE", stepId, screenshot, duration }` |
| `STEP_ERROR` | Extension → Web App | `{ type: "STEP_ERROR", stepId, error, screenshot }` |
| `TEST_COMPLETE` | Extension → Web App | `{ type: "TEST_COMPLETE", results }` |
| `PAUSE_TEST` | Popup → Background | `{ type: "PAUSE_TEST" }` |
| `RESUME_TEST` | Popup → Background | `{ type: "RESUME_TEST" }` |
| `RETRY_STEP` | Popup → Background | `{ type: "RETRY_STEP" }` |
| `GET_STATUS` | Popup → Background | `{ type: "GET_STATUS" }` |
| `STATUS_UPDATE` | Background → Popup | `{ type: "STATUS_UPDATE", status, ... }` |

#### 3.3.3 Step Execution Model

For each block in the test flow (following edge order from Start):
1. Send `STEP_START` message to web app
2. Execute the action via Content Script:
   - **Navigate** — `window.location.href = url`
   - **Click** — `document.querySelector(selector).click()`
   - **Type** — Focus element, set value, dispatch input events
   - **Assert** — Evaluate condition, throw error if false
   - **Wait** — Poll for condition or setTimeout
   - **If-Else** — Evaluate condition, follow appropriate branch edge
3. Capture screenshot via `chrome.tabs.captureVisibleTab()`
4. Send `STEP_COMPLETE` or `STEP_ERROR` message with screenshot
5. On error: halt execution, send `TEST_COMPLETE` with failure status

#### 3.3.4 Execution Monitor UI

During execution, the web app displays:
- The flow editor in read-only mode
- Current executing block highlighted (pulsing blue border)
- Completed blocks marked green (pass) or red (fail)
- Step-by-step log panel with timestamps and screenshots
- Progress bar showing completed/total steps
- "Stop" button to abort execution

#### 3.3.5 Extension Popup UI

During execution, the extension popup displays:
- Connection status with color-coded dot (green=connected, red=disconnected, blue=running)
- Current test case name
- Current step description
- Progress bar with step count (e.g., "Step 3 / 10")
- **Pause** button — pauses execution before the next step
- **Resume** button — resumes paused execution
- **Retry Step** button — retries the current failed step
- **Skip Step** button — skips the current step and continues
- Status badge icons on the extension toolbar: ▶ (running), ⏸ (paused), ✕ (failed)

#### 3.3.6 Real-Time Updates

The backend uses Server-Sent Events (SSE) to push real-time updates to the frontend:
- Test run created/updated events on the `test-runs` channel
- The frontend subscribes via a `useSSE` hook for live status updates on the test runs listing page

### 3.4 Result Document Generator (FR-4)

#### 3.4.1 Result Document Structure

```
Test Run Report
├── Summary
│   ├── Test Case Name
│   ├── Status (Passed / Failed)
│   ├── Execution Date & Time
│   ├── Duration
│   └── Environment (Browser, URL)
├── Test Description
│   ├── Description text
│   ├── Preconditions
│   └── Passing Criteria
├── Step Results (for each step)
│   ├── Step Number
│   ├── Action (block type + description)
│   ├── Target (selector or URL)
│   ├── Expected Result
│   ├── Actual Result
│   ├── Status (Pass / Fail / Skipped)
│   ├── Screenshot (embedded image)
│   ├── Duration
│   └── Error Message (if failed)
└── Overall Result
    ├── Total Steps / Passed / Failed
    └── Conclusion
```

#### 3.4.2 Export Implementations

| Format | Library | Notes |
|--------|---------|-------|
| JSON | Built-in | Full structured data including base64 screenshot references |
| DOCX | docx (npm) | Formatted Word document with embedded screenshot images |
| PDF | puppeteer / pdfkit | Rendered PDF with layout matching the DOCX format |

### 3.5 Test Case Management Page (FR-3.1, FR-7)

#### 3.5.1 PoC Scope

- **List view** of all test cases with columns: Name, Status, Last Run, Tags
- **Select** test cases via checkboxes for batch execution
- **Filter** by status (draft, passed, failed, not run)
- **Search** by name or description
- **Actions**: Edit (opens flow editor), Run, Delete, Export

#### 3.5.2 Production Scope — Project Management (FR-7)

##### 3.5.2.1 Project Listing & Navigation

- **Project listing page** shows all projects as cards or rows with name, description, test case count, and progress summary
- Clicking a project opens the **Project Detail page**, which lists the test cases belonging to that project
- Sidebar or breadcrumbs show the current project context

##### 3.5.2.2 Test Case Grouping

On the Project Detail page, a **grouping toggle bar** at the top allows the user to switch between grouping modes:

| Mode | Button Label | Behavior |
|------|-------------|----------|
| By Feature | "Feature" | Test cases grouped under collapsible feature headers |
| By Phase | "Phase" | Test cases grouped under collapsible phase headers |
| Feature → Phase | "Feature → Phase" | Two-level hierarchy: feature sections containing phase sub-sections |
| Phase → Feature | "Phase → Feature" | Two-level hierarchy: phase sections containing feature sub-sections |

- Each grouping mode renders collapsible sections with headers showing the group name and test case count
- Ungrouped test cases (no feature/phase assigned) appear under an "Unassigned" section
- The active grouping mode is indicated by a highlighted/active button state
- Grouping preference is persisted per user (local storage or user settings)

##### 3.5.2.3 Test Case Visibility Toggle

- Each group header (Feature or Phase) includes an **eye icon toggle** to show/hide the test cases within that group
- When a group is hidden:
  - Its test cases are collapsed and visually dimmed or fully hidden from the list
  - The group header remains visible with a strikethrough or muted style, showing "N hidden"
  - Hidden test cases are excluded from bulk actions (run, export) unless explicitly included
- Visibility state is persisted per user per project
- A "Show All / Hide All" toggle at the top resets visibility for all groups

##### 3.5.2.4 Test Case Overview Page

Each test case has a dedicated **Overview page** accessible by clicking the test case name from any list. The overview contains:

| Section | Content |
|---------|---------|
| **Header** | Test case name (editable inline), status badge, assigned users avatars |
| **Description** | Rich text description with edit capability |
| **Details** | Preconditions, passing criteria, tags, project, feature, phase |
| **Comments** | Threaded comment section with reply support (see §3.5.2.7) |
| **Flow Preview** | A read-only miniature rendering of the test flow canvas. Clicking the preview navigates to the full flow editor page (`/test-cases/[id]/editor`) |
| **Assignment** | List of assigned users with ability to add/remove |
| **History** | Recent test run results for this test case (last 5 runs with status and date) |

##### 3.5.2.5 User Assignment

- Each test case can be **assigned to one or more users**
- On the test case overview page, an "Assignees" section shows user avatars; clicking "+" opens a user picker dropdown
- **Bulk assignment from the list view**:
  1. User selects multiple test cases via checkboxes
  2. A batch action bar appears with an "Assign" button
  3. Clicking "Assign" opens a dialog with a multi-select user picker
  4. Confirming assignment applies the selected users to all checked test cases
- Assigned users are shown as avatars/initials in the test case list rows
- Test cases can be filtered by assignee

##### 3.5.2.6 Bulk Operations

- **Batch action bar** appears when one or more test cases are selected via checkboxes
- Available bulk actions: Run Selected, Assign, Move to Feature/Phase, Delete, Export
- Bulk assign opens a user picker dialog (see §3.5.2.5)
- Bulk move opens a feature/phase picker dialog

##### 3.5.2.7 Comment Threads

- Each test case overview page has a **Comments** section at the bottom
- Comments support threaded replies (one level of nesting)
- Each comment shows: author name/avatar, timestamp, message text
- Users can edit or delete their own comments
- Comments are ordered chronologically (newest at bottom)

##### 3.5.2.8 Activity Feed

- **Activity feed** showing recent changes across the project (test case created, updated, assigned, commented, run)

### 3.6 Extension Setup Page (FR-8)

The setup page provides a guided onboarding experience for users who need to install and configure the browser extension.

#### 3.6.1 Page Layout

The page is structured as a **step-by-step wizard** with the following steps:

| Step | Title | Content |
|------|-------|---------|
| 1 | **Download Extension** | A download button/link to obtain the extension package (`.zip` or direct folder). Includes brief description of what the extension does. |
| 2 | **Load Extension in Browser** | Step-by-step instructions with screenshots/illustrations for loading the extension: |
| | | 1. Open Chrome/Edge and navigate to `chrome://extensions` (or `edge://extensions`) |
| | | 2. Enable "Developer mode" toggle in the top-right corner |
| | | 3. Click "Load unpacked" button |
| | | 4. Select the extracted extension folder |
| | | 5. Verify the extension appears in the extensions list |
| 3 | **Copy Extension ID** | Instructions to locate the extension ID on the extensions page (shown below the extension name in developer mode). Highlight where the ID appears with an annotated screenshot. |
| 4 | **Configure in Settings** | An embedded extension ID input field (same as the Settings page). User enters the ID and clicks "Save". A "Test Connection" button verifies the extension is reachable and shows a success/failure indicator. |

#### 3.6.2 UX Details

- Each step has a **completion indicator** (checkmark) that activates when the step is done (e.g., ID saved, connection tested)
- The page is accessible from the sidebar navigation and also shown as a prompt when the extension is not connected (e.g., on first visit or when connection test fails)
- A "Skip Setup" link allows experienced users to bypass the wizard
- The download button should serve the extension files bundled from the `/extension` directory or link to an internal distribution URL

---

## 4. UI Screen Descriptions

### 4.1 Dashboard
- Welcome header with quick stats cards (total test cases, total test runs, passed, failed) with muted labels
- Quick action cards: "Import Tests", "Generate with AI", "Create New Test"
- Recent test runs table with status badges
- Recent test cases list with status and last run info

### 4.2 Test Case List
- Table with sortable columns: Name, Project, Status, Last Run Date, Tags, Assignees
- Top bar with search input, filter dropdowns, and "New Test Case" button
- Checkbox column for batch selection
- Batch action bar (Run Selected, Assign, Delete, Export)

### 4.2A Project Listing Page
- Grid or list of project cards showing: project name, description, test case count, pass/fail summary
- "Create Project" button
- Search/filter bar for projects
- Clicking a project navigates to the Project Detail page

### 4.2B Project Detail Page
- Breadcrumb: Projects > [Project Name]
- **Grouping toggle bar** at the top with four buttons: Feature, Phase, Feature→Phase, Phase→Feature
- Active grouping button is highlighted
- Each group rendered as a collapsible section with header: group name, test case count, eye icon (visibility toggle)
- Within each group: test case rows with columns: checkbox, Name, Status, Last Run, Assignees (avatars)
- Batch action bar when checkboxes selected: Run, Assign, Move, Delete, Export
- "Show All / Hide All" visibility toggle button
- Hidden groups appear dimmed with "N hidden" label

### 4.2C Test Case Overview Page
- Header: test case name (editable), status badge, assignee avatars with "+" button to add
- Description section (editable rich text)
- Details card: preconditions, passing criteria, tags, project, feature, phase
- **Flow Preview**: a read-only miniature canvas rendering of the test flow; clickable — navigates to `/test-cases/[id]/editor`
- Comments section: threaded comments with reply, edit, delete, author avatar, timestamp
- History section: last 5 test runs for this case with status badge and date

### 4.3 Visual Flow Editor
- **Left panel**: Block palette organized by category (Control, Action, Validation, Capture)
- **Center**: React Flow canvas with blocks and edges
- **Right panel**: Block properties form (shown when a block is selected)
- **Top bar**: Test case name, Save button (hidden when no changes), Export dropdown, Run button
- **Collapsible metadata panel**: Description, preconditions, passing criteria, tags (editable inline)
- **Bottom bar**: Minimap, zoom controls
- **Dirty-state tracking**: Save button appears only when changes detected via snapshot comparison

### 4.4 Execution Monitor
- **Left**: Read-only flow view with real-time block status highlighting
- **Right**: Step log with screenshots, timestamps, and status badges
- **Top bar**: Test case name, progress indicator, Stop button
- **Bottom**: Summary stats (completed, passed, failed, running)

### 4.5 Test Results Page
- List of past test runs with search bar (filter by test case name or status)
- Each row shows: test name, date, duration, pass/fail badge, step count
- Expandable/collapsible rows with chevron icon — lazy-loads step details inline
- Checkbox multi-select with bulk action bar: Re-run, Export (JSON/DOCX/PDF)
- Per-row actions: Re-run button, Export dropdown
- Export button per run (JSON, DOCX, PDF)

### 4.6 Test Result Detail
- Summary stat cards: Status, Steps (passed/total), Duration, Date
- Case Info card with test case name, ID (linked to editor), description, preconditions, passing criteria
- Step Results table with expandable rows — each row shows: step #, action/block type, status badge, duration, screenshot
- Expanded step row shows: target/selector, expected result, actual result, error message, full screenshot
- Re-run button and Export dropdown in page header

### 4.7 Settings Page
- Extension ID input field with Save button
- Connection status indicator (connected/disconnected) with "Test Connection" button
- Backend API URL configuration

### 4.8 Extension Setup Page
- Step-by-step wizard layout with numbered steps and completion indicators
- **Step 1 — Download**: Download button for the extension package with brief description
- **Step 2 — Load Extension**: Numbered instructions with illustrations for enabling developer mode, clicking "Load unpacked", and selecting the extension folder
- **Step 3 — Copy Extension ID**: Annotated guidance showing where to find the extension ID on the `chrome://extensions` page
- **Step 4 — Configure**: Embedded extension ID input field, Save button, and "Test Connection" button with success/failure indicator
- "Skip Setup" link for experienced users
- Accessible from sidebar and shown as a prompt when extension is not connected

### 4.9 AI Generation Page Enhancements
- Three input tabs: Natural Language, Requirements Document, Source Code
- **Target URL field** on all tabs with auto-format on blur (prepends `https://` if missing)
- **Natural Language tab**: URL auto-inference from text input (debounced 600ms)
- **Infer URL button**: Manual trigger to extract URL from text when auto-inference doesn't fire
- **Page scraping**: When extension is connected and target URL is provided, scrapes the target page HTML to provide context for AI generation
- **Navigation refinement**: After initial generation, identifies navigation URLs in generated test cases and scrapes those pages to refine the test steps with real page structure

---

## 5. Edge Cases & Error Handling

| Scenario | Handling |
|----------|---------|
| Uploaded file is corrupted or unreadable | Show error toast with specific message; don't partially import |
| Uploaded file exceeds 20MB size limit | Reject with file size error before upload |
| AI generation returns malformed response | Retry once; if still malformed, show error with option to retry or enter manually |
| Browser extension is not installed | Show install prompt with link to extension store |
| Browser extension disconnects mid-test | Halt execution, mark remaining steps as "Skipped", save partial results |
| Target element not found (CSS selector) | Mark step as failed with "Element not found" error, capture screenshot, halt flow |
| Navigation timeout | Mark step as failed with "Navigation timeout" error after 30s default |
| Multiple Start blocks in flow | Validation error preventing save/run |
| Disconnected blocks in flow | Validation warning; disconnected blocks are skipped during execution |
| Network error during test execution | Retry step once; if still failing, mark as failed with network error |
| Concurrent edits to same test case (Production) | Last-write-wins with conflict notification |
