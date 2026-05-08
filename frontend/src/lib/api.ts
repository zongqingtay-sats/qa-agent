const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

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
  fromText: (text: string) =>
    request<{ data: { testCases: any[] } }>('/generate/from-text', { method: 'POST', body: JSON.stringify({ text }) }),
  fromSource: async (files: File[]) => {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    const res = await fetch(`${API_BASE}/generate/from-source`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error('Failed to generate from source');
    return res.json();
  },
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
