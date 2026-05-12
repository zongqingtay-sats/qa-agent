// In-memory data store for PoC
// Mirrors the SQL schema from technical specs

import { v4 as uuidv4 } from 'uuid';

export interface TestCaseRecord {
  id: string;
  name: string;
  description: string;
  preconditions?: string;
  passingCriteria?: string;
  tags: string[];
  flowData: string; // JSON string of FlowData
  status: 'draft' | 'active' | 'archived';
  projectId?: string;
  featureIds: string[];
  phaseIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TestRunRecord {
  id: string;
  testCaseId: string;
  status: 'running' | 'passed' | 'failed' | 'stopped';
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  environment?: string; // JSON string
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
}

export interface StepResultRecord {
  id: string;
  testRunId: string;
  stepOrder: number;
  blockId: string;
  blockType: string;
  description?: string;
  target?: string;
  expectedResult?: string;
  actualResult?: string;
  status: 'passed' | 'failed' | 'skipped' | 'running';
  screenshotDataUrl?: string;
  errorMessage?: string;
  durationMs?: number;
  retry?: boolean;
  executedAt: string;
}

export interface ProjectRecord {
  id: string;
  name: string;
  description?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FeatureRecord {
  id: string;
  projectId: string;
  name: string;
  sortOrder: number;
  createdAt: string;
}

export interface PhaseRecord {
  id: string;
  projectId: string;
  name: string;
  sortOrder: number;
  createdAt: string;
}

export interface CommentRecord {
  id: string;
  testCaseId: string;
  parentId?: string;
  authorId: string;
  authorName?: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssignmentRecord {
  id: string;
  testCaseId: string;
  userId: string;
  userName?: string;
  assignedAt: string;
  assignedBy?: string;
}

export interface GroupVisibilityRecord {
  id: string;
  userId: string;
  projectId: string;
  groupType: 'feature' | 'phase';
  groupId: string;
  isHidden: boolean;
}

class InMemoryStore {
  testCases: Map<string, TestCaseRecord> = new Map();
  testRuns: Map<string, TestRunRecord> = new Map();
  stepResults: Map<string, StepResultRecord> = new Map();
  projects: Map<string, ProjectRecord> = new Map();
  features: Map<string, FeatureRecord> = new Map();
  phases: Map<string, PhaseRecord> = new Map();
  comments: Map<string, CommentRecord> = new Map();
  assignments: Map<string, AssignmentRecord> = new Map();
  groupVisibility: Map<string, GroupVisibilityRecord> = new Map();
  // Junction tables (M2M)
  testCaseFeatures: Map<string, { id: string; testCaseId: string; featureId: string }> = new Map();
  testCasePhases: Map<string, { id: string; testCaseId: string; phaseId: string }> = new Map();

  // --- Test Cases ---

  createTestCase(data: Omit<TestCaseRecord, 'id' | 'createdAt' | 'updatedAt'>): TestCaseRecord {
    const now = new Date().toISOString();
    const record: TestCaseRecord = {
      ...data,
      id: uuidv4(),
      featureIds: data.featureIds || [],
      phaseIds: data.phaseIds || [],
      createdAt: now,
      updatedAt: now,
    };
    this.testCases.set(record.id, record);
    // Create junction records
    for (const fId of record.featureIds) {
      const jId = uuidv4();
      this.testCaseFeatures.set(jId, { id: jId, testCaseId: record.id, featureId: fId });
    }
    for (const pId of record.phaseIds) {
      const jId = uuidv4();
      this.testCasePhases.set(jId, { id: jId, testCaseId: record.id, phaseId: pId });
    }
    return record;
  }

  getTestCase(id: string): TestCaseRecord | undefined {
    return this.testCases.get(id);
  }

  getAllTestCases(filters?: { status?: string; search?: string; projectId?: string }): TestCaseRecord[] {
    let results = Array.from(this.testCases.values());

    if (filters?.status) {
      results = results.filter(tc => tc.status === filters.status);
    }
    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      results = results.filter(tc =>
        tc.name.toLowerCase().includes(searchLower) ||
        tc.description.toLowerCase().includes(searchLower)
      );
    }
    if (filters?.projectId) {
      results = results.filter(tc => tc.projectId === filters.projectId);
    }

    return results.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  updateTestCase(id: string, data: Partial<TestCaseRecord>): TestCaseRecord | undefined {
    const existing = this.testCases.get(id);
    if (!existing) return undefined;

    const updated: TestCaseRecord = {
      ...existing,
      ...data,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    // Sync feature junctions if featureIds changed
    if (data.featureIds !== undefined) {
      for (const j of this.testCaseFeatures.values()) {
        if (j.testCaseId === id) this.testCaseFeatures.delete(j.id);
      }
      for (const fId of updated.featureIds) {
        const jId = uuidv4();
        this.testCaseFeatures.set(jId, { id: jId, testCaseId: id, featureId: fId });
      }
    }
    // Sync phase junctions if phaseIds changed
    if (data.phaseIds !== undefined) {
      for (const j of this.testCasePhases.values()) {
        if (j.testCaseId === id) this.testCasePhases.delete(j.id);
      }
      for (const pId of updated.phaseIds) {
        const jId = uuidv4();
        this.testCasePhases.set(jId, { id: jId, testCaseId: id, phaseId: pId });
      }
    }

    this.testCases.set(id, updated);
    return updated;
  }

  deleteTestCase(id: string): boolean {
    return this.testCases.delete(id);
  }

  // --- Test Runs ---

  createTestRun(data: Omit<TestRunRecord, 'id' | 'startedAt'>): TestRunRecord {
    const record: TestRunRecord = {
      ...data,
      id: uuidv4(),
      startedAt: new Date().toISOString(),
    };
    this.testRuns.set(record.id, record);
    return record;
  }

  getTestRun(id: string): TestRunRecord | undefined {
    return this.testRuns.get(id);
  }

  getAllTestRuns(filters?: { testCaseId?: string; status?: string }): TestRunRecord[] {
    let results = Array.from(this.testRuns.values());

    if (filters?.testCaseId) {
      results = results.filter(tr => tr.testCaseId === filters.testCaseId);
    }
    if (filters?.status) {
      results = results.filter(tr => tr.status === filters.status);
    }

    return results.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  updateTestRun(id: string, data: Partial<TestRunRecord>): TestRunRecord | undefined {
    const existing = this.testRuns.get(id);
    if (!existing) return undefined;

    const updated: TestRunRecord = {
      ...existing,
      ...data,
      id: existing.id,
      startedAt: existing.startedAt,
    };
    this.testRuns.set(id, updated);
    return updated;
  }

  // --- Step Results ---

  createStepResult(data: Omit<StepResultRecord, 'id' | 'executedAt'>): StepResultRecord {
    // Upsert logic: find a record with the same testRunId + stepOrder + retry flag
    // that is still in "running" status. This handles the running → passed/failed
    // transition. If the existing record is already completed (passed/failed),
    // a new record is created (e.g. subsequent retries get separate records).
    const existing = Array.from(this.stepResults.values()).find(
      sr => sr.testRunId === data.testRunId
        && sr.stepOrder === data.stepOrder
        && (sr.retry || false) === (data.retry || false)
        && sr.status === 'running'
    );

    if (existing) {
      const updated: StepResultRecord = {
        ...existing,
        ...data,
        id: existing.id,
        executedAt: new Date().toISOString(),
      };
      this.stepResults.set(existing.id, updated);
      return updated;
    }

    const record: StepResultRecord = {
      ...data,
      id: uuidv4(),
      executedAt: new Date().toISOString(),
    };
    this.stepResults.set(record.id, record);
    return record;
  }

  getStepResultsForRun(testRunId: string): StepResultRecord[] {
    return Array.from(this.stepResults.values())
      .filter(sr => sr.testRunId === testRunId)
      .sort((a, b) => a.stepOrder - b.stepOrder);
  }

  // --- Projects ---

  createProject(data: Omit<ProjectRecord, 'id' | 'createdAt' | 'updatedAt'>): ProjectRecord {
    const now = new Date().toISOString();
    const record: ProjectRecord = { ...data, id: uuidv4(), createdAt: now, updatedAt: now };
    this.projects.set(record.id, record);
    return record;
  }

  getProject(id: string): ProjectRecord | undefined {
    return this.projects.get(id);
  }

  getAllProjects(filters?: { search?: string }): ProjectRecord[] {
    let results = Array.from(this.projects.values());
    if (filters?.search) {
      const s = filters.search.toLowerCase();
      results = results.filter(p => p.name.toLowerCase().includes(s) || (p.description || '').toLowerCase().includes(s));
    }
    return results.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  updateProject(id: string, data: Partial<ProjectRecord>): ProjectRecord | undefined {
    const existing = this.projects.get(id);
    if (!existing) return undefined;
    const updated: ProjectRecord = { ...existing, ...data, id: existing.id, createdAt: existing.createdAt, updatedAt: new Date().toISOString() };
    this.projects.set(id, updated);
    return updated;
  }

  deleteProject(id: string): boolean {
    // Cascade: remove features, phases, visibility, junction records, and unlink test cases
    const featureIds = new Set<string>();
    const phaseIds = new Set<string>();
    for (const f of this.features.values()) { if (f.projectId === id) { featureIds.add(f.id); this.features.delete(f.id); } }
    for (const p of this.phases.values()) { if (p.projectId === id) { phaseIds.add(p.id); this.phases.delete(p.id); } }
    for (const gv of this.groupVisibility.values()) { if (gv.projectId === id) this.groupVisibility.delete(gv.id); }
    // Remove junction records for deleted features/phases
    for (const j of this.testCaseFeatures.values()) { if (featureIds.has(j.featureId)) this.testCaseFeatures.delete(j.id); }
    for (const j of this.testCasePhases.values()) { if (phaseIds.has(j.phaseId)) this.testCasePhases.delete(j.id); }
    // Unlink test cases from project and rebuild their featureIds/phaseIds
    for (const tc of this.testCases.values()) {
      if (tc.projectId === id) {
        const newFeatureIds = tc.featureIds.filter(fId => !featureIds.has(fId));
        const newPhaseIds = tc.phaseIds.filter(pId => !phaseIds.has(pId));
        this.testCases.set(tc.id, { ...tc, projectId: undefined, featureIds: newFeatureIds, phaseIds: newPhaseIds });
      }
    }
    return this.projects.delete(id);
  }

  // --- Features ---

  createFeature(data: Omit<FeatureRecord, 'id' | 'createdAt'>): FeatureRecord {
    const record: FeatureRecord = { ...data, id: uuidv4(), createdAt: new Date().toISOString() };
    this.features.set(record.id, record);
    return record;
  }

  getFeaturesForProject(projectId: string): FeatureRecord[] {
    return Array.from(this.features.values())
      .filter(f => f.projectId === projectId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  updateFeature(id: string, data: Partial<FeatureRecord>): FeatureRecord | undefined {
    const existing = this.features.get(id);
    if (!existing) return undefined;
    const updated: FeatureRecord = { ...existing, ...data, id: existing.id };
    this.features.set(id, updated);
    return updated;
  }

  deleteFeature(id: string): boolean {
    return this.features.delete(id);
  }

  // --- Phases ---

  createPhase(data: Omit<PhaseRecord, 'id' | 'createdAt'>): PhaseRecord {
    const record: PhaseRecord = { ...data, id: uuidv4(), createdAt: new Date().toISOString() };
    this.phases.set(record.id, record);
    return record;
  }

  getPhasesForProject(projectId: string): PhaseRecord[] {
    return Array.from(this.phases.values())
      .filter(p => p.projectId === projectId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  updatePhase(id: string, data: Partial<PhaseRecord>): PhaseRecord | undefined {
    const existing = this.phases.get(id);
    if (!existing) return undefined;
    const updated: PhaseRecord = { ...existing, ...data, id: existing.id };
    this.phases.set(id, updated);
    return updated;
  }

  deletePhase(id: string): boolean {
    return this.phases.delete(id);
  }

  // --- Comments ---

  createComment(data: Omit<CommentRecord, 'id' | 'createdAt' | 'updatedAt'>): CommentRecord {
    const now = new Date().toISOString();
    const record: CommentRecord = { ...data, id: uuidv4(), createdAt: now, updatedAt: now };
    this.comments.set(record.id, record);
    return record;
  }

  getCommentsForTestCase(testCaseId: string): CommentRecord[] {
    return Array.from(this.comments.values())
      .filter(c => c.testCaseId === testCaseId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  updateComment(id: string, data: Partial<CommentRecord>): CommentRecord | undefined {
    const existing = this.comments.get(id);
    if (!existing) return undefined;
    const updated: CommentRecord = { ...existing, ...data, id: existing.id, updatedAt: new Date().toISOString() };
    this.comments.set(id, updated);
    return updated;
  }

  deleteComment(id: string): boolean {
    // Also delete replies
    for (const c of this.comments.values()) { if (c.parentId === id) this.comments.delete(c.id); }
    return this.comments.delete(id);
  }

  // --- Assignments ---

  createAssignment(data: Omit<AssignmentRecord, 'id' | 'assignedAt'>): AssignmentRecord {
    // Check uniqueness
    for (const a of this.assignments.values()) {
      if (a.testCaseId === data.testCaseId && a.userId === data.userId) return a;
    }
    const record: AssignmentRecord = { ...data, id: uuidv4(), assignedAt: new Date().toISOString() };
    this.assignments.set(record.id, record);
    return record;
  }

  getAssignmentsForTestCase(testCaseId: string): AssignmentRecord[] {
    return Array.from(this.assignments.values()).filter(a => a.testCaseId === testCaseId);
  }

  deleteAssignment(testCaseId: string, userId: string): boolean {
    for (const a of this.assignments.values()) {
      if (a.testCaseId === testCaseId && a.userId === userId) {
        return this.assignments.delete(a.id);
      }
    }
    return false;
  }

  // --- Group Visibility ---

  getGroupVisibility(userId: string, projectId: string): GroupVisibilityRecord[] {
    return Array.from(this.groupVisibility.values())
      .filter(gv => gv.userId === userId && gv.projectId === projectId);
  }

  setGroupVisibility(data: Omit<GroupVisibilityRecord, 'id'>): GroupVisibilityRecord {
    // Upsert
    for (const gv of this.groupVisibility.values()) {
      if (gv.userId === data.userId && gv.projectId === data.projectId && gv.groupType === data.groupType && gv.groupId === data.groupId) {
        const updated = { ...gv, isHidden: data.isHidden };
        this.groupVisibility.set(gv.id, updated);
        return updated;
      }
    }
    const record: GroupVisibilityRecord = { ...data, id: uuidv4() };
    this.groupVisibility.set(record.id, record);
    return record;
  }
}

// Singleton instance
export const store = new InMemoryStore();
