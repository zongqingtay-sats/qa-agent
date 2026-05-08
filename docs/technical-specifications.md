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
| **Express.js Backend** | REST API, document parsing, AI integration, export generation, data persistence |
| **Browser Extension** | DOM interaction on target apps, screenshot capture, step execution |
| **Azure SQL Server** | Persistent storage for test cases, runs, results, users, projects |
| **Azure Blob Storage** | Screenshot image storage (Production) |
| **GitHub Copilot Chat API** | AI-powered test case generation and requirement analysis |

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
│   │   ├── layout.tsx              # Root layout
│   │   ├── page.tsx                # Dashboard
│   │   ├── test-cases/
│   │   │   ├── page.tsx            # Test case list
│   │   │   └── [id]/
│   │   │       ├── page.tsx        # Test case detail (redirects to editor)
│   │   │       └── editor/
│   │   │           └── page.tsx    # Visual flow editor
│   │   ├── test-runs/
│   │   │   ├── page.tsx            # Test run history
│   │   │   └── [id]/
│   │   │       └── page.tsx        # Test run result detail
│   │   ├── import/
│   │   │   └── page.tsx            # Import test cases
│   │   └── generate/
│   │       └── page.tsx            # AI generate test cases
│   ├── components/
│   │   ├── ui/                     # shadcn/ui components
│   │   ├── layout/
│   │   │   ├── sidebar.tsx         # App sidebar navigation
│   │   │   ├── header.tsx          # Top header bar
│   │   │   └── app-shell.tsx       # Main layout wrapper
│   │   ├── flow-editor/
│   │   │   ├── flow-canvas.tsx     # React Flow canvas wrapper
│   │   │   ├── block-palette.tsx   # Draggable block types panel
│   │   │   ├── block-properties.tsx # Right panel: selected block config
│   │   │   ├── nodes/             # Custom React Flow node components
│   │   │   │   ├── start-node.tsx
│   │   │   │   ├── end-node.tsx
│   │   │   │   ├── action-node.tsx
│   │   │   │   ├── assert-node.tsx
│   │   │   │   ├── condition-node.tsx
│   │   │   │   └── wait-node.tsx
│   │   │   └── edges/
│   │   │       └── custom-edge.tsx
│   │   ├── test-cases/
│   │   │   ├── test-case-table.tsx
│   │   │   ├── test-case-row.tsx
│   │   │   └── test-case-filters.tsx
│   │   ├── execution/
│   │   │   ├── execution-monitor.tsx
│   │   │   ├── step-log.tsx
│   │   │   └── extension-status.tsx
│   │   └── results/
│   │       ├── result-summary.tsx
│   │       ├── step-result-table.tsx
│   │       └── screenshot-viewer.tsx
│   ├── lib/
│   │   ├── api.ts                  # API client (fetch wrapper)
│   │   ├── extension.ts            # Browser extension communication
│   │   ├── store.ts                # Zustand stores
│   │   └── utils.ts                # Utility functions
│   └── types/
│       └── index.ts                # Shared TypeScript types
├── public/
├── tailwind.config.ts
├── next.config.ts
├── tsconfig.json
└── package.json
```

### 2.3 State Management (Zustand)

```typescript
// Key stores:

interface FlowEditorStore {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  addNode: (type: BlockType, position: XYPosition) => void;
  updateNode: (id: string, data: Partial<BlockData>) => void;
  deleteNode: (id: string) => void;
  setSelectedNode: (id: string | null) => void;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  validate: () => ValidationResult;
  toTestFlow: () => TestFlow;
  fromTestFlow: (flow: TestFlow) => void;
}

interface ExecutionStore {
  status: 'idle' | 'connecting' | 'running' | 'completed' | 'error';
  currentStepId: string | null;
  stepResults: StepResult[];
  extensionConnected: boolean;
  startExecution: (testFlow: TestFlow) => void;
  handleStepComplete: (result: StepResult) => void;
  handleStepError: (error: StepError) => void;
  stopExecution: () => void;
}
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
│   ├── index.ts                    # Express app entry point
│   ├── config/
│   │   └── index.ts                # Environment configuration
│   ├── routes/
│   │   ├── testCases.ts            # /api/test-cases
│   │   ├── testRuns.ts             # /api/test-runs
│   │   ├── import.ts               # /api/import
│   │   ├── generate.ts             # /api/generate
│   │   └── export.ts               # /api/export
│   ├── controllers/
│   │   ├── testCaseController.ts
│   │   ├── testRunController.ts
│   │   ├── importController.ts
│   │   ├── generateController.ts
│   │   └── exportController.ts
│   ├── services/
│   │   ├── testCaseService.ts
│   │   ├── testRunService.ts
│   │   ├── importService.ts        # Document parsing logic
│   │   ├── aiService.ts            # Copilot Chat API integration
│   │   ├── exportService.ts        # JSON/DOCX/PDF generation
│   │   └── dbService.ts            # Database operations
│   ├── middleware/
│   │   ├── errorHandler.ts
│   │   ├── validate.ts             # Zod validation middleware
│   │   └── upload.ts               # Multer file upload config
│   ├── db/
│   │   ├── connection.ts           # SQL Server connection pool
│   │   ├── schema.sql              # Database schema DDL
│   │   └── queries.ts              # Parameterized queries
│   └── types/
│       └── index.ts                # Backend-specific types
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

---

## 4. Browser Extension

### 4.1 Project Structure

```
extension/
├── manifest.json                   # Manifest V3
├── src/
│   ├── background/
│   │   └── service-worker.ts       # Background service worker
│   ├── content/
│   │   └── content-script.ts       # Injected into target pages
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.ts
│   │   └── popup.css
│   └── types/
│       └── messages.ts             # Message type definitions
├── icons/
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
├── tsconfig.json
├── webpack.config.js               # Bundle for extension
└── package.json
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
    "service_worker": "background/service-worker.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content/content-script.js"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "popup/popup.html",
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

-- Production-only tables (FR-5, FR-6, FR-7)
-- Users, Projects, Features, Phases, Comments, Permissions
-- (Defined during Production phase)
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
