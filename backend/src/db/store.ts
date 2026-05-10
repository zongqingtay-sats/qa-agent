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

class InMemoryStore {
  testCases: Map<string, TestCaseRecord> = new Map();
  testRuns: Map<string, TestRunRecord> = new Map();
  stepResults: Map<string, StepResultRecord> = new Map();

  // --- Test Cases ---

  createTestCase(data: Omit<TestCaseRecord, 'id' | 'createdAt' | 'updatedAt'>): TestCaseRecord {
    const now = new Date().toISOString();
    const record: TestCaseRecord = {
      ...data,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
    };
    this.testCases.set(record.id, record);
    return record;
  }

  getTestCase(id: string): TestCaseRecord | undefined {
    return this.testCases.get(id);
  }

  getAllTestCases(filters?: { status?: string; search?: string }): TestCaseRecord[] {
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
}

// Singleton instance
export const store = new InMemoryStore();
