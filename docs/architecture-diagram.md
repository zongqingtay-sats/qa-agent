# Architecture Diagrams — QA Agent

## 1. High-Level System Architecture

```mermaid
graph TB
    subgraph Azure["Azure App Service"]
        subgraph Frontend["Next.js Frontend :3000"]
            AppRouter["App Router<br/>(SSR + CSR)"]
            NextAuth["NextAuth<br/>(Microsoft Entra ID)"]
            FlowEditor["Flow Editor<br/>(@xyflow/react)"]
            SSEHook["useSSE Hook"]
            ProxyMW["Proxy Middleware<br/>(Header Injection)"]
        end

        subgraph Backend["Express.js Backend :4000"]
            REST["REST API<br/>(Routes)"]
            SSE["SSE Server<br/>(EventBus)"]
            AuthMW["Auth Middleware<br/>(x-user-* headers)"]
            AIService["AI Service"]
            BlobService["Blob Storage Service"]
            ImportService["Import Service<br/>(DOCX/PDF/TXT)"]
            ExportService["Export Service<br/>(JSON/DOCX/PDF)"]
            RBAC["RBAC Middleware"]
        end
    end

    subgraph Extension["Browser Extension (Manifest V3)"]
        BgWorker["Background<br/>Service Worker"]
        ContentScript["Content Scripts<br/>(DOM Actions)"]
        Popup["Popup UI"]
    end

    subgraph ExternalServices["External Services"]
        EntraID["Microsoft<br/>Entra ID"]
        CopilotAPI["GitHub Copilot<br/>Chat API"]
        AzureSQL["Azure SQL<br/>Server"]
        AzureBlob["Azure Blob<br/>Storage"]
    end

    User((User)) -->|Browser| AppRouter
    User -->|Popup| Popup

    NextAuth <-->|OAuth 2.0| EntraID
    ProxyMW -->|x-user-* headers| REST
    AppRouter -->|HTTP/REST| REST
    SSEHook <-.->|SSE stream| SSE

    AppRouter <-->|chrome.runtime<br/>messaging| BgWorker
    BgWorker <-->|chrome.scripting| ContentScript
    ContentScript -->|DOM automation| TargetApp["Target Web App"]

    REST --> AuthMW --> RBAC
    AIService <-->|Streaming| CopilotAPI
    REST --> AIService
    REST --> ImportService
    REST --> ExportService
    BlobService <-->|Upload/Download| AzureBlob

    REST <-->|"Prisma ORM<br/>(MSSQL adapter)"| AzureSQL

    SSE -.->|Broadcast events| SSEHook

    classDef frontend fill:#3b82f6,stroke:#1d4ed8,color:#fff
    classDef backend fill:#10b981,stroke:#059669,color:#fff
    classDef extension fill:#f59e0b,stroke:#d97706,color:#fff
    classDef external fill:#8b5cf6,stroke:#7c3aed,color:#fff
    classDef user fill:#6b7280,stroke:#4b5563,color:#fff

    class AppRouter,NextAuth,FlowEditor,SSEHook,ProxyMW frontend
    class REST,SSE,AuthMW,AIService,BlobService,ImportService,ExportService,RBAC backend
    class BgWorker,ContentScript,Popup extension
    class EntraID,CopilotAPI,AzureSQL,AzureBlob external
    class User user
```

## 2. Test Execution Flow

```mermaid
sequenceDiagram
    actor User
    participant FE as Frontend<br/>(Next.js)
    participant BE as Backend<br/>(Express)
    participant EXT as Extension<br/>(Background SW)
    participant CS as Content Script
    participant APP as Target Web App
    participant DB as Azure SQL
    participant BLOB as Azure Blob

    User->>FE: Click "Run Test"
    FE->>BE: POST /api/test-runs (create)
    BE->>DB: INSERT TestRun
    DB-->>BE: TestRun ID
    BE-->>FE: TestRun record

    FE->>EXT: chrome.runtime.connect()
    FE->>EXT: EXECUTE_TEST {flowData, baseUrl}

    loop For each step (BFS order)
        EXT->>CS: EXECUTE_ACTION {blockType, selector, value}
        CS->>APP: DOM action (click/type/navigate/assert...)
        APP-->>CS: Result
        CS-->>EXT: Action result + screenshot (base64)
        EXT-->>FE: STEP_COMPLETE {stepId, status, screenshot}
        FE->>BE: POST /api/test-runs/{id}/steps
        BE->>BLOB: Upload screenshot
        BLOB-->>BE: Blob URL
        BE->>DB: INSERT StepResult
        BE-->>FE: StepResult
        BE--)FE: SSE: test-run:updated
    end

    EXT-->>FE: TEST_COMPLETE {status, stats}
    FE->>BE: PUT /api/test-runs/{id} (final status)
    BE->>DB: UPDATE TestRun
    BE-->>FE: Updated TestRun
    BE--)FE: SSE: test-run:completed
```

## 3. Authentication & Authorization Flow

```mermaid
sequenceDiagram
    actor User
    participant Browser
    participant FE as Next.js Frontend
    participant Auth as NextAuth
    participant Entra as Microsoft Entra ID
    participant Proxy as Proxy Middleware
    participant BE as Express Backend
    participant DB as Azure SQL

    User->>Browser: Visit /login
    Browser->>FE: GET /login
    FE->>Auth: signIn("microsoft-entra-id")
    Auth->>Entra: OAuth 2.0 redirect
    Entra-->>User: Login prompt
    User->>Entra: Credentials
    Entra-->>Auth: Authorization code
    Auth->>Entra: Exchange for tokens
    Entra-->>Auth: ID + Access token
    Auth->>DB: Check email allowlist
    DB-->>Auth: User exists? ✓
    Auth-->>Browser: Set JWT session cookie

    Note over Browser,BE: Subsequent API Requests

    Browser->>FE: Any page request
    FE->>Proxy: Middleware intercept
    Proxy->>Proxy: Extract session (JWT)
    Proxy->>BE: Request + x-user-id, x-user-email, x-user-name headers
    BE->>BE: Auth middleware populates req.user
    BE->>BE: RBAC middleware checks permissions
    BE-->>FE: API response
    FE-->>Browser: Rendered page
```

## 4. AI Test Case Generation Flow

```mermaid
sequenceDiagram
    actor User
    participant FE as Frontend
    participant BE as Backend
    participant AI as AI Service
    participant Copilot as GitHub Copilot API
    participant DB as Azure SQL

    User->>FE: Upload document / Enter text
    FE->>BE: POST /api/generate/{mode}
    Note right of FE: mode: fromRequirements,<br/>fromText, fromSource

    alt Import Document First
        FE->>BE: POST /api/import/parse (multipart)
        BE->>BE: Parse DOCX/PDF/TXT (mammoth/pdf-parse)
        BE-->>FE: Extracted text content
    end

    BE->>AI: generateTestCases(text, options)
    AI->>AI: Build system prompt + user prompt
    AI->>Copilot: POST /chat/completions (streaming)
    Copilot-->>AI: Streamed YAML response
    AI->>AI: Parse YAML → TestCase objects
    AI-->>BE: TestCase[] with FlowData
    BE->>DB: INSERT TestCases
    DB-->>BE: Created records
    BE-->>FE: TestCase[] response
    FE-->>User: Display generated test cases
```

## 5. Data Model (Entity Relationship)

```mermaid
erDiagram
    User ||--o{ Account : has
    User ||--o{ Session : has
    User ||--o{ TestCaseAssignment : assigned
    User ||--o{ Comment : authors
    User ||--o{ GroupVisibility : configures

    Project ||--o{ Feature : contains
    Project ||--o{ Phase : contains
    Project ||--o{ TestCase : groups
    Project ||--o{ GroupVisibility : has

    TestCase ||--o{ TestRun : executes
    TestCase ||--o{ TestCaseAssignment : has
    TestCase ||--o{ Comment : has
    TestCase }o--o{ Feature : "tagged via TestCaseFeature"
    TestCase }o--o{ Phase : "tagged via TestCasePhase"

    TestRun ||--o{ StepResult : contains

    Comment ||--o{ Comment : replies

    TestCase {
        string id PK
        string name
        string description
        string preconditions
        string passingCriteria
        json flowData
        string status "draft|active|archived"
        string projectId FK
    }

    TestRun {
        string id PK
        string testCaseId FK
        string status "running|passed|failed|stopped"
        string runBy
        datetime startedAt
        datetime completedAt
        int durationMs
        int totalSteps
        int passedSteps
        int failedSteps
        json environment
    }

    StepResult {
        string id PK
        string testRunId FK
        int stepOrder
        string blockId
        string blockType
        string status "passed|failed|skipped|running"
        string screenshotUrl
        string errorMessage
        int durationMs
    }

    Project {
        string id PK
        string name
        string description
        string createdBy
    }

    Feature {
        string id PK
        string name
        string projectId FK
        int sortOrder
    }

    Phase {
        string id PK
        string name
        string projectId FK
        int sortOrder
    }

    User {
        string id PK
        string email UK
        string name
        string image
    }

    Comment {
        string id PK
        string testCaseId FK
        string authorId FK
        string parentId FK
        string body
    }
```

## 6. Backend Route Architecture

```mermaid
graph LR
    subgraph Client["Clients"]
        FE["Frontend"]
        SSEClient["SSE Clients"]
    end

    subgraph GlobalMW["Global Middleware"]
        Helmet["Helmet<br/>(Security Headers)"]
        CORS["CORS"]
        JSON["JSON + URL-encoded<br/>Body Parser (50mb)"]
        Auth["Auth Middleware<br/>(x-user-* headers)"]
        ErrHandler["Error Handler"]
    end

    subgraph RouteMW["Route-Level Middleware"]
        RBAC["requirePermission()<br/>(RBAC)"]
        Upload["Multer<br/>(File Upload)"]
    end

    subgraph Routes["API Routes (mounted in index.ts)"]
        TC["/api/test-cases<br/>(+ test-case-details)"]
        TR["/api/test-runs"]
        PR["/api/projects"]
        IM["/api/import"]
        GEN["/api/generate"]
        EX["/api/export"]
        BL["/api/blob"]
        US["/api/users"]
        AD["/api/admin"]
        EV["/api/events (SSE)"]
    end

    subgraph Services["Services"]
        AISvc["AI Service"]
        BlobSvc["Blob Storage"]
        ImportSvc["Import Service"]
        ExportSvc["Export Service"]
    end

    subgraph Data["Data Layer"]
        Store["DataStore Interface"]
        Prisma["Prisma Client"]
        SQL["Azure SQL"]
    end

    FE --> Helmet --> CORS --> JSON --> Auth
    Auth --> RBAC
    RBAC --> TC & TR & PR & US
    RBAC --> Upload --> IM
    RBAC --> GEN
    RBAC --> EX
    RBAC --> BL

    SSEClient --> EV

    TC & TR & PR & US --> Store
    IM --> ImportSvc --> Store
    GEN --> AISvc
    EX --> ExportSvc --> Store
    BL --> BlobSvc

    Store --> Prisma --> SQL

    classDef route fill:#3b82f6,stroke:#1d4ed8,color:#fff
    classDef middleware fill:#f59e0b,stroke:#d97706,color:#fff
    classDef service fill:#10b981,stroke:#059669,color:#fff
    classDef data fill:#8b5cf6,stroke:#7c3aed,color:#fff

    class TC,TR,PR,IM,GEN,EX,BL,US,EV route
    class Helmet,CORS,JSON,Auth,RBAC,Upload,ErrHandler middleware
    class AISvc,BlobSvc,ImportSvc,ExportSvc service
    class Store,Prisma,SQL data
```

## 7. Extension Message Flow

```mermaid
graph TB
    subgraph Frontend["Next.js Frontend"]
        RunTest["run-test.ts"]
        ExtLib["extension.ts"]
    end

    subgraph Extension["Browser Extension"]
        subgraph Background["Background Service Worker"]
            Messaging["messaging.js"]
            Execution["execution.js"]
            Flow["flow.js<br/>(BFS ordering)"]
            State["state.js"]
            TabUtils["tab-utils.js"]
            Scraper["scraper.js"]
            Badge["badge.js"]
        end

        subgraph Content["Content Scripts"]
            Actions["actions.js<br/>(click, type, navigate,<br/>select, hover, scroll, wait)"]
            Assertions["assertions.js<br/>(assert handlers)"]
            Picker["element-picker.js"]
            Utils["utils.js<br/>(DOM helpers)"]
        end

        PopupUI["Popup UI"]
    end

    subgraph Target["Target Web App"]
        DOM["DOM"]
    end

    RunTest -->|"chrome.runtime.connect()"| Messaging
    RunTest -->|"EXECUTE_TEST"| Messaging
    RunTest -->|"PAUSE / RESUME / RETRY"| Messaging

    Messaging --> Execution
    Execution --> Flow
    Flow --> State
    Execution -->|"chrome.scripting.executeScript"| Actions
    Execution --> TabUtils
    TabUtils -->|"chrome.tabs.captureVisibleTab"| TabUtils

    Actions --> DOM
    Assertions --> DOM
    Picker --> DOM

    Execution -->|"STEP_COMPLETE"| RunTest
    Execution -->|"TEST_COMPLETE"| RunTest
    Badge -->|"STATUS_UPDATE"| PopupUI

    Scraper -->|"SCRAPE_PAGE"| Content

    classDef frontend fill:#3b82f6,stroke:#1d4ed8,color:#fff
    classDef bg fill:#f59e0b,stroke:#d97706,color:#000
    classDef content fill:#10b981,stroke:#059669,color:#fff
    classDef target fill:#ef4444,stroke:#dc2626,color:#fff

    class RunTest,ExtLib frontend
    class Messaging,Execution,Flow,State,TabUtils,Scraper,Badge bg
    class Actions,Assertions,Picker,Utils content
    class DOM target
```

## 8. Technology Stack Overview

```mermaid
block-beta
    columns 4

    block:frontend["Frontend"]:1
        columns 1
        nextjs["Next.js 16"]
        react["React 19"]
        tailwind["Tailwind CSS 4"]
        shadcn["shadcn/ui"]
        xyflow["@xyflow/react 12"]
        nextauth["NextAuth 5"]
    end

    block:backend["Backend"]:1
        columns 1
        express["Express.js 5"]
        prisma["Prisma 7"]
        zod["Zod 3"]
        jose["jose (JWT)"]
        multer["Multer 2"]
        docparse["mammoth + pdf-parse"]
    end

    block:ext["Extension"]:1
        columns 1
        mv3["Manifest V3"]
        vanillajs["Vanilla JS"]
        chromapi["Chrome APIs"]
        sw["Service Worker"]
        cs["Content Scripts"]
        space1["  "]
    end

    block:infra["Infrastructure"]:1
        columns 1
        azure["Azure App Service"]
        sqlserver["Azure SQL Server"]
        blob["Azure Blob Storage"]
        entra["Microsoft Entra ID"]
        copilot["GitHub Copilot API"]
        space2["  "]
    end

    style frontend fill:#3b82f6,stroke:#1d4ed8,color:#fff
    style backend fill:#10b981,stroke:#059669,color:#fff
    style ext fill:#f59e0b,stroke:#d97706,color:#000
    style infra fill:#8b5cf6,stroke:#7c3aed,color:#fff
```
