/**
 * Unified data store interface.
 * Uses SqlStore when DATABASE_URL is configured, otherwise falls back to InMemoryStore.
 * All methods return Promises for consistency.
 */
import { appConfig } from '../config';
import type { TestCaseRecord, TestRunRecord, StepResultRecord } from './store';
import { store as inMemoryStore } from './store';
import { SqlStore } from './sql-store';

export interface DataStore {
  createTestCase(data: Omit<TestCaseRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<TestCaseRecord>;
  getTestCase(id: string): Promise<TestCaseRecord | undefined>;
  getAllTestCases(filters?: { status?: string; search?: string }): Promise<TestCaseRecord[]>;
  updateTestCase(id: string, data: Partial<TestCaseRecord>): Promise<TestCaseRecord | undefined>;
  deleteTestCase(id: string): Promise<boolean>;

  createTestRun(data: Omit<TestRunRecord, 'id' | 'startedAt'>): Promise<TestRunRecord>;
  getTestRun(id: string): Promise<TestRunRecord | undefined>;
  getAllTestRuns(filters?: { testCaseId?: string; status?: string }): Promise<TestRunRecord[]>;
  updateTestRun(id: string, data: Partial<TestRunRecord>): Promise<TestRunRecord | undefined>;

  createStepResult(data: Omit<StepResultRecord, 'id' | 'executedAt'>): Promise<StepResultRecord>;
  getStepResultsForRun(testRunId: string): Promise<StepResultRecord[]>;
}

/** Wraps the synchronous in-memory store to return Promises */
class AsyncInMemoryStore implements DataStore {
  async createTestCase(data: Omit<TestCaseRecord, 'id' | 'createdAt' | 'updatedAt'>) { return inMemoryStore.createTestCase(data); }
  async getTestCase(id: string) { return inMemoryStore.getTestCase(id); }
  async getAllTestCases(filters?: { status?: string; search?: string }) { return inMemoryStore.getAllTestCases(filters); }
  async updateTestCase(id: string, data: Partial<TestCaseRecord>) { return inMemoryStore.updateTestCase(id, data); }
  async deleteTestCase(id: string) { return inMemoryStore.deleteTestCase(id); }
  async createTestRun(data: Omit<TestRunRecord, 'id' | 'startedAt'>) { return inMemoryStore.createTestRun(data); }
  async getTestRun(id: string) { return inMemoryStore.getTestRun(id); }
  async getAllTestRuns(filters?: { testCaseId?: string; status?: string }) { return inMemoryStore.getAllTestRuns(filters); }
  async updateTestRun(id: string, data: Partial<TestRunRecord>) { return inMemoryStore.updateTestRun(id, data); }
  async createStepResult(data: Omit<StepResultRecord, 'id' | 'executedAt'>) { return inMemoryStore.createStepResult(data); }
  async getStepResultsForRun(testRunId: string) { return inMemoryStore.getStepResultsForRun(testRunId); }
}

function isSqlEnabled(): boolean {
  return !!appConfig.databaseUrl;
}

export const dataStore: DataStore = isSqlEnabled() ? new SqlStore() : new AsyncInMemoryStore();
