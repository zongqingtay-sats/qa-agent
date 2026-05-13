/**
 * Typed REST API client for the QA Agent backend.
 *
 * Exports namespaced objects (`testCasesApi`, `projectsApi`, `adminApi`,
 * etc.) whose methods map 1-to-1 with backend endpoints.  All requests
 * go through a shared `request()` helper that handles JSON serialisation,
 * error parsing, and timeouts.
 *
 * @module api
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

import type {
  TestCase, ProjectTestCase, TestRunListItem, TestRunDetail, StepResult,
  Project, ProjectDetail, Feature, Phase, Comment, Assignment, GroupVisibility,
  AdminUser, Role, GeneratedTestCase,
  CreateTestCaseBody, UpdateTestCaseBody, UpdateTestRunBody,
} from '@/types/api';

/**
 * Send a JSON request to the backend and parse the response.
 *
 * Automatically prepends {@link API_BASE}, injects `Content-Type`,
 * applies a 120 s timeout, and throws on non-2xx responses.
 *
 * @typeParam T - Expected response body shape.
 * @param url     - Path relative to {@link API_BASE}.
 * @param options - Standard `fetch` options (method, body, headers…).
 * @returns The parsed JSON response.
 * @throws {Error} If the response is not OK or the request times out.
 */
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  const res = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    signal: controller.signal,
    ...options,
  });

  clearTimeout(timeout);

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(error.error?.message || `API error: ${res.status}`);
  }

  return res.json();
}

// Test Cases
export const testCasesApi = {
  list: (params?: { status?: string; search?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.search) searchParams.set('search', params.search);
    const qs = searchParams.toString();
    return request<{ data: TestCase[]; total: number }>(`/test-cases${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) => request<{ data: TestCase }>(`/test-cases/${encodeURIComponent(id)}`),
  create: (data: CreateTestCaseBody) => request<{ data: TestCase }>('/test-cases', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: UpdateTestCaseBody) => request<{ data: TestCase }>(`/test-cases/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<{ message: string }>(`/test-cases/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};

// Test Runs
export const testRunsApi = {
  list: (params?: { testCaseId?: string; status?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.testCaseId) searchParams.set('testCaseId', params.testCaseId);
    if (params?.status) searchParams.set('status', params.status);
    const qs = searchParams.toString();
    return request<{ data: TestRunListItem[]; total: number }>(`/test-runs${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) => request<{ data: TestRunDetail }>(`/test-runs/${encodeURIComponent(id)}`),
  create: (testCaseId: string) => request<{ data: TestRunListItem }>('/test-runs', { method: 'POST', body: JSON.stringify({ testCaseId }) }),
  update: (id: string, data: UpdateTestRunBody) => request<{ data: TestRunListItem }>(`/test-runs/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
};

// Import
export const importApi = {
  parse: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/import/parse`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error('Failed to parse file');
    return res.json();
  },
};

// Generate
export const generateApi = {
  fromRequirements: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/generate/from-requirements`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error('Failed to generate from requirements');
    return res.json();
  },
  fromText: (text: string, options?: { targetUrl?: string; pageHtml?: string }) =>
    request<{ data: { testCases: GeneratedTestCase[] } }>('/generate/from-text', { method: 'POST', body: JSON.stringify({ text, ...options }) }),
  fromSource: async (files: File[]) => {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    const res = await fetch(`${API_BASE}/generate/from-source`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error('Failed to generate from source');
    return res.json();
  },
  refine: (testCases: GeneratedTestCase[], pageContexts: { url: string; html: string }[], targetUrl?: string) =>
    request<{ data: { testCases: GeneratedTestCase[] } }>('/generate/refine', { method: 'POST', body: JSON.stringify({ testCases, pageContexts, targetUrl }) }),
};

// Export
export const exportApi = {
  testCase: async (id: string, format: 'json' | 'docx' | 'pdf') => {
    const res = await fetch(`${API_BASE}/export/test-case/${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format }),
    });
    if (!res.ok) throw new Error('Failed to export test case');
    return res.blob();
  },
  testRun: async (id: string, format: 'json' | 'docx' | 'pdf') => {
    const res = await fetch(`${API_BASE}/export/test-run/${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format }),
    });
    if (!res.ok) throw new Error('Failed to export test run');
    return res.blob();
  },
};

// Projects
export const projectsApi = {
  list: (params?: { search?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set('search', params.search);
    const qs = searchParams.toString();
    return request<{ data: Project[]; total: number }>(`/projects${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) => request<{ data: ProjectDetail }>(`/projects/${encodeURIComponent(id)}`),
  create: (data: { name: string; description?: string }) =>
    request<{ data: Project }>('/projects', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { name?: string; description?: string }) =>
    request<{ data: Project }>(`/projects/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<{ message: string }>(`/projects/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  getTestCases: (id: string, params?: { search?: string; status?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set('search', params.search);
    if (params?.status) searchParams.set('status', params.status);
    const qs = searchParams.toString();
    return request<{ data: ProjectTestCase[]; total: number }>(`/projects/${encodeURIComponent(id)}/test-cases${qs ? `?${qs}` : ''}`);
  },
  // Features
  getFeatures: (projectId: string) =>
    request<{ data: Feature[] }>(`/projects/${encodeURIComponent(projectId)}/features`),
  createFeature: (projectId: string, data: { name: string; sortOrder?: number }) =>
    request<{ data: Feature }>(`/projects/${encodeURIComponent(projectId)}/features`, { method: 'POST', body: JSON.stringify(data) }),
  updateFeature: (id: string, data: { name?: string; sortOrder?: number }) =>
    request<{ data: Feature }>(`/projects/features/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteFeature: (id: string) =>
    request<{ message: string }>(`/projects/features/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  // Phases
  getPhases: (projectId: string) =>
    request<{ data: Phase[] }>(`/projects/${encodeURIComponent(projectId)}/phases`),
  createPhase: (projectId: string, data: { name: string; sortOrder?: number }) =>
    request<{ data: Phase }>(`/projects/${encodeURIComponent(projectId)}/phases`, { method: 'POST', body: JSON.stringify(data) }),
  updatePhase: (id: string, data: { name?: string; sortOrder?: number }) =>
    request<{ data: Phase }>(`/projects/phases/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePhase: (id: string) =>
    request<{ message: string }>(`/projects/phases/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  // Visibility
  getVisibility: (projectId: string) =>
    request<{ data: GroupVisibility[] }>(`/projects/${encodeURIComponent(projectId)}/visibility`),
  setVisibility: (projectId: string, data: { groupType: string; groupId: string; isHidden: boolean }) =>
    request<{ data: GroupVisibility }>(`/projects/${encodeURIComponent(projectId)}/visibility`, { method: 'PUT', body: JSON.stringify(data) }),
};

// Comments
export const commentsApi = {
  list: (testCaseId: string) =>
    request<{ data: Comment[] }>(`/test-cases/${encodeURIComponent(testCaseId)}/comments`),
  create: (testCaseId: string, data: { body: string; parentId?: string }) =>
    request<{ data: Comment }>(`/test-cases/${encodeURIComponent(testCaseId)}/comments`, { method: 'POST', body: JSON.stringify(data) }),
  update: (commentId: string, data: { body: string }) =>
    request<{ data: Comment }>(`/test-cases/comments/${encodeURIComponent(commentId)}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (commentId: string) =>
    request<{ message: string }>(`/test-cases/comments/${encodeURIComponent(commentId)}`, { method: 'DELETE' }),
};

// Assignments
export const assignmentsApi = {
  list: (testCaseId: string) =>
    request<{ data: Assignment[] }>(`/test-cases/${encodeURIComponent(testCaseId)}/assignees`),
  assign: (testCaseId: string, userIds: string[], userNames?: string[]) =>
    request<{ data: Assignment[] }>(`/test-cases/${encodeURIComponent(testCaseId)}/assignees`, { method: 'POST', body: JSON.stringify({ userIds, userNames }) }),
  remove: (testCaseId: string, userId: string) =>
    request<{ message: string }>(`/test-cases/${encodeURIComponent(testCaseId)}/assignees/${encodeURIComponent(userId)}`, { method: 'DELETE' }),
  bulkAssign: (testCaseIds: string[], userIds: string[], userNames?: string[]) =>
    request<{ data: Assignment[] }>('/test-cases/bulk-assign', { method: 'POST', body: JSON.stringify({ testCaseIds, userIds, userNames }) }),
};

// Users
export const usersApi = {
  search: (search?: string) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    const qs = params.toString();
    return request<{ data: { id: string; name: string | null; email: string | null; image: string | null }[] }>(`/users${qs ? `?${qs}` : ''}`);
  },
};

// Admin — Roles & User Management
export const adminApi = {
  // Current user
  me: () => request<{ data: { role: Role | null; projectIds: string[] } }>('/admin/me'),

  // Roles
  listRoles: () => request<{ data: Role[] }>('/admin/roles'),
  getRole: (id: string) => request<{ data: Role }>(`/admin/roles/${encodeURIComponent(id)}`),
  createRole: (data: { name: string; description?: string; isAdmin?: boolean; projectPerms?: number; testcasePerms?: number; testrunPerms?: number; userPerms?: number; importPerms?: number; generatePerms?: number }) =>
    request<{ data: Role }>('/admin/roles', { method: 'POST', body: JSON.stringify(data) }),
  updateRole: (id: string, data: Partial<Omit<Role, 'id' | 'createdAt' | 'status'>>) =>
    request<{ data: Role }>(`/admin/roles/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteRole: (id: string) =>
    request<{ message: string }>(`/admin/roles/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  getPermissionBits: () =>
    request<{ data: { bits: Record<string, number>; permissions: { name: string; resource: string; bit: number }[] } }>('/admin/roles/permissions'),

  // Users with roles
  listUsers: () => request<{ data: AdminUser[] }>('/admin/users'),
  createUser: (data: { name?: string; email: string; roleId?: string }) =>
    request<{ data: AdminUser }>('/admin/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (userId: string, data: { name?: string; email?: string }) =>
    request<{ data: AdminUser }>(`/admin/users/${encodeURIComponent(userId)}`, { method: 'PUT', body: JSON.stringify(data) }),
  setUserRole: (userId: string, roleId: string) =>
    request<{ data: AdminUser }>(`/admin/users/${encodeURIComponent(userId)}/role`, { method: 'PUT', body: JSON.stringify({ roleId }) }),
  removeUserRole: (userId: string) =>
    request<{ data: AdminUser }>(`/admin/users/${encodeURIComponent(userId)}/role`, { method: 'DELETE' }),
  deleteUser: (userId: string) =>
    request<{ message: string }>(`/admin/users/${encodeURIComponent(userId)}`, { method: 'DELETE' }),

  // Project access
  getProjectAccess: (projectId: string) =>
    request<{ data: { userId: string; userName: string; projectId: string }[] }>(`/admin/projects/${encodeURIComponent(projectId)}/access`),
  grantProjectAccess: (projectId: string, userId: string) =>
    request<{ data: { userId: string; userName: string; projectId: string } }>(`/admin/projects/${encodeURIComponent(projectId)}/access`, { method: 'POST', body: JSON.stringify({ userId }) }),
  revokeProjectAccess: (projectId: string, userId: string) =>
    request<{ message: string }>(`/admin/projects/${encodeURIComponent(projectId)}/access/${encodeURIComponent(userId)}`, { method: 'DELETE' }),
};
