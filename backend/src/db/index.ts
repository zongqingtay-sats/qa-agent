/**
 * Unified data store interface.
 * Uses SqlStore when DATABASE_URL is configured, otherwise falls back to InMemoryStore.
 * All methods return Promises for consistency.
 */
import { appConfig } from '../config';
import type { TestCaseRecord, TestRunRecord, StepResultRecord, ProjectRecord, FeatureRecord, PhaseRecord, CommentRecord, AssignmentRecord, GroupVisibilityRecord } from './store';
import { store as inMemoryStore } from './store';
import { SqlStore } from './sql-store';

export interface DataStore {
  createTestCase(data: Omit<TestCaseRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<TestCaseRecord>;
  getTestCase(id: string): Promise<TestCaseRecord | undefined>;
  getAllTestCases(filters?: { status?: string; search?: string; projectId?: string }): Promise<TestCaseRecord[]>;
  updateTestCase(id: string, data: Partial<TestCaseRecord>): Promise<TestCaseRecord | undefined>;
  deleteTestCase(id: string): Promise<boolean>;

  createTestRun(data: Omit<TestRunRecord, 'id' | 'startedAt'>): Promise<TestRunRecord>;
  getTestRun(id: string): Promise<TestRunRecord | undefined>;
  getAllTestRuns(filters?: { testCaseId?: string; status?: string }): Promise<TestRunRecord[]>;
  updateTestRun(id: string, data: Partial<TestRunRecord>): Promise<TestRunRecord | undefined>;

  createStepResult(data: Omit<StepResultRecord, 'id' | 'executedAt'>): Promise<StepResultRecord>;
  getStepResultsForRun(testRunId: string): Promise<StepResultRecord[]>;

  // Projects
  createProject(data: Omit<ProjectRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProjectRecord>;
  getProject(id: string): Promise<ProjectRecord | undefined>;
  getAllProjects(filters?: { search?: string }): Promise<ProjectRecord[]>;
  updateProject(id: string, data: Partial<ProjectRecord>): Promise<ProjectRecord | undefined>;
  deleteProject(id: string): Promise<boolean>;

  // Features
  createFeature(data: Omit<FeatureRecord, 'id' | 'createdAt'>): Promise<FeatureRecord>;
  getFeaturesForProject(projectId: string): Promise<FeatureRecord[]>;
  updateFeature(id: string, data: Partial<FeatureRecord>): Promise<FeatureRecord | undefined>;
  deleteFeature(id: string): Promise<boolean>;

  // Phases
  createPhase(data: Omit<PhaseRecord, 'id' | 'createdAt'>): Promise<PhaseRecord>;
  getPhasesForProject(projectId: string): Promise<PhaseRecord[]>;
  updatePhase(id: string, data: Partial<PhaseRecord>): Promise<PhaseRecord | undefined>;
  deletePhase(id: string): Promise<boolean>;

  // Comments
  createComment(data: Omit<CommentRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<CommentRecord>;
  getCommentsForTestCase(testCaseId: string): Promise<CommentRecord[]>;
  updateComment(id: string, data: Partial<CommentRecord>): Promise<CommentRecord | undefined>;
  deleteComment(id: string): Promise<boolean>;

  // Assignments
  createAssignment(data: Omit<AssignmentRecord, 'id' | 'assignedAt'>): Promise<AssignmentRecord>;
  getAssignmentsForTestCase(testCaseId: string): Promise<AssignmentRecord[]>;
  deleteAssignment(testCaseId: string, userId: string): Promise<boolean>;

  // Group Visibility
  getGroupVisibility(userId: string, projectId: string): Promise<GroupVisibilityRecord[]>;
  setGroupVisibility(data: Omit<GroupVisibilityRecord, 'id'>): Promise<GroupVisibilityRecord>;
}

/** Wraps the synchronous in-memory store to return Promises */
class AsyncInMemoryStore implements DataStore {
  async createTestCase(data: Omit<TestCaseRecord, 'id' | 'createdAt' | 'updatedAt'>) { return inMemoryStore.createTestCase(data); }
  async getTestCase(id: string) { return inMemoryStore.getTestCase(id); }
  async getAllTestCases(filters?: { status?: string; search?: string; projectId?: string }) { return inMemoryStore.getAllTestCases(filters); }
  async updateTestCase(id: string, data: Partial<TestCaseRecord>) { return inMemoryStore.updateTestCase(id, data); }
  async deleteTestCase(id: string) { return inMemoryStore.deleteTestCase(id); }
  async createTestRun(data: Omit<TestRunRecord, 'id' | 'startedAt'>) { return inMemoryStore.createTestRun(data); }
  async getTestRun(id: string) { return inMemoryStore.getTestRun(id); }
  async getAllTestRuns(filters?: { testCaseId?: string; status?: string }) { return inMemoryStore.getAllTestRuns(filters); }
  async updateTestRun(id: string, data: Partial<TestRunRecord>) { return inMemoryStore.updateTestRun(id, data); }
  async createStepResult(data: Omit<StepResultRecord, 'id' | 'executedAt'>) { return inMemoryStore.createStepResult(data); }
  async getStepResultsForRun(testRunId: string) { return inMemoryStore.getStepResultsForRun(testRunId); }

  // Projects
  async createProject(data: Omit<ProjectRecord, 'id' | 'createdAt' | 'updatedAt'>) { return inMemoryStore.createProject(data); }
  async getProject(id: string) { return inMemoryStore.getProject(id); }
  async getAllProjects(filters?: { search?: string }) { return inMemoryStore.getAllProjects(filters); }
  async updateProject(id: string, data: Partial<ProjectRecord>) { return inMemoryStore.updateProject(id, data); }
  async deleteProject(id: string) { return inMemoryStore.deleteProject(id); }

  // Features
  async createFeature(data: Omit<FeatureRecord, 'id' | 'createdAt'>) { return inMemoryStore.createFeature(data); }
  async getFeaturesForProject(projectId: string) { return inMemoryStore.getFeaturesForProject(projectId); }
  async updateFeature(id: string, data: Partial<FeatureRecord>) { return inMemoryStore.updateFeature(id, data); }
  async deleteFeature(id: string) { return inMemoryStore.deleteFeature(id); }

  // Phases
  async createPhase(data: Omit<PhaseRecord, 'id' | 'createdAt'>) { return inMemoryStore.createPhase(data); }
  async getPhasesForProject(projectId: string) { return inMemoryStore.getPhasesForProject(projectId); }
  async updatePhase(id: string, data: Partial<PhaseRecord>) { return inMemoryStore.updatePhase(id, data); }
  async deletePhase(id: string) { return inMemoryStore.deletePhase(id); }

  // Comments
  async createComment(data: Omit<CommentRecord, 'id' | 'createdAt' | 'updatedAt'>) { return inMemoryStore.createComment(data); }
  async getCommentsForTestCase(testCaseId: string) { return inMemoryStore.getCommentsForTestCase(testCaseId); }
  async updateComment(id: string, data: Partial<CommentRecord>) { return inMemoryStore.updateComment(id, data); }
  async deleteComment(id: string) { return inMemoryStore.deleteComment(id); }

  // Assignments
  async createAssignment(data: Omit<AssignmentRecord, 'id' | 'assignedAt'>) { return inMemoryStore.createAssignment(data); }
  async getAssignmentsForTestCase(testCaseId: string) { return inMemoryStore.getAssignmentsForTestCase(testCaseId); }
  async deleteAssignment(testCaseId: string, userId: string) { return inMemoryStore.deleteAssignment(testCaseId, userId); }

  // Group Visibility
  async getGroupVisibility(userId: string, projectId: string) { return inMemoryStore.getGroupVisibility(userId, projectId); }
  async setGroupVisibility(data: Omit<GroupVisibilityRecord, 'id'>) { return inMemoryStore.setGroupVisibility(data); }
}

function isSqlEnabled(): boolean {
  return !!appConfig.databaseUrl;
}

export const dataStore: DataStore = isSqlEnabled() ? new SqlStore() : new AsyncInMemoryStore();
