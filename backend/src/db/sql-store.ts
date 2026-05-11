/**
 * SQL-backed data store using Prisma ORM.
 * Implements the same interface as InMemoryStore but persists to Azure SQL.
 */
import { v4 as uuidv4 } from 'uuid';
import { getPrismaClient } from './prisma';
import type { TestCaseRecord, TestRunRecord, StepResultRecord } from './store';

export class SqlStore {
  private get db() {
    return getPrismaClient();
  }

  // --- Test Cases ---

  async createTestCase(data: Omit<TestCaseRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<TestCaseRecord> {
    const record = await this.db.testCase.create({
      data: {
        id: uuidv4(),
        name: data.name,
        description: data.description,
        preconditions: data.preconditions || null,
        passingCriteria: data.passingCriteria || null,
        tags: JSON.stringify(data.tags),
        flowData: data.flowData,
        status: data.status,
      },
    });
    return this.mapTestCase(record);
  }

  async getTestCase(id: string): Promise<TestCaseRecord | undefined> {
    const record = await this.db.testCase.findUnique({ where: { id } });
    return record ? this.mapTestCase(record) : undefined;
  }

  async getAllTestCases(filters?: { status?: string; search?: string }): Promise<TestCaseRecord[]> {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search } },
        { description: { contains: filters.search } },
      ];
    }

    const records = await this.db.testCase.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
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

      const record = await this.db.testCase.update({
        where: { id },
        data: updateData,
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
}
