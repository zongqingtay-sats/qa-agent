# Technical Specifications — QA Agent

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Azure App Service                         │
│  ┌───────────────────────┐    ┌──────────────────────────────┐  │
│  │   Next.js Frontend    │    │    Express.js Backend API     │  │
│  │   (App Router, SSR)   │───▶│    (REST API, Port 4000)     │  │
│  │   Port 3000           │    │                              │  │
│  └───────────────────────┘    └──────────┬───────────────────┘  │
│                                          │                       │
└──────────────────────────────────────────┼───────────────────────┘
           │                               │
           │ chrome.runtime                │ SQL / HTTP
           │ messaging                     │
┌──────────▼──────────┐          ┌─────────▼──────────────────┐
│  Browser Extension   │          │     Azure SQL Server        │
│  (Manifest V3)       │          │     Azure Blob Storage      │
│  - Background SW     │          └────────────────────────────┘
│  - Content Script    │                     │
│  - Popup UI          │          ┌──────────▼─────────────────┐
└─────────────────────┘          │  GitHub Copilot Chat API    │
                                  └────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility |
|-----------|---------------|
| **Next.js Frontend** | UI rendering, routing, state management, flow editor, result viewer |
| **Express.js Backend** | REST API, SSE real-time updates, document parsing, AI integration, export generation, data persistence |
| **Browser Extension** | DOM interaction on target apps, screenshot capture, step execution, page scraping, pause/resume/retry/skip |
| **Shared Package** | Shared TypeScript types and utilities between frontend and backend |
| **Azure SQL Server** | Persistent storage for test cases, runs, results, users, projects (Production) |
| **Azure Blob Storage** | Screenshot image storage (Production) |
| **GitHub Copilot Chat API** | AI-powered test case generation and requirement analysis |

### 1.1 Monorepo Structure

The project uses a monorepo with npm workspaces:

```
qa-agent/
├── package.json              # Root workspace config
├── frontend/                 # Next.js 15 frontend
├── backend/                  # Express.js 5 backend
├── extension/                # Chrome/Edge extension (vanilla JS, Manifest V3)
├── shared/                   # Shared types and utilities
└── docs/                     # Specification documents
```

---

## 2. Frontend Architecture

### 2.1 Technology Stack

| Library | Version | Purpose |
|---------|---------|---------|
| Next.js | 15.x | App framework (App Router) |
| React | 19.x | UI rendering |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 4.x | Utility-first styling |
| shadcn/ui | latest | Component library |
| @xyflow/react | 12.x | Visual flow editor canvas |
| zustand | 5.x | Global state management |
| lucide-react | latest | Icons |
| react-dropzone | latest | File upload |
| sonner | latest | Toast notifications |

### 2.2 Project Structure

```
frontend/
├── src/
│   ├── app/                        # Next.js App Router pages
│   │   ├── layout.tsx              # Root layout with sidebar
│   │   ├── page.tsx                # Dashboard (redirects to dashboard-page)
│   │   ├── dashboard-page.tsx      # Dashboard with stats, quick actions, recent items
│   │   ├── test-cases/
│   │   │   ├── page.tsx            # Test case list with search, filters, batch actions
│   │   │   └── [id]/
│   │   │       ├── page.tsx        # Test case overview (name, description, comments, flow preview)
│   │   │       └── editor/
│   │   │           └── page.tsx    # Visual flow editor with metadata panel
│   │   ├── test-runs/
│   │   │   ├── page.tsx            # Test run history with search, expandable rows
│   │   │   └── [id]/
│   │   │       └── page.tsx        # Test run detail with expandable steps, case info
│   │   ├── projects/
│   │   │   ├── page.tsx            # Project listing (cards/rows with summary)
│   │   │   └── [id]/
│   │   │       └── page.tsx        # Project detail with grouped test cases, grouping toggle, visibility toggle
│   │   ├── import/
│   │   │   └── page.tsx            # Import test cases from files
│   │   ├── generate/
│   │   │   └── page.tsx            # AI generate (natural language, document, source)
│   │   ├── setup/
│   │   │   └── page.tsx            # Extension setup wizard (download, load, configure)
│   │   └── settings/
│   │       └── page.tsx            # Extension ID config, connection test
│   ├── components/
│   │   ├── ui/                     # shadcn/ui components (button, card, table, etc.)
│   │   ├── layout/
│   │   │   ├── app-sidebar.tsx     # App sidebar navigation with FlaskConical icon
│   │   │   └── page-header.tsx     # Reusable page header with actions slot
│   ├── hooks/
│   │   ├── use-mobile.ts          # Mobile detection hook
│   │   └── use-sse.ts             # Server-Sent Events hook for real-time updates
│   ├── lib/
│   │   ├── api.ts                  # API client (fetch wrapper for all endpoints)
│   │   ├── extension.ts            # Browser extension communication (ping, scrape, connect)
│   │   ├── run-test.ts             # Test execution orchestration
│   │   ├── store.ts                # Client-side storage utilities
│   │   └── utils.ts                # Utility functions (cn, etc.)
├── public/
├── next.config.ts
├── tsconfig.json
└── package.json
```

### 2.3 State Management

The PoC uses React component-level state (`useState`, `useRef`) and local storage rather than a global store (Zustand). Key patterns:

- **Flow editor state**: `useNodesState` / `useEdgesState` from `@xyflow/react` for nodes and edges
- **Dirty-state tracking**: `initialSnapshot` ref compared to current state to show/hide save button
- **Real-time updates**: `useSSE` custom hook subscribes to SSE channels for live test run updates
- **Extension communication**: `lib/extension.ts` manages extension ID in local storage, provides `pingExtension()`, `scrapePageViaExtension()`, `pickElementViaExtension()`, `listTabsViaExtension()`, and connection utilities

### 2.4 Flow Editor Architecture

The flow editor (`test-cases/[id]/editor/`) is modularized into:

```
editor/
├── page.tsx                    # Page component (loads test case, renders editor)
├── _hooks/
│   └── use-flow-editor.ts     # Main editor hook (~670 lines)
├── _components/
│   ├── editor-toolbar.tsx      # Toolbar (save, export, run, undo/redo buttons)
│   ├── flow-block-node.tsx     # Custom node component with execution highlights
│   ├── block-palette.tsx       # Left panel with draggable block types
│   ├── block-properties-panel.tsx  # Right panel with property form + element picker
│   ├── metadata-panel.tsx      # Collapsible metadata (description, preconditions, tags)
│   └── last-run-panel.tsx      # Collapsible last run status + step detail
├── _lib/
│   └── flow-validation.ts     # Validation rules (9 rules, errors + warnings)
```

**`use-flow-editor` hook manages:**
- Undo/redo stacks (50-entry cap, 300ms debounce for drag grouping)
- Clipboard (copy/cut/paste with `executionStatus` stripping)
- Keyboard shortcuts (Ctrl+Z/Y/C/X/V/S)
- Single-edge-per-handle validation in `onConnect`
- Last run loading on mount with node execution status highlighting
- Dirty-state comparison via JSON snapshot
```

---

## 3. Backend Architecture

### 3.1 Technology Stack

| Library | Version | Purpose |
|---------|---------|---------|
| Express.js | 5.x | HTTP server framework |
| TypeScript | 5.x | Type safety |
| mssql | latest | Azure SQL Server client |
| mammoth | latest | Word document parsing |
| pdf-parse | latest | PDF text extraction |
| docx | latest | Word document generation |
| pdfkit | latest | PDF generation |
| multer | latest | File upload handling |
| zod | latest | Request validation |
| cors | latest | CORS middleware |
| helmet | latest | Security headers |
| uuid | latest | ID generation |

### 3.2 Project Structure

```
backend/
├── src/
│   ├── index.ts                    # Express app entry point with SSE support
│   ├── config/
│   │   └── index.ts                # Environment configuration
│   ├── routes/
│   │   ├── test-cases.ts           # /api/test-cases
│   │   ├── test-runs.ts            # /api/test-runs
│   │   ├── import.ts               # /api/import
│   │   ├── generate.ts             # /api/generate
│   │   └── export.ts               # /api/export
│   ├── services/
│   │   ├── ai-service.ts           # Copilot Chat API integration
│   │   ├── import-service.ts       # Document parsing (docx, pdf, txt, json)
│   │   └── export-service.ts       # JSON/DOCX/PDF generation (Aptos font)
│   ├── middleware/
│   │   ├── error-handler.ts        # Global error handling
│   │   └── upload.ts               # Multer file upload config
│   ├── db/
│   │   └── store.ts                # In-memory data store (PoC)
│   ├── copilot/
│   │   ├── client.ts               # Copilot API client
│   │   └── types.ts                # Copilot type definitions
├── scripts/
│   └── copilot/                    # Copilot integration utility scripts
├── tsconfig.json
└── package.json
```

### 3.3 API Endpoints

#### Test Cases

| Method | Endpoint | Description | Request Body |
|--------|----------|-------------|-------------|
| GET | `/api/test-cases` | List all test cases | Query: `?status=&search=&page=&limit=` |
| GET | `/api/test-cases/:id` | Get test case by ID | — |
| POST | `/api/test-cases` | Create a new test case | `{ name, description, passingCriteria, flow }` |
| PUT | `/api/test-cases/:id` | Update a test case | `{ name, description, passingCriteria, flow }` |
| DELETE | `/api/test-cases/:id` | Delete a test case | — |

#### Test Runs

| Method | Endpoint | Description | Request Body |
|--------|----------|-------------|-------------|
| GET | `/api/test-runs` | List all test runs | Query: `?testCaseId=&status=&page=&limit=` |
| GET | `/api/test-runs/:id` | Get test run detail with step results | — |
| POST | `/api/test-runs` | Create a new test run (record start) | `{ testCaseId }` |
| PUT | `/api/test-runs/:id` | Update test run (record results) | `{ status, stepResults }` |

#### Import

| Method | Endpoint | Description | Request Body |
|--------|----------|-------------|-------------|
| POST | `/api/import/parse` | Upload and parse a document | `multipart/form-data: file` |
| POST | `/api/import/confirm` | Confirm and save parsed test cases | `{ testCases: TestCase[] }` |

#### Generate

| Method | Endpoint | Description | Request Body |
|--------|----------|-------------|-------------|
| POST | `/api/generate/from-requirements` | Generate from requirements doc | `multipart/form-data: file` |
| POST | `/api/generate/from-text` | Generate from natural language | `{ text: string }` |
| POST | `/api/generate/from-source` | Generate from source code | `multipart/form-data: files[]` |

#### Export

| Method | Endpoint | Description | Request Body |
|--------|----------|-------------|-------------|
| POST | `/api/export/test-case/:id` | Export test case flow | `{ format: "json" \| "docx" \| "pdf" }` |
| POST | `/api/export/test-run/:id` | Export test run results | `{ format: "json" \| "docx" \| "pdf" }` |

#### Projects (Production — FR-7)

| Method | Endpoint | Description | Request Body |
|--------|----------|-------------|-------------|
| GET | `/api/projects` | List all projects | Query: `?search=&page=&limit=` |
| GET | `/api/projects/:id` | Get project detail with features and phases | — |
| POST | `/api/projects` | Create a new project | `{ name, description }` |
| PUT | `/api/projects/:id` | Update project | `{ name, description }` |
| DELETE | `/api/projects/:id` | Delete project and cascade | — |
| GET | `/api/projects/:id/test-cases` | List test cases in a project | Query: `?groupBy=feature\|phase\|feature-phase\|phase-feature&search=&status=` |

#### Features & Phases (Production — FR-7)

| Method | Endpoint | Description | Request Body |
|--------|----------|-------------|-------------|
| GET | `/api/projects/:id/features` | List features in a project | — |
| POST | `/api/projects/:id/features` | Create a feature | `{ name }` |
| PUT | `/api/features/:id` | Update feature | `{ name, sortOrder }` |
| DELETE | `/api/features/:id` | Delete feature | — |
| GET | `/api/projects/:id/phases` | List phases in a project | — |
| POST | `/api/projects/:id/phases` | Create a phase | `{ name }` |
| PUT | `/api/phases/:id` | Update phase | `{ name, sortOrder }` |
| DELETE | `/api/phases/:id` | Delete phase | — |

#### Test Case Assignments (Production — FR-7)

| Method | Endpoint | Description | Request Body |
|--------|----------|-------------|-------------|
| GET | `/api/test-cases/:id/assignees` | List assigned users for a test case | — |
| POST | `/api/test-cases/:id/assignees` | Assign users to a test case | `{ userIds: string[] }` |
| DELETE | `/api/test-cases/:id/assignees/:userId` | Remove an assignee | — |
| POST | `/api/test-cases/bulk-assign` | Bulk assign users to multiple test cases | `{ testCaseIds: string[], userIds: string[] }` |

#### Comments (Production — FR-7)

| Method | Endpoint | Description | Request Body |
|--------|----------|-------------|-------------|
| GET | `/api/test-cases/:id/comments` | List comments for a test case | — |
| POST | `/api/test-cases/:id/comments` | Create a comment | `{ body, parentId? }` |
| PUT | `/api/comments/:id` | Edit a comment | `{ body }` |
| DELETE | `/api/comments/:id` | Delete a comment | — |

#### Group Visibility (Production — FR-7)

| Method | Endpoint | Description | Request Body |
|--------|----------|-------------|-------------|
| GET | `/api/projects/:id/visibility` | Get visibility preferences for current user | — |
| PUT | `/api/projects/:id/visibility` | Update visibility for a group | `{ groupType, groupId, isHidden }` |

#### Users (Production — FR-5)

| Method | Endpoint | Description | Request Body |
|--------|----------|-------------|-------------|
| GET | `/api/users` | List users | Query: `?search=` |
| GET | `/api/users/me` | Get current user | — |

---

## 4. Browser Extension

### 4.1 Project Structure

```
extension/
├── manifest.json                   # Manifest V3
├── background.js                   # Background service worker (pause/resume/retry/skip)
├── content-script.js               # Injected into target pages (DOM actions + page scraping)
├── popup.html                      # Popup UI with progress, controls
├── popup.js                        # Popup logic (status updates, pause/resume/retry/skip)
├── readme.md                       # Extension documentation
└── icons/
    ├── icon.svg                    # Source SVG (FlaskConical, black stroke, transparent bg)
    ├── icon-16.png                 # Generated from SVG
    ├── icon-48.png                 # Generated from SVG
    ├── icon-128.png                # Generated from SVG
    └── generate-icons.js           # SVG→PNG conversion script (uses sharp)
```

### 4.2 Manifest V3

```json
{
  "manifest_version": 3,
  "name": "QA Agent Test Runner",
  "version": "1.0.0",
  "description": "Execute automated QA tests on web applications",
  "permissions": [
    "activeTab",
    "scripting",
    "tabs"
  ],
  "host_permissions": ["<all_urls>"],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content-script.js"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon-16.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },
  "externally_connectable": {
    "matches": ["http://localhost:3000/*", "https://*.azurewebsites.net/*"]
  }
}
```

### 4.3 Communication Flow

```
Web App (Next.js)
    │
    │ chrome.runtime.sendMessage(extensionId, message)
    ▼
Background Service Worker
    │
    │ chrome.tabs.sendMessage(tabId, action)
    ▼
Content Script (on target page)
    │
    │ Execute DOM action
    │ Return result
    ▼
Background Service Worker
    │
    │ chrome.tabs.captureVisibleTab() → screenshot
    │ chrome.runtime.sendMessage() → back to web app
    ▼
Web App (receives step result + screenshot)
```

### 4.3A Additional Extension Messages (Element Picker)

| Message | Direction | Payload |
|---------|-----------|---------|
| `LIST_TABS` | Web App → Extension | `{ type: "LIST_TABS" }` |
| `OPEN_TAB` | Web App → Extension | `{ type: "OPEN_TAB", url }` |
| `PICK_ELEMENT` | Web App → Extension | `{ type: "PICK_ELEMENT", tabId }` |
| `ELEMENT_PICKED` | Extension → Web App | `{ type: "ELEMENT_PICKED", selector }` |

**Element Picker Content Script (`content/element-picker.js`):**
- Injected on demand into target tab via `chrome.scripting.executeScript`
- Creates a full-page overlay with blue outline highlight on hovered elements
- Displays a fixed banner ("Click an element to pick its selector — Esc to cancel")
- On click: builds an optimal CSS selector (priority: `data-testid` → `id` → unique class combination → `nth-of-type` path)
- Sends result back via `chrome.runtime.sendMessage`

### 4.3B Extension Project Structure (Updated)

```
extension/
├── manifest.json
├── background.js               # Main service worker (imports from background/)
├── background/
│   ├── messaging.js            # External message handlers (LIST_TABS, OPEN_TAB, PICK_ELEMENT, EXECUTE_TEST, etc.)
│   ├── execution.js            # Test execution orchestration
│   └── state.js                # Execution state management
├── content-script.js           # Main content script (DOM actions + scraping)
├── content/
│   └── element-picker.js       # Interactive element picker overlay
├── popup.html
├── popup.js
└── icons/
```

### 4.4 Content Script Actions

```typescript
// Action handlers in content script
const actionHandlers: Record<BlockType, (params: ActionParams) => Promise<ActionResult>> = {
  navigate: async ({ url }) => {
    window.location.href = url;
    return { success: true };
  },
  click: async ({ selector, clickType }) => {
    const el = document.querySelector(selector);
    if (!el) throw new Error(`Element not found: ${selector}`);
    if (clickType === 'double') {
      el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    } else {
      (el as HTMLElement).click();
    }
    return { success: true };
  },
  type: async ({ selector, value, clearFirst }) => {
    const el = document.querySelector(selector) as HTMLInputElement;
    if (!el) throw new Error(`Element not found: ${selector}`);
    if (clearFirst) el.value = '';
    el.focus();
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return { success: true };
  },
  assert: async ({ assertionType, selector, expected }) => {
    // ... assertion logic
  },
  wait: async ({ waitType, timeout, selector }) => {
    // ... wait logic
  },
  // ... other action handlers
};
```

---

## 5. Database Schema

### 5.1 PoC Schema (SQLite for local dev / Azure SQL for Production)

For PoC, the backend uses an in-memory store with the same data model, which can be migrated to Azure SQL for Production.

```sql
-- Test Cases
CREATE TABLE test_cases (
    id              NVARCHAR(36) PRIMARY KEY,     -- UUID
    name            NVARCHAR(255) NOT NULL,
    description     NVARCHAR(MAX),
    preconditions   NVARCHAR(MAX),
    passing_criteria NVARCHAR(MAX),
    tags            NVARCHAR(MAX),                 -- JSON array
    flow_data       NVARCHAR(MAX) NOT NULL,        -- JSON (nodes + edges)
    status          NVARCHAR(20) DEFAULT 'draft',  -- draft, active, archived
    created_at      DATETIME2 DEFAULT GETDATE(),
    updated_at      DATETIME2 DEFAULT GETDATE()
);

-- Test Runs
CREATE TABLE test_runs (
    id              NVARCHAR(36) PRIMARY KEY,
    test_case_id    NVARCHAR(36) NOT NULL REFERENCES test_cases(id),
    status          NVARCHAR(20) NOT NULL,          -- running, passed, failed, stopped
    started_at      DATETIME2 DEFAULT GETDATE(),
    completed_at    DATETIME2,
    duration_ms     INT,
    environment     NVARCHAR(MAX),                  -- JSON (browser, URL, etc.)
    total_steps     INT DEFAULT 0,
    passed_steps    INT DEFAULT 0,
    failed_steps    INT DEFAULT 0
);

-- Step Results
CREATE TABLE step_results (
    id              NVARCHAR(36) PRIMARY KEY,
    test_run_id     NVARCHAR(36) NOT NULL REFERENCES test_runs(id),
    step_order      INT NOT NULL,
    block_id        NVARCHAR(36) NOT NULL,           -- Reference to flow node ID
    block_type      NVARCHAR(50) NOT NULL,
    description     NVARCHAR(MAX),
    target          NVARCHAR(MAX),                   -- Selector or URL
    expected_result NVARCHAR(MAX),
    actual_result   NVARCHAR(MAX),
    status          NVARCHAR(20) NOT NULL,            -- passed, failed, skipped
    screenshot_url  NVARCHAR(MAX),                   -- Base64 data URL (PoC) or Blob URL (Prod)
    error_message   NVARCHAR(MAX),
    duration_ms     INT,
    executed_at     DATETIME2 DEFAULT GETDATE()
);

-- Production-only tables (FR-5, FR-6, FR-7, FR-8)

-- Users
CREATE TABLE users (
    id              NVARCHAR(36) PRIMARY KEY,     -- UUID
    email           NVARCHAR(255) NOT NULL UNIQUE,
    display_name    NVARCHAR(255) NOT NULL,
    avatar_url      NVARCHAR(MAX),
    role            NVARCHAR(20) DEFAULT 'tester', -- admin, manager, tester, viewer
    created_at      DATETIME2 DEFAULT GETDATE()
);

-- Projects
CREATE TABLE projects (
    id              NVARCHAR(36) PRIMARY KEY,
    name            NVARCHAR(255) NOT NULL,
    description     NVARCHAR(MAX),
    created_by      NVARCHAR(36) REFERENCES users(id),
    created_at      DATETIME2 DEFAULT GETDATE(),
    updated_at      DATETIME2 DEFAULT GETDATE()
);

-- Features
CREATE TABLE features (
    id              NVARCHAR(36) PRIMARY KEY,
    project_id      NVARCHAR(36) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name            NVARCHAR(255) NOT NULL,
    sort_order      INT DEFAULT 0,
    created_at      DATETIME2 DEFAULT GETDATE()
);

-- Phases
CREATE TABLE phases (
    id              NVARCHAR(36) PRIMARY KEY,
    project_id      NVARCHAR(36) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name            NVARCHAR(255) NOT NULL,
    sort_order      INT DEFAULT 0,
    created_at      DATETIME2 DEFAULT GETDATE()
);

-- Add project/feature/phase references to test_cases
ALTER TABLE test_cases ADD project_id   NVARCHAR(36) REFERENCES projects(id);
ALTER TABLE test_cases ADD feature_id   NVARCHAR(36) REFERENCES features(id);
ALTER TABLE test_cases ADD phase_id     NVARCHAR(36) REFERENCES phases(id);

-- Test Case Assignments (many-to-many: test_case ↔ user)
CREATE TABLE test_case_assignments (
    id              NVARCHAR(36) PRIMARY KEY,
    test_case_id    NVARCHAR(36) NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
    user_id         NVARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_at     DATETIME2 DEFAULT GETDATE(),
    assigned_by     NVARCHAR(36) REFERENCES users(id),
    UNIQUE (test_case_id, user_id)
);

-- Comments (threaded, one level of nesting)
CREATE TABLE comments (
    id              NVARCHAR(36) PRIMARY KEY,
    test_case_id    NVARCHAR(36) NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
    parent_id       NVARCHAR(36) REFERENCES comments(id),  -- NULL for top-level, set for replies
    author_id       NVARCHAR(36) NOT NULL REFERENCES users(id),
    body            NVARCHAR(MAX) NOT NULL,
    created_at      DATETIME2 DEFAULT GETDATE(),
    updated_at      DATETIME2 DEFAULT GETDATE()
);

-- Group Visibility Preferences (per user per project)
CREATE TABLE group_visibility (
    id              NVARCHAR(36) PRIMARY KEY,
    user_id         NVARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id      NVARCHAR(36) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    group_type      NVARCHAR(20) NOT NULL,          -- 'feature' or 'phase'
    group_id        NVARCHAR(36) NOT NULL,           -- feature_id or phase_id
    is_hidden       BIT DEFAULT 0,
    UNIQUE (user_id, project_id, group_type, group_id)
);

-- Project Permissions (RBAC per project)
CREATE TABLE project_permissions (
    id              NVARCHAR(36) PRIMARY KEY,
    project_id      NVARCHAR(36) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id         NVARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            NVARCHAR(20) NOT NULL,            -- admin, manager, tester, viewer
    UNIQUE (project_id, user_id)
);
```

### 5.2 PoC In-Memory Store

For PoC, the backend uses a simple in-memory data store (JSON objects) that mirrors the SQL schema above. This allows rapid development without database setup while maintaining the same data model.

---

## 6. AI Integration

### 6.1 GitHub Copilot Chat API

**Authentication:** GitHub token-based authentication.

**Integration Pattern:**
```typescript
interface AIGenerationRequest {
  mode: 'requirements' | 'natural-language' | 'source-code';
  input: string;  // Extracted text from document, user text, or source code
}

interface AIGenerationResponse {
  testCases: GeneratedTestCase[];
}
```

**Prompt Templates:**

1. **From Requirements:**
```
Analyze the following business requirements document and generate comprehensive test cases.
For each test case, provide:
- name: descriptive test case name
- description: what this test verifies
- preconditions: setup needed before the test
- passingCriteria: what determines pass/fail
- steps: array of test steps with action, target (CSS selector if applicable), value, and description

Requirements:
{input}

Return the test cases as a JSON array.
```

2. **From Natural Language:**
```
Based on the following description, generate detailed test cases for a web application.
Include both positive and negative test scenarios.

Description:
{input}

Return structured test cases as a JSON array with name, description, preconditions, passingCriteria, and steps.
```

3. **From Source Code:**
```
Analyze the following source code and generate test cases that cover the UI interactions, form submissions, navigation, and edge cases visible in the code.

Source Code:
{input}

Return structured test cases as a JSON array.
```

---

## 7. Document Parsing

### 7.1 Word Documents (.docx)

```typescript
import mammoth from 'mammoth';

async function parseDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}
```

### 7.2 PDF Documents

```typescript
import pdfParse from 'pdf-parse';

async function parsePdf(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer);
  return data.text;
}
```

### 7.3 Text Files
Direct `buffer.toString('utf-8')` conversion.

### 7.4 JSON Files
Parse with `JSON.parse()`, validate against test case schema using Zod.

---

## 8. Export & Report Generation

### 8.1 JSON Export

Direct serialization of test case or test run objects. Screenshots stored as base64 data URIs in PoC.

### 8.2 DOCX Export

```typescript
import { Document, Packer, Paragraph, TextRun, ImageRun, Table } from 'docx';

async function generateDocx(testRun: TestRunResult): Promise<Buffer> {
  const doc = new Document({
    sections: [{
      children: [
        // Title
        new Paragraph({ children: [new TextRun({ text: testRun.testCase.name, bold: true, size: 32 })] }),
        // Status
        new Paragraph({ children: [new TextRun({ text: `Status: ${testRun.status}` })] }),
        // Steps with screenshots
        ...testRun.stepResults.map(step => [
          new Paragraph({ children: [new TextRun({ text: `Step ${step.stepOrder}: ${step.description}` })] }),
          new Paragraph({ children: [new TextRun({ text: `Result: ${step.status}` })] }),
          // Screenshot image
          ...(step.screenshot ? [new Paragraph({ children: [new ImageRun({ data: step.screenshot, transformation: { width: 600, height: 400 } })] })] : []),
        ]).flat(),
      ]
    }]
  });
  return await Packer.toBuffer(doc);
}
```

### 8.3 PDF Export

```typescript
import PDFDocument from 'pdfkit';

function generatePdf(testRun: TestRunResult): Promise<Buffer> {
  return new Promise((resolve) => {
    const doc = new PDFDocument();
    const chunks: Buffer[] = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    doc.fontSize(20).text(testRun.testCase.name);
    doc.fontSize(12).text(`Status: ${testRun.status}`);
    // ... render steps and screenshots
    doc.end();
  });
}
```

---

## 9. Authentication & Authorization (Production)

### 9.1 Azure Entra ID Integration

- **Protocol:** OpenID Connect (OIDC) with Authorization Code Flow + PKCE
- **Library:** `@azure/msal-node` (backend), `@azure/msal-browser` (frontend)
- **Token handling:** JWT access tokens validated on every API request

### 9.2 RBAC Model

| Role | Create Tests | Edit Tests | Run Tests | View Results | Manage Users |
|------|-------------|-----------|-----------|-------------|-------------|
| Admin | Yes | Yes | Yes | Yes | Yes |
| Manager | Yes | Yes | Yes | Yes | No |
| Tester | Yes | Yes | Yes | Yes | No |
| Viewer | No | No | No | Yes | No |

Permissions are scoped per project.

---

## 10. Deployment

### 10.1 Azure App Service

- **Frontend:** Next.js deployed as Node.js web app
- **Backend:** Express.js deployed as separate Node.js web app (or same app with path-based routing)
- **Environment Variables:**
  - `DATABASE_URL` — Azure SQL connection string
  - `COPILOT_API_KEY` — GitHub Copilot Chat API key
  - `AZURE_TENANT_ID`, `AZURE_CLIENT_ID` — Azure Entra ID config
  - `BLOB_STORAGE_CONNECTION` — Azure Blob Storage connection string
  - `NODE_ENV` — production

### 10.2 Browser Extension

- Distributed via Chrome Web Store and/or Microsoft Edge Add-ons
- Version-locked to match the web app API version

---

## 11. Security Considerations

| Threat | Mitigation |
|--------|-----------|
| SQL Injection | Parameterized queries only (via mssql library); no string concatenation for SQL |
| XSS | React's default escaping; CSP headers via Helmet; sanitize AI-generated content before render |
| CSRF | SameSite cookies; CSRF token for state-changing requests |
| File Upload Attacks | Validate file type (magic bytes, not just extension); enforce 20MB limit; scan content |
| Insecure Direct Object Reference | Validate ownership/permissions on every resource access |
| Sensitive Data Exposure | No secrets in frontend; environment variables for all credentials; TLS everywhere |
| Broken Authentication (Prod) | Azure Entra ID SSO; JWT validation; token expiry |
| CORS | Whitelist allowed origins only (localhost:3000, production domain) |
| Command Injection | No shell execution of user input; use library APIs only |
| Rate Limiting | Apply rate limits on AI generation and file upload endpoints |

---

## 12. Testing Strategy

| Level | Tool | Scope |
|-------|------|-------|
| Unit Tests | Vitest | Services, utilities, data transformations |
| Component Tests | Vitest + React Testing Library | UI components, flow editor blocks |
| API Tests | Vitest + Supertest | Express.js route handlers |
| E2E Tests | Playwright | Full user flows (import → edit → run → results) |
| Extension Tests | Jest + Chrome Extension Testing | Content script actions, message passing |
