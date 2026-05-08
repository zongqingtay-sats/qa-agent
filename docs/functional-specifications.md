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

#### 3.2.5 Export Formats

- **JSON** — Full test flow data including block positions, edges, and properties
- **DOCX** — Formatted document with test case name, description, numbered steps, and passing criteria
- **PDF** — Same content as DOCX rendered as PDF

### 3.3 Test Execution Engine (FR-3)

#### 3.3.1 Browser Extension Architecture

The browser extension (Chrome/Edge, Manifest V3) consists of:
- **Popup UI** — Shows connection status and current execution state
- **Background Service Worker** — Receives test flows from the web app, orchestrates step execution
- **Content Script** — Injected into the target page, performs DOM interactions (click, type, assert)

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
| `STEP_START` | Extension → Web App | `{ type: "STEP_START", stepId, blockType }` |
| `STEP_COMPLETE` | Extension → Web App | `{ type: "STEP_COMPLETE", stepId, screenshot, duration }` |
| `STEP_ERROR` | Extension → Web App | `{ type: "STEP_ERROR", stepId, error, screenshot }` |
| `TEST_COMPLETE` | Extension → Web App | `{ type: "TEST_COMPLETE", results }` |

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

#### 3.5.2 Production Scope (FR-7)

- **Project/Feature/Phase hierarchy** in left sidebar tree
- **Board (Kanban) view** with columns for test case status
- **Bulk operations**: move to project, assign, delete
- **Comment/reply threads** on each test case detail view
- **Activity feed** showing recent changes

---

## 4. UI Screen Descriptions

### 4.1 Dashboard
- Welcome header with quick stats (total test cases, recent runs, pass rate)
- Quick action cards: "Import Tests", "Generate with AI", "Create New Test"
- Recent test runs table with status
- Recent test cases list

### 4.2 Test Case List
- Table with sortable columns: Name, Project, Status, Last Run Date, Tags
- Top bar with search input, filter dropdowns, and "New Test Case" button
- Checkbox column for batch selection
- Batch action bar (Run Selected, Delete, Export)

### 4.3 Visual Flow Editor
- **Left panel**: Block palette organized by category (Control, Action, Validation, Capture)
- **Center**: React Flow canvas with blocks and edges
- **Right panel**: Block properties form (shown when a block is selected)
- **Top bar**: Test case name, Validate button, Save button, Export dropdown, Run button
- **Bottom bar**: Minimap, zoom controls, undo/redo

### 4.4 Execution Monitor
- **Left**: Read-only flow view with real-time block status highlighting
- **Right**: Step log with screenshots, timestamps, and status badges
- **Top bar**: Test case name, progress indicator, Stop button
- **Bottom**: Summary stats (completed, passed, failed, running)

### 4.5 Test Results Page
- List of past test runs with filter by date/status
- Each row shows: test name, date, duration, pass/fail badge, step count
- Click to expand/view detailed step results
- Export button per run (JSON, DOCX, PDF)

### 4.6 Test Result Detail
- Summary card with pass/fail status, duration, environment info
- Tabbed view: "Steps" (step-by-step table with screenshots) and "Flow" (visual flow with status colors)
- Each step row: step #, action, target, expected, actual, screenshot thumbnail (click to enlarge), status
- Export button

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
