/**
 * SQL-backed data store using Prisma ORM.
 * Implements the same interface as InMemoryStore but persists to Azure SQL.
 */
import { v4 as uuidv4 } from 'uuid';
import { getPrismaClient } from './prisma';
import type { TestCaseRecord, TestRunRecord, StepResultRecord, ProjectRecord, FeatureRecord, PhaseRecord, CommentRecord, AssignmentRecord, GroupVisibilityRecord } from './store';

export class SqlStore {
  private get db() {
    return getPrismaClient();
  }

  // --- Test Cases ---

  async createTestCase(data: Omit<TestCaseRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<TestCaseRecord> {
    const id = uuidv4();
    const record = await this.db.testCase.create({
      data: {
        id,
        name: data.name,
        description: data.description,
        preconditions: data.preconditions || null,
        passingCriteria: data.passingCriteria || null,
        tags: JSON.stringify(data.tags),
        flowData: data.flowData,
        status: data.status,
        projectId: data.projectId || null,
        features: {
          create: (data.featureIds || []).map(featureId => ({ id: uuidv4(), featureId })),
        },
        phases: {
          create: (data.phaseIds || []).map(phaseId => ({ id: uuidv4(), phaseId })),
        },
      },
      include: { features: true, phases: true },
    });
    return this.mapTestCase(record);
  }

  async getTestCase(id: string): Promise<TestCaseRecord | undefined> {
    const record = await this.db.testCase.findUnique({ where: { id }, include: { features: true, phases: true } });
    return record ? this.mapTestCase(record) : undefined;
  }

  async getAllTestCases(filters?: { status?: string; search?: string; projectId?: string }): Promise<TestCaseRecord[]> {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.projectId) where.projectId = filters.projectId;
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search } },
        { description: { contains: filters.search } },
      ];
    }

    const records = await this.db.testCase.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: { features: true, phases: true },
    });
    return records.map((r: any) => this.mapTestCase(r));
  }

  async updateTestCase(id: string, data: Partial<TestCaseRecord>): Promise<TestCaseRecord | undefined> {
    try {
      const updateData: any = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.preconditions !== undefined) updateData.preconditions = data.preconditions;
      if (data.passingCriteria !== undefined) updateData.passingCriteria = data.passingCriteria;
      if (data.tags !== undefined) updateData.tags = JSON.stringify(data.tags);
      if (data.flowData !== undefined) updateData.flowData = data.flowData;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.projectId !== undefined) updateData.projectId = data.projectId || null;

      // Sync feature junctions (delete all, re-create)
      if (data.featureIds !== undefined) {
        updateData.features = {
          deleteMany: {},
          create: data.featureIds.map(featureId => ({ id: uuidv4(), featureId })),
        };
      }
      // Sync phase junctions (delete all, re-create)
      if (data.phaseIds !== undefined) {
        updateData.phases = {
          deleteMany: {},
          create: data.phaseIds.map(phaseId => ({ id: uuidv4(), phaseId })),
        };
      }

      const record = await this.db.testCase.update({
        where: { id },
        data: updateData,
        include: { features: true, phases: true },
      });
      return this.mapTestCase(record);
    } catch {
      return undefined;
    }
  }

  async deleteTestCase(id: string): Promise<boolean> {
    try {
      await this.db.testCase.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  // --- Test Runs ---

  async createTestRun(data: Omit<TestRunRecord, 'id' | 'startedAt'>): Promise<TestRunRecord> {
    const record = await this.db.testRun.create({
      data: {
        id: uuidv4(),
        testCaseId: data.testCaseId,
        status: data.status,
        totalSteps: data.totalSteps,
        passedSteps: data.passedSteps,
        failedSteps: data.failedSteps,
        environment: data.environment || null,
      },
    });
    return this.mapTestRun(record);
  }

  async getTestRun(id: string): Promise<TestRunRecord | undefined> {
    const record = await this.db.testRun.findUnique({ where: { id } });
    return record ? this.mapTestRun(record) : undefined;
  }

  async getAllTestRuns(filters?: { testCaseId?: string; status?: string }): Promise<TestRunRecord[]> {
    const where: any = {};
    if (filters?.testCaseId) where.testCaseId = filters.testCaseId;
    if (filters?.status) where.status = filters.status;

    const records = await this.db.testRun.findMany({
      where,
      orderBy: { startedAt: 'desc' },
    });
    return records.map((r: any) => this.mapTestRun(r));
  }

  async updateTestRun(id: string, data: Partial<TestRunRecord>): Promise<TestRunRecord | undefined> {
    try {
      const updateData: any = {};
      if (data.status !== undefined) updateData.status = data.status;
      if (data.completedAt !== undefined) updateData.completedAt = new Date(data.completedAt);
      if (data.durationMs !== undefined) updateData.durationMs = data.durationMs;
      if (data.environment !== undefined) updateData.environment = data.environment;
      if (data.totalSteps !== undefined) updateData.totalSteps = data.totalSteps;
      if (data.passedSteps !== undefined) updateData.passedSteps = data.passedSteps;
      if (data.failedSteps !== undefined) updateData.failedSteps = data.failedSteps;

      const record = await this.db.testRun.update({
        where: { id },
        data: updateData,
      });
      return this.mapTestRun(record);
    } catch {
      return undefined;
    }
  }

  // --- Step Results ---

  async createStepResult(data: Omit<StepResultRecord, 'id' | 'executedAt'>): Promise<StepResultRecord> {
    // Upsert: if a "running" record exists for same testRunId + stepOrder + retry, update it
    const existing = await this.db.stepResult.findFirst({
      where: {
        testRunId: data.testRunId,
        stepOrder: data.stepOrder,
        retry: data.retry || false,
        status: 'running',
      },
    });

    if (existing) {
      const updated = await this.db.stepResult.update({
        where: { id: existing.id },
        data: {
          blockId: data.blockId,
          blockType: data.blockType,
          description: data.description || null,
          target: data.target || null,
          expectedResult: data.expectedResult || null,
          actualResult: data.actualResult || null,
          status: data.status,
          screenshotUrl: data.screenshotDataUrl || null,
          errorMessage: data.errorMessage || null,
          durationMs: data.durationMs || null,
          executedAt: new Date(),
        },
      });
      return this.mapStepResult(updated);
    }

    const record = await this.db.stepResult.create({
      data: {
        id: uuidv4(),
        testRunId: data.testRunId,
        stepOrder: data.stepOrder,
        blockId: data.blockId,
        blockType: data.blockType,
        description: data.description || null,
        target: data.target || null,
        expectedResult: data.expectedResult || null,
        actualResult: data.actualResult || null,
        status: data.status,
        screenshotUrl: data.screenshotDataUrl || null,
        errorMessage: data.errorMessage || null,
        durationMs: data.durationMs || null,
        retry: data.retry || false,
      },
    });
    return this.mapStepResult(record);
  }

  async getStepResultsForRun(testRunId: string): Promise<StepResultRecord[]> {
    const records = await this.db.stepResult.findMany({
      where: { testRunId },
      orderBy: { stepOrder: 'asc' },
    });
    return records.map((r: any) => this.mapStepResult(r));
  }

  // --- Mappers ---

  private mapTestCase(r: any): TestCaseRecord {
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      preconditions: r.preconditions || undefined,
      passingCriteria: r.passingCriteria || undefined,
      tags: typeof r.tags === 'string' ? JSON.parse(r.tags) : r.tags,
      flowData: r.flowData,
      status: r.status as any,
      projectId: r.projectId || undefined,
      featureIds: (r.features || []).map((f: any) => f.featureId),
      phaseIds: (r.phases || []).map((p: any) => p.phaseId),
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
      updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : r.updatedAt,
    };
  }

  private mapTestRun(r: any): TestRunRecord {
    return {
      id: r.id,
      testCaseId: r.testCaseId,
      status: r.status as any,
      startedAt: r.startedAt instanceof Date ? r.startedAt.toISOString() : r.startedAt,
      completedAt: r.completedAt instanceof Date ? r.completedAt.toISOString() : r.completedAt || undefined,
      durationMs: r.durationMs || undefined,
      environment: r.environment || undefined,
      totalSteps: r.totalSteps,
      passedSteps: r.passedSteps,
      failedSteps: r.failedSteps,
    };
  }

  private mapStepResult(r: any): StepResultRecord {
    return {
      id: r.id,
      testRunId: r.testRunId,
      stepOrder: r.stepOrder,
      blockId: r.blockId,
      blockType: r.blockType,
      description: r.description || undefined,
      target: r.target || undefined,
      expectedResult: r.expectedResult || undefined,
      actualResult: r.actualResult || undefined,
      status: r.status as any,
      screenshotDataUrl: r.screenshotUrl || undefined,
      errorMessage: r.errorMessage || undefined,
      durationMs: r.durationMs || undefined,
      retry: r.retry || undefined,
      executedAt: r.executedAt instanceof Date ? r.executedAt.toISOString() : r.executedAt,
    };
  }

  // --- Projects ---

  async createProject(data: Omit<ProjectRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProjectRecord> {
    const record = await this.db.project.create({
      data: { id: uuidv4(), name: data.name, description: data.description || null, createdBy: data.createdBy || null },
    });
    return this.mapProject(record);
  }

  async getProject(id: string): Promise<ProjectRecord | undefined> {
    const record = await this.db.project.findUnique({ where: { id } });
    return record ? this.mapProject(record) : undefined;
  }

  async getAllProjects(filters?: { search?: string }): Promise<ProjectRecord[]> {
    const where: any = {};
    if (filters?.search) {
      where.OR = [{ name: { contains: filters.search } }, { description: { contains: filters.search } }];
    }
    const records = await this.db.project.findMany({ where, orderBy: { updatedAt: 'desc' } });
    return records.map((r: any) => this.mapProject(r));
  }

  async updateProject(id: string, data: Partial<ProjectRecord>): Promise<ProjectRecord | undefined> {
    try {
      const updateData: any = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      const record = await this.db.project.update({ where: { id }, data: updateData });
      return this.mapProject(record);
    } catch { return undefined; }
  }

  async deleteProject(id: string): Promise<boolean> {
    try { await this.db.project.delete({ where: { id } }); return true; } catch { return false; }
  }

  // --- Features ---

  async createFeature(data: Omit<FeatureRecord, 'id' | 'createdAt'>): Promise<FeatureRecord> {
    const record = await this.db.feature.create({
      data: { id: uuidv4(), projectId: data.projectId, name: data.name, sortOrder: data.sortOrder },
    });
    return this.mapFeature(record);
  }

  async getFeaturesForProject(projectId: string): Promise<FeatureRecord[]> {
    const records = await this.db.feature.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } });
    return records.map((r: any) => this.mapFeature(r));
  }

  async updateFeature(id: string, data: Partial<FeatureRecord>): Promise<FeatureRecord | undefined> {
    try {
      const updateData: any = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
      const record = await this.db.feature.update({ where: { id }, data: updateData });
      return this.mapFeature(record);
    } catch { return undefined; }
  }

  async deleteFeature(id: string): Promise<boolean> {
    try { await this.db.feature.delete({ where: { id } }); return true; } catch { return false; }
  }

  // --- Phases ---

  async createPhase(data: Omit<PhaseRecord, 'id' | 'createdAt'>): Promise<PhaseRecord> {
    const record = await this.db.phase.create({
      data: { id: uuidv4(), projectId: data.projectId, name: data.name, sortOrder: data.sortOrder },
    });
    return this.mapPhase(record);
  }

  async getPhasesForProject(projectId: string): Promise<PhaseRecord[]> {
    const records = await this.db.phase.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } });
    return records.map((r: any) => this.mapPhase(r));
  }

  async updatePhase(id: string, data: Partial<PhaseRecord>): Promise<PhaseRecord | undefined> {
    try {
      const updateData: any = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
      const record = await this.db.phase.update({ where: { id }, data: updateData });
      return this.mapPhase(record);
    } catch { return undefined; }
  }

  async deletePhase(id: string): Promise<boolean> {
    try { await this.db.phase.delete({ where: { id } }); return true; } catch { return false; }
  }

  // --- Comments ---

  async createComment(data: Omit<CommentRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<CommentRecord> {
    const record = await this.db.comment.create({
      data: {
        id: uuidv4(),
        testCaseId: data.testCaseId,
        parentId: data.parentId || null,
        authorId: data.authorId,
        authorName: data.authorName || null,
        body: data.body,
      },
    });
    return this.mapComment(record);
  }

  async getCommentsForTestCase(testCaseId: string): Promise<CommentRecord[]> {
    const records = await this.db.comment.findMany({ where: { testCaseId }, orderBy: { createdAt: 'asc' } });
    return records.map((r: any) => this.mapComment(r));
  }

  async updateComment(id: string, data: Partial<CommentRecord>): Promise<CommentRecord | undefined> {
    try {
      const updateData: any = {};
      if (data.body !== undefined) updateData.body = data.body;
      const record = await this.db.comment.update({ where: { id }, data: updateData });
      return this.mapComment(record);
    } catch { return undefined; }
  }

  async deleteComment(id: string): Promise<boolean> {
    try { await this.db.comment.delete({ where: { id } }); return true; } catch { return false; }
  }

  // --- Assignments ---

  async createAssignment(data: Omit<AssignmentRecord, 'id' | 'assignedAt'>): Promise<AssignmentRecord> {
    const existing = await this.db.testCaseAssignment.findFirst({
      where: { testCaseId: data.testCaseId, userId: data.userId },
    });
    if (existing) return this.mapAssignment(existing);
    const record = await this.db.testCaseAssignment.create({
      data: {
        id: uuidv4(),
        testCaseId: data.testCaseId,
        userId: data.userId,
        userName: data.userName || null,
        assignedBy: data.assignedBy || null,
      },
    });
    return this.mapAssignment(record);
  }

  async getAssignmentsForTestCase(testCaseId: string): Promise<AssignmentRecord[]> {
    const records = await this.db.testCaseAssignment.findMany({ where: { testCaseId } });
    return records.map((r: any) => this.mapAssignment(r));
  }

  async deleteAssignment(testCaseId: string, userId: string): Promise<boolean> {
    try {
      const record = await this.db.testCaseAssignment.findFirst({ where: { testCaseId, userId } });
      if (!record) return false;
      await this.db.testCaseAssignment.delete({ where: { id: record.id } });
      return true;
    } catch { return false; }
  }

  // --- Group Visibility ---

  async getGroupVisibility(userId: string, projectId: string): Promise<GroupVisibilityRecord[]> {
    const records = await this.db.groupVisibility.findMany({ where: { userId, projectId } });
    return records.map((r: any) => this.mapGroupVisibility(r));
  }

  async setGroupVisibility(data: Omit<GroupVisibilityRecord, 'id'>): Promise<GroupVisibilityRecord> {
    const existing = await this.db.groupVisibility.findFirst({
      where: { userId: data.userId, projectId: data.projectId, groupType: data.groupType, groupId: data.groupId },
    });
    if (existing) {
      const updated = await this.db.groupVisibility.update({ where: { id: existing.id }, data: { isHidden: data.isHidden } });
      return this.mapGroupVisibility(updated);
    }
    const record = await this.db.groupVisibility.create({
      data: { id: uuidv4(), userId: data.userId, projectId: data.projectId, groupType: data.groupType, groupId: data.groupId, isHidden: data.isHidden },
    });
    return this.mapGroupVisibility(record);
  }

  // --- Additional Mappers ---

  private mapProject(r: any): ProjectRecord {
    return {
      id: r.id, name: r.name, description: r.description || undefined, createdBy: r.createdBy || undefined,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
      updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : r.updatedAt,
    };
  }

  private mapFeature(r: any): FeatureRecord {
    return {
      id: r.id, projectId: r.projectId, name: r.name, sortOrder: r.sortOrder,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    };
  }

  private mapPhase(r: any): PhaseRecord {
    return {
      id: r.id, projectId: r.projectId, name: r.name, sortOrder: r.sortOrder,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    };
  }

  private mapComment(r: any): CommentRecord {
    return {
      id: r.id, testCaseId: r.testCaseId, parentId: r.parentId || undefined,
      authorId: r.authorId, authorName: r.authorName || undefined, body: r.body,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
      updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : r.updatedAt,
    };
  }

  private mapAssignment(r: any): AssignmentRecord {
    return {
      id: r.id, testCaseId: r.testCaseId, userId: r.userId, userName: r.userName || undefined,
      assignedAt: r.assignedAt instanceof Date ? r.assignedAt.toISOString() : r.assignedAt,
      assignedBy: r.assignedBy || undefined,
    };
  }

  private mapGroupVisibility(r: any): GroupVisibilityRecord {
    return {
      id: r.id, userId: r.userId, projectId: r.projectId,
      groupType: r.groupType as any, groupId: r.groupId, isHidden: r.isHidden,
    };
  }
}
