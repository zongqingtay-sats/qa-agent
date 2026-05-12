import { getSession } from "next-auth/react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const session = await getSession();
    if (session?.accessToken) {
      return { Authorization: `Bearer ${session.accessToken}` };
    }
  } catch {}
  return {};
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  const authHeaders = await getAuthHeaders();

  const res = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
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
    const authHeaders = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/import/parse`, { method: 'POST', body: formData, headers: authHeaders });
    if (!res.ok) throw new Error('Failed to parse file');
    return res.json();
  },
};

// Generate
export const generateApi = {
  fromRequirements: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const authHeaders = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/generate/from-requirements`, { method: 'POST', body: formData, headers: authHeaders });
    if (!res.ok) throw new Error('Failed to generate from requirements');
    return res.json();
  },
  fromText: (text: string, options?: { targetUrl?: string; pageHtml?: string }) =>
    request<{ data: { testCases: any[] } }>('/generate/from-text', { method: 'POST', body: JSON.stringify({ text, ...options }) }),
  fromSource: async (files: File[]) => {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    const authHeaders = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/generate/from-source`, { method: 'POST', body: formData, headers: authHeaders });
    if (!res.ok) throw new Error('Failed to generate from source');
    return res.json();
  },
  refine: (testCases: any[], pageContexts: { url: string; html: string }[], targetUrl?: string) =>
    request<{ data: { testCases: any[] } }>('/generate/refine', { method: 'POST', body: JSON.stringify({ testCases, pageContexts, targetUrl }) }),
};

// Export
export const exportApi = {
  testCase: async (id: string, format: 'json' | 'docx' | 'pdf') => {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/export/test-case/${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ format }),
    });
    if (!res.ok) throw new Error('Failed to export test case');
    return res.blob();
  },
  testRun: async (id: string, format: 'json' | 'docx' | 'pdf') => {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/export/test-run/${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
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
