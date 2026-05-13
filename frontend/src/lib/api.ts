const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

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
    return request<{ data: any[]; total: number }>(`/test-cases${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) => request<{ data: any }>(`/test-cases/${encodeURIComponent(id)}`),
  create: (data: any) => request<{ data: any }>('/test-cases', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<{ data: any }>(`/test-cases/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<{ message: string }>(`/test-cases/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};

// Test Runs
export const testRunsApi = {
  list: (params?: { testCaseId?: string; status?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.testCaseId) searchParams.set('testCaseId', params.testCaseId);
    if (params?.status) searchParams.set('status', params.status);
    const qs = searchParams.toString();
    return request<{ data: any[]; total: number }>(`/test-runs${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) => request<{ data: any }>(`/test-runs/${encodeURIComponent(id)}`),
  create: (testCaseId: string) => request<{ data: any }>('/test-runs', { method: 'POST', body: JSON.stringify({ testCaseId }) }),
  update: (id: string, data: any) => request<{ data: any }>(`/test-runs/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
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
    request<{ data: { testCases: any[] } }>('/generate/from-text', { method: 'POST', body: JSON.stringify({ text, ...options }) }),
  fromSource: async (files: File[]) => {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    const res = await fetch(`${API_BASE}/generate/from-source`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error('Failed to generate from source');
    return res.json();
  },
  refine: (testCases: any[], pageContexts: { url: string; html: string }[], targetUrl?: string) =>
    request<{ data: { testCases: any[] } }>('/generate/refine', { method: 'POST', body: JSON.stringify({ testCases, pageContexts, targetUrl }) }),
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
    return request<{ data: any[]; total: number }>(`/projects${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) => request<{ data: any }>(`/projects/${encodeURIComponent(id)}`),
  create: (data: { name: string; description?: string }) =>
    request<{ data: any }>('/projects', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { name?: string; description?: string }) =>
    request<{ data: any }>(`/projects/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<{ message: string }>(`/projects/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  getTestCases: (id: string, params?: { search?: string; status?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set('search', params.search);
    if (params?.status) searchParams.set('status', params.status);
    const qs = searchParams.toString();
    return request<{ data: any[]; total: number }>(`/projects/${encodeURIComponent(id)}/test-cases${qs ? `?${qs}` : ''}`);
  },
  // Features
  getFeatures: (projectId: string) =>
    request<{ data: any[] }>(`/projects/${encodeURIComponent(projectId)}/features`),
  createFeature: (projectId: string, data: { name: string; sortOrder?: number }) =>
    request<{ data: any }>(`/projects/${encodeURIComponent(projectId)}/features`, { method: 'POST', body: JSON.stringify(data) }),
  updateFeature: (id: string, data: { name?: string; sortOrder?: number }) =>
    request<{ data: any }>(`/projects/features/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteFeature: (id: string) =>
    request<{ message: string }>(`/projects/features/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  // Phases
  getPhases: (projectId: string) =>
    request<{ data: any[] }>(`/projects/${encodeURIComponent(projectId)}/phases`),
  createPhase: (projectId: string, data: { name: string; sortOrder?: number }) =>
    request<{ data: any }>(`/projects/${encodeURIComponent(projectId)}/phases`, { method: 'POST', body: JSON.stringify(data) }),
  updatePhase: (id: string, data: { name?: string; sortOrder?: number }) =>
    request<{ data: any }>(`/projects/phases/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePhase: (id: string) =>
    request<{ message: string }>(`/projects/phases/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  // Visibility
  getVisibility: (projectId: string) =>
    request<{ data: any[] }>(`/projects/${encodeURIComponent(projectId)}/visibility`),
  setVisibility: (projectId: string, data: { groupType: string; groupId: string; isHidden: boolean }) =>
    request<{ data: any }>(`/projects/${encodeURIComponent(projectId)}/visibility`, { method: 'PUT', body: JSON.stringify(data) }),
};

// Comments
export const commentsApi = {
  list: (testCaseId: string) =>
    request<{ data: any[] }>(`/test-cases/${encodeURIComponent(testCaseId)}/comments`),
  create: (testCaseId: string, data: { body: string; parentId?: string }) =>
    request<{ data: any }>(`/test-cases/${encodeURIComponent(testCaseId)}/comments`, { method: 'POST', body: JSON.stringify(data) }),
  update: (commentId: string, data: { body: string }) =>
    request<{ data: any }>(`/test-cases/comments/${encodeURIComponent(commentId)}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (commentId: string) =>
    request<{ message: string }>(`/test-cases/comments/${encodeURIComponent(commentId)}`, { method: 'DELETE' }),
};

// Assignments
export const assignmentsApi = {
  list: (testCaseId: string) =>
    request<{ data: any[] }>(`/test-cases/${encodeURIComponent(testCaseId)}/assignees`),
  assign: (testCaseId: string, userIds: string[], userNames?: string[]) =>
    request<{ data: any[] }>(`/test-cases/${encodeURIComponent(testCaseId)}/assignees`, { method: 'POST', body: JSON.stringify({ userIds, userNames }) }),
  remove: (testCaseId: string, userId: string) =>
    request<{ message: string }>(`/test-cases/${encodeURIComponent(testCaseId)}/assignees/${encodeURIComponent(userId)}`, { method: 'DELETE' }),
  bulkAssign: (testCaseIds: string[], userIds: string[], userNames?: string[]) =>
    request<{ data: any[] }>('/test-cases/bulk-assign', { method: 'POST', body: JSON.stringify({ testCaseIds, userIds, userNames }) }),
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
  me: () => request<{ data: { role: any; projectIds: string[] } }>('/admin/me'),

  // Roles
  listRoles: () => request<{ data: any[] }>('/admin/roles'),
  getRole: (id: string) => request<{ data: any }>(`/admin/roles/${encodeURIComponent(id)}`),
  createRole: (data: { name: string; description?: string; isAdmin?: boolean; projectPerms?: number; testcasePerms?: number; testrunPerms?: number; userPerms?: number; importPerms?: number; generatePerms?: number }) =>
    request<{ data: any }>('/admin/roles', { method: 'POST', body: JSON.stringify(data) }),
  updateRole: (id: string, data: Record<string, any>) =>
    request<{ data: any }>(`/admin/roles/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteRole: (id: string) =>
    request<{ message: string }>(`/admin/roles/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  getPermissionBits: () =>
    request<{ data: { bits: Record<string, number>; permissions: { name: string; resource: string; bit: number }[] } }>('/admin/roles/permissions'),

  // Users with roles
  listUsers: () => request<{ data: any[] }>('/admin/users'),
  createUser: (data: { name?: string; email: string; roleId?: string }) =>
    request<{ data: any }>('/admin/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (userId: string, data: { name?: string; email?: string }) =>
    request<{ data: any }>(`/admin/users/${encodeURIComponent(userId)}`, { method: 'PUT', body: JSON.stringify(data) }),
  setUserRole: (userId: string, roleId: string) =>
    request<{ data: any }>(`/admin/users/${encodeURIComponent(userId)}/role`, { method: 'PUT', body: JSON.stringify({ roleId }) }),
  removeUserRole: (userId: string) =>
    request<{ data: any }>(`/admin/users/${encodeURIComponent(userId)}/role`, { method: 'DELETE' }),
  deleteUser: (userId: string) =>
    request<{ message: string }>(`/admin/users/${encodeURIComponent(userId)}`, { method: 'DELETE' }),

  // Project access
  getProjectAccess: (projectId: string) =>
    request<{ data: any[] }>(`/admin/projects/${encodeURIComponent(projectId)}/access`),
  grantProjectAccess: (projectId: string, userId: string) =>
    request<{ data: any }>(`/admin/projects/${encodeURIComponent(projectId)}/access`, { method: 'POST', body: JSON.stringify({ userId }) }),
  revokeProjectAccess: (projectId: string, userId: string) =>
    request<{ message: string }>(`/admin/projects/${encodeURIComponent(projectId)}/access/${encodeURIComponent(userId)}`, { method: 'DELETE' }),
};
