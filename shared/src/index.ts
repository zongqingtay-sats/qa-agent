// ==========================================
// QA Agent — Shared Type Definitions
// ==========================================

// ----- Block Types -----

export type BlockType =
  | 'start'
  | 'end'
  | 'navigate'
  | 'click'
  | 'type'
  | 'select'
  | 'hover'
  | 'scroll'
  | 'wait'
  | 'wait-until'
  | 'set-variable'
  | 'assert'
  | 'if-else'
  | 'screenshot';

export type ClickType = 'single' | 'double' | 'right';
export type WaitType = 'time' | 'element-visible' | 'element-hidden';
export type AssertionType = 'element-exists' | 'text-contains' | 'value-equals' | 'url-matches' | 'element-visible' | 'element-not-exists';
export type ScrollDirection = 'up' | 'down' | 'left' | 'right';

export interface BlockData {
  label: string;
  blockType: BlockType;
  description?: string;
  // Start block
  baseUrl?: string;
  // Navigate block
  url?: string;
  // Click block
  selector?: string;
  clickType?: ClickType;
  // Type block
  value?: string;
  clearFirst?: boolean;
  // Select block
  selectValue?: string;
  selectByLabel?: boolean;
  // Scroll block
  scrollDirection?: ScrollDirection;
  scrollDistance?: number;
  // Wait block
  waitType?: WaitType;
  timeout?: number;
  // Assert block
  assertionType?: AssertionType;
  expectedValue?: string;
  // Set Variable block
  variableName?: string;
  // If-Else block
  conditionType?: AssertionType;
  conditionSelector?: string;
  conditionValue?: string;
  // Screenshot block
  screenshotLabel?: string;
  // Passing criteria (for any block)
  passingCriteria?: string;
}

// ----- Test Case -----

export interface TestStep {
  order: number;
  action: BlockType;
  target?: string;
  value?: string;
  description: string;
  passingCriteria?: string;
}

export interface TestCase {
  id: string;
  name: string;
  description: string;
  preconditions?: string;
  passingCriteria?: string;
  tags: string[];
  flowData: FlowData;
  status: TestCaseStatus;
  projectId?: string;
  featureIds: string[];
  phaseIds: string[];
  createdAt: string;
  updatedAt: string;
}

export type TestCaseStatus = 'draft' | 'active' | 'archived';

export interface FlowData {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface FlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: BlockData;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
}

// ----- Test Run -----

export interface TestRun {
  id: string;
  testCaseId: string;
  testCaseName?: string;
  status: TestRunStatus;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  environment?: TestEnvironment;
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
  stepResults: StepResult[];
}

export type TestRunStatus = 'running' | 'passed' | 'failed' | 'stopped';

export interface TestEnvironment {
  browser: string;
  browserVersion?: string;
  url: string;
  userAgent?: string;
}

export interface StepResult {
  id: string;
  testRunId: string;
  stepOrder: number;
  blockId: string;
  blockType: BlockType;
  description?: string;
  target?: string;
  expectedResult?: string;
  actualResult?: string;
  status: StepStatus;
  screenshotDataUrl?: string;
  errorMessage?: string;
  durationMs?: number;
  executedAt: string;
}

export type StepStatus = 'passed' | 'failed' | 'skipped' | 'running';

// ----- Extension Messages -----

export type ExtensionMessage =
  | { type: 'CONNECT' }
  | { type: 'CONNECTED'; extensionId: string }
  | { type: 'EXECUTE_TEST'; testFlow: FlowData; testCaseId: string; baseUrl: string }
  | { type: 'STEP_START'; stepId: string; blockId: string; blockType: BlockType }
  | { type: 'STEP_COMPLETE'; stepId: string; blockId: string; screenshot: string; durationMs: number; actualResult?: string }
  | { type: 'STEP_ERROR'; stepId: string; blockId: string; error: string; screenshot?: string }
  | { type: 'TEST_COMPLETE'; testCaseId: string; status: TestRunStatus; stepResults: StepResult[] }
  | { type: 'STOP_TEST' };

// ----- API Types -----

export interface CreateTestCaseRequest {
  name: string;
  description: string;
  preconditions?: string;
  passingCriteria?: string;
  tags?: string[];
  flowData: FlowData;
}

export interface UpdateTestCaseRequest {
  name?: string;
  description?: string;
  preconditions?: string;
  passingCriteria?: string;
  tags?: string[];
  flowData?: FlowData;
  status?: TestCaseStatus;
}

export interface GenerateFromTextRequest {
  text: string;
}

export interface ExportRequest {
  format: 'json' | 'docx' | 'pdf';
}

export interface GeneratedTestCase {
  name: string;
  description: string;
  preconditions?: string;
  passingCriteria?: string;
  steps: TestStep[];
}

// ----- Validation -----

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  blockId?: string;
  message: string;
}

export interface ValidationWarning {
  blockId?: string;
  message: string;
}

// ----- Project Management -----

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  features?: Feature[];
  phases?: Phase[];
}

export interface Feature {
  id: string;
  projectId: string;
  name: string;
  sortOrder: number;
  createdAt: string;
}

export interface Phase {
  id: string;
  projectId: string;
  name: string;
  sortOrder: number;
  createdAt: string;
}

export interface Comment {
  id: string;
  testCaseId: string;
  parentId?: string;
  authorId: string;
  authorName?: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface Assignment {
  id: string;
  testCaseId: string;
  userId: string;
  userName?: string;
  assignedAt: string;
  assignedBy?: string;
}

export interface GroupVisibility {
  id: string;
  userId: string;
  projectId: string;
  groupType: 'feature' | 'phase';
  groupId: string;
  isHidden: boolean;
}

export type GroupingMode = 'feature' | 'phase' | 'feature-phase' | 'phase-feature';
