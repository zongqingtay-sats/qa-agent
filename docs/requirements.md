# Requirements Document — QA Agent

## 1. Project Overview

### 1.1 Purpose

QA Agent is an automated web application QA testing tool that enables teams to import, generate, visually design, execute, and report on test cases. It combines AI-powered test case generation with a low-code visual test flow editor and browser-based test execution to streamline the QA process.

### 1.2 Problem Statement

Manual QA testing is time-consuming, error-prone, and difficult to document consistently. Existing automation tools require significant programming expertise, creating a barrier for non-technical QA staff. There is a need for a tool that:

- Lowers the barrier to test automation through visual, low-code test design
- Leverages AI to generate and refine test cases from business requirements
- Executes tests on live web applications with full screenshot documentation
- Produces structured, exportable result reports automatically

### 1.3 Target Users

- **QA Engineers** — primary users who create, edit, and execute test cases
- **Test Managers** — oversee test projects, review results, manage team access
- **Developers** — generate test cases from source code, review failed test results

---

## 2. Scope

The project is delivered in two phases:

| Phase | Scope | Key Deliverables |
|-------|-------|-----------------|
| **PoC** | Core testing workflow | Test import/generation, visual editor, browser execution, result reports |
| **Production** | Enterprise readiness | Authentication, cloud DB, project management, collaboration |

---

## 3. PoC Functional Requirements

### FR-1: Test Case Import & Generation

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-1.1 | Import test cases from Word (.docx) documents | Must |
| FR-1.2 | Import test cases from PDF documents | Must |
| FR-1.3 | Import test cases from plain text (.txt) files | Must |
| FR-1.4 | Import test cases from JSON files (structured format) | Must |
| FR-1.5 | Generate test cases from uploaded business requirements documents via AI | Must |
| FR-1.6 | Generate test cases from natural language text input via AI | Must |
| FR-1.7 | Generate test cases from application source code files via AI | Should |
| FR-1.8 | AI-generated test cases must be editable before saving | Must |
| FR-1.9 | Support batch import of multiple test cases from a single document | Should |
| FR-1.10 | Scrape target web page via browser extension to provide page context for AI generation | Should |
| FR-1.11 | Auto-infer target URL from natural language input (debounced) | Should |
| FR-1.12 | Auto-format manually entered URLs (prepend https:// if missing) | Should |
| FR-1.13 | After initial generation, refine test cases by scraping navigation target pages | Should |

### FR-2: Visual Test Flow Editor

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-2.1 | Provide a drag-and-drop canvas for designing test flows | Must |
| FR-2.2 | Support the following block types: Start, End, Navigate, Click, Type/Input, Assert, Wait, If-Else, Screenshot, Scroll, Hover, Select (dropdown) | Must |
| FR-2.3 | Each block must have a configurable properties panel (e.g., CSS selector, URL, expected value, timeout) | Must |
| FR-2.4 | Blocks must be connectable via edges to define execution order | Must |
| FR-2.5 | Support zoom, pan, and minimap on the canvas | Should |
| FR-2.6 | Support undo/redo operations | Should |
| FR-2.7 | Validate flow integrity (e.g., must start with Start block, end with End block, no disconnected blocks) | Must |
| FR-2.8 | Export test flows to JSON format | Must |
| FR-2.9 | Export test flows to Word (.docx) format | Must |
| FR-2.10 | Export test flows to PDF format | Must |
| FR-2.11 | Support editing test case metadata (description, preconditions, passing criteria, tags) from the editor | Should |
| FR-2.12 | Save button should be hidden when no changes have been made (dirty-state tracking) | Should |

### FR-3: Test Execution

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-3.1 | Provide a test case management page where users can select test cases to run | Must |
| FR-3.2 | Execute test cases on live web applications via browser automation | Must |
| FR-3.3 | Use a browser extension (Chrome/Edge) to perform test actions on the target application | Must |
| FR-3.4 | Capture a screenshot at each test step during execution | Must |
| FR-3.5 | Display real-time execution progress (current step, status) via SSE | Must |
| FR-3.6 | On error, highlight the offending block in the flow view | Must |
| FR-3.7 | On error, halt the entire test flow and report the failure | Must |
| FR-3.8 | Support running multiple selected test cases sequentially | Should |
| FR-3.9 | Record step execution time for each step | Should |
| FR-3.10 | Support pause, resume, retry-step, and skip-step controls during execution | Should |
| FR-3.11 | Display execution progress in the browser extension popup with progress bar, step count, and current step description | Should |
| FR-3.12 | Support re-running test cases from the test run listing and detail pages | Should |
| FR-3.13 | Support multi-select re-run of test runs | Should |

### FR-4: Result Document Generation

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-4.1 | Generate a result document for each completed test run | Must |
| FR-4.2 | Result document must include: test case description, test steps, passing criteria, per-step screenshots, and pass/fail status | Must |
| FR-4.3 | Export results to JSON format | Must |
| FR-4.4 | Export results to Word (.docx) format | Must |
| FR-4.5 | Export results to PDF format | Must |
| FR-4.6 | Include timestamp, duration, and environment info in results | Should |
| FR-4.7 | Include error messages and stack traces for failed steps | Must |
| FR-4.8 | Test run listing supports expandable/collapsible rows with lazy-loaded step details | Should |
| FR-4.9 | Test run detail page shows expandable step rows with full detail (target, expected/actual, error, screenshot) | Should |
| FR-4.10 | Test run listing supports search by test case name or status | Should |
| FR-4.11 | Test run detail page shows case info card with link to test case editor | Should |

### FR-4A: Dashboard

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-4A.1 | Display quick stats: total test cases, total test runs, passed count, failed count | Must |
| FR-4A.2 | Provide quick action cards for Import, Generate, and Create New Test | Should |
| FR-4A.3 | Show recent test runs with status | Should |
| FR-4A.4 | Show recent test cases list | Should |

### FR-4B: Settings

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-4B.1 | Provide a settings page to configure the browser extension ID | Must |
| FR-4B.2 | Support connection test (ping) to verify extension connectivity | Must |
| FR-4B.3 | Persist extension ID in local storage | Must |

### FR-2A: Visual Editor — Additional Features (Implemented Beyond PoC Scope)

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-2A.1 | Support copy/cut/paste of selected blocks via Ctrl+C/X/V with position offset | Implemented | ✅ Done |
| FR-2A.2 | Ctrl+S keyboard shortcut to save test flow | Implemented | ✅ Done |
| FR-2A.3 | Single-edge-per-handle validation (warn when multiple edges connect to same handle) | Implemented | ✅ Done |
| FR-2A.4 | Element picker: select CSS selectors interactively from the target page via browser extension | Implemented | ✅ Done |
| FR-2A.5 | Element picker dialog with browser tab list and manual URL input | Implemented | ✅ Done |
| FR-2A.6 | Last run panel in editor showing most recent run status, error, and step screenshots | Implemented | ✅ Done |
| FR-2A.7 | Collapsible metadata panel with inline editing | Implemented | ✅ Done |

---

## 3A. PoC Implementation Status

### Must Requirements — All Complete ✅

All PoC "Must" priority requirements (FR-1.1–1.6, FR-1.8, FR-2.1–2.4, FR-2.7–2.10, FR-3.1–3.7, FR-4.1–4.5, FR-4.7, FR-4A.1, FR-4B.1–4B.3) have been implemented.

### Should Requirements — Completed

| ID | Requirement | Status |
|----|-------------|--------|
| FR-2.5 | Minimap on canvas | ✅ Done |
| FR-2.6 | Undo/redo operations | ✅ Done |
| FR-2.11 | Edit metadata from editor | ✅ Done |
| FR-2.12 | Dirty-state tracking (hide save when clean) | ✅ Done |
| FR-3.12 | Re-running test cases from listing/detail | ✅ Done |
| FR-4.8 | Expandable/collapsible rows with lazy-loaded steps | ✅ Done |
| FR-4.9 | Test run detail expandable step rows | ✅ Done |
| FR-4.10 | Search by test case name or status | ✅ Done |
| FR-4.11 | Test run detail case info card with link to editor | ✅ Done |
| FR-4A.2 | Quick action cards on dashboard | ✅ Done |
| FR-4A.3 | Recent test runs on dashboard | ✅ Done |
| FR-4A.4 | Recent test cases on dashboard | ✅ Done |

### Should Requirements — Remaining

| ID | Requirement | Status |
|----|-------------|--------|
| FR-1.9 | Batch import multiple test cases from single document | ✅ Done |
| FR-3.10 | Skip-step control during execution | ❌ Not started |
| FR-3.13 | Multi-select re-run of test runs | ❌ Not started |
| FR-4.6 | Timestamp/duration/environment in exported results | ✅ Done |

---

## 4. Production Functional Requirements

### FR-5: Authentication & Authorization

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-5.1 | Authenticate users via Azure Entra ID (SSO) | Must |
| FR-5.2 | Support role-based access control (RBAC) | Must |
| FR-5.3 | Define roles: Admin, Manager, Tester, Viewer | Must |
| FR-5.4 | Grant permissions per project: create test cases, edit test cases, run tests, view results | Must |
| FR-5.5 | Admin can manage user roles and project access | Must |

### FR-6: Data Storage

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-6.1 | Store all test data in Azure SQL Server | Must |
| FR-6.2 | Store screenshots in Azure Blob Storage with references in SQL | Must |
| FR-6.3 | Support data backup and recovery | Should |

### FR-7: Project Management

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-7.1 | Provide a project management interface similar to Jira/ClickUp | Must |
| FR-7.2 | Group test cases by Project → Feature → Phase hierarchy | Must |
| FR-7.3 | Support list and board (Kanban) views | Should |
| FR-7.4 | Provide filtering and search across test cases | Must |
| FR-7.5 | Support comment and reply threads on each test case | Must |
| FR-7.6 | Support bulk operations (move, delete, assign) | Should |

---

## 5. Non-Functional Requirements

| ID | Requirement | Category |
|----|-------------|----------|
| NFR-1 | Page load time must be under 3 seconds | Performance |
| NFR-2 | Test execution latency per step must be under 5 seconds (excluding waits) | Performance |
| NFR-3 | Support at least 50 concurrent users (Production) | Scalability |
| NFR-4 | All API endpoints must validate and sanitize input (OWASP Top 10) | Security |
| NFR-5 | All data in transit must use TLS 1.2+ | Security |
| NFR-6 | UI must be responsive (desktop-first, minimum 1280px) | Usability |
| NFR-7 | Support Chrome and Edge browsers (latest 2 versions) | Compatibility |
| NFR-8 | Uploaded files must be validated for type and size (max 20MB) | Security |
| NFR-9 | Application must provide meaningful error messages | Usability |
| NFR-10 | All actions must be audit-logged (Production) | Security |

---

## 6. Technical Constraints

| Constraint | Value |
|-----------|-------|
| Language | TypeScript |
| Frontend Framework | Next.js (App Router) |
| UI Library | shadcn/ui + Tailwind CSS |
| Backend Framework | Express.js |
| AI Provider | GitHub Copilot Chat API |
| Database | Azure SQL Server |
| Hosting | Azure App Service |
| Browser Extension | Chrome/Edge (Manifest V3) |
| Test Execution | Browser extension with DOM automation |

---

## 7. Glossary

| Term | Definition |
|------|-----------|
| **Test Case** | A set of steps and expected outcomes that verify a specific feature or behavior |
| **Test Flow** | A visual representation of a test case as connected blocks on a canvas |
| **Block** | A single action or control node in a test flow (e.g., Click, Navigate, Assert) |
| **Test Run** | A single execution instance of one or more test cases |
| **Test Step** | An individual action within a test case |
| **Passing Criteria** | The expected outcome that determines whether a test step passes or fails |
| **PoC** | Proof of Concept — initial phase demonstrating core functionality |
| **RBAC** | Role-Based Access Control — permission model based on user roles |
