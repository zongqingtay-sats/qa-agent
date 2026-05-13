// ── Domain types matching backend API responses ──

export type TestCaseStatus = 'draft' | 'active' | 'archived';
export type TestRunStatus = 'running' | 'passed' | 'failed' | 'stopped';
export type StepStatus = 'passed' | 'failed' | 'skipped' | 'running';

// ── Test Case ──

export interface TestCase {
  id: string;
  name: string;
  description?: string;
  preconditions?: string;
  passingCriteria?: string;
  tags: string[];
  flowData: string | FlowData;
  status: TestCaseStatus;
  projectId?: string;
  featureIds: string[];
  phaseIds: string[];
  createdAt: string;
  updatedAt: string;
  // Enriched on GET /test-cases/:id
  projectName?: string;
  featureNames?: string[];
  phaseNames?: string[];
}

/** Test case as returned in project test-case listing. */
export interface ProjectTestCase extends TestCase {
  assignments: Assignment[];
  lastRunStatus: TestRunStatus | null;
}

// ── Test Run ──

export interface TestRunListItem {
  id: string;
  testCaseId: string;
  status: TestRunStatus;
  runBy?: string;
  runByName?: string;
  startedAt: string;
  createdAt?: string;
  completedAt?: string;
  durationMs?: number;
  environment?: string;
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
  testCaseName: string;
}

export interface TestRunDetail extends TestRunListItem {
  testCaseDescription?: string;
  testCasePreconditions?: string;
  testCasePassingCriteria?: string;
  flowData?: string | FlowData;
  stepResults: StepResult[];
}

// ── Step Result ──

export interface StepResult {
  id: string;
  testRunId: string;
  stepOrder: number;
  blockId: string;
  blockType: string;
  description?: string;
  target?: string;
  expectedResult?: string;
  actualResult?: string;
  status: StepStatus;
  screenshotDataUrl?: string;
  errorMessage?: string;
  durationMs?: number;
  retry?: boolean;
  executedAt: string;
}

// ── Project ──

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDetail extends Project {
  features: Feature[];
  phases: Phase[];
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

// ── Comment ──

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

// ── Assignment ──

export interface Assignment {
  id: string;
  testCaseId: string;
  userId: string;
  userName?: string;
  assignedAt: string;
  assignedBy?: string;
}

// ── Group Visibility ──

export interface GroupVisibility {
  id: string;
  userId: string;
  projectId: string;
  groupType: 'feature' | 'phase';
  groupId: string;
  isHidden: boolean;
}

// ── Flow Data ──

export interface FlowData {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface FlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: BlockData;
  [key: string]: unknown;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string;
  animated?: boolean;
  [key: string]: unknown;
}

export interface BlockData {
  label: string;
  blockType: string;
  description?: string;
  baseUrl?: string;
  url?: string;
  selector?: string;
  clickType?: string;
  value?: string;
  clearFirst?: boolean;
  selectValue?: string;
  selectByLabel?: boolean;
  scrollDirection?: string;
  scrollDistance?: number;
  waitType?: string;
  timeout?: number;
  assertionType?: string;
  expectedValue?: string;
  conditionType?: string;
  conditionSelector?: string;
  conditionValue?: string;
  screenshotLabel?: string;
  passingCriteria?: string;
}

// ── Admin ──

export interface AdminUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  status?: string;
  role: { id: string; name: string; isAdmin: boolean } | null;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  isAdmin: boolean;
  isSystem: boolean;
  status: string;
  projectPerms: number;
  testcasePerms: number;
  testrunPerms: number;
  userPerms: number;
  importPerms: number;
  generatePerms: number;
  createdAt: string;
  updatedAt: string;
}

// ── Generated Test Case (from AI) ──

export interface GeneratedTestCase {
  name: string;
  description: string;
  preconditions?: string;
  passingCriteria?: string;
  steps: GeneratedStep[];
}

export interface GeneratedStep {
  order: number;
  action: string;
  target?: string;
  value?: string;
  description: string;
  passingCriteria?: string;
}

// ── SSE Event ──

export interface SSEEvent {
  type: string;
  data: TestRunListItem & {
    step?: StepResult;
    stepResults?: StepResult[];
  };
}

// ── Create/Update request bodies ──

export interface CreateTestCaseBody {
  name: string;
  description?: string;
  preconditions?: string;
  passingCriteria?: string;
  tags?: string[];
  flowData: { nodes: Record<string, unknown>[]; edges: Record<string, unknown>[] };
}

export interface UpdateTestCaseBody {
  name?: string;
  description?: string;
  preconditions?: string;
  passingCriteria?: string;
  tags?: string[];
  flowData?: { nodes: Record<string, unknown>[]; edges: Record<string, unknown>[] };
  status?: TestCaseStatus;
  projectId?: string;
  featureIds?: string[];
  phaseIds?: string[];
}

export interface UpdateTestRunBody {
  status?: TestRunStatus;
  completedAt?: string;
  durationMs?: number;
  totalSteps?: number;
  passedSteps?: number;
  failedSteps?: number;
  environment?: string;
}
