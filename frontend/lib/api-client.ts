// API Client for ProScreen Backend
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class APIClient {
  private getHeaders(includeAuth: boolean = false) {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (includeAuth) {
      const token = localStorage.getItem('token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  async request(endpoint: string, options: RequestInit = {}, requiresAuth: boolean = false) {
    const url = `${API_URL}${endpoint}`;
    const headers = this.getHeaders(requiresAuth);

    const response = await fetch(url, {
      ...options,
      headers: { ...headers, ...options.headers },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Auth endpoints
  async register(email: string, password: string, fullName: string) {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, fullName }),
    });
  }

  async login(email: string, password: string) {
    const data = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (data.token) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    }

    return data;
  }

  async getCurrentUser() {
    return this.request('/api/auth/me', {}, true);
  }

  async getCredits() {
    return this.request('/api/auth/credits', {}, true);
  }

  // Recording endpoints
  async getPresignedUrl(fileName: string, fileType: string, recordingType: string) {
    return this.request('/api/recordings/presigned-url', {
      method: 'POST',
      body: JSON.stringify({ fileName, fileType, recordingType }),
    }, true);
  }

  async createRecording(data: any) {
    return this.request('/api/recordings', {
      method: 'POST',
      body: JSON.stringify(data),
    }, true);
  }

  async getRecordings(limit: number = 50, offset: number = 0) {
    return this.request(`/api/recordings?limit=${limit}&offset=${offset}`, {}, true);
  }

  async getRecording(id: string) {
    return this.request(`/api/recordings/${id}`, {}, true);
  }

  async updateRecording(id: string, data: any) {
    return this.request(`/api/recordings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }, true);
  }

  async deleteRecording(id: string) {
    return this.request(`/api/recordings/${id}`, {
      method: 'DELETE',
    }, true);
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  // Admin endpoints
  async getAdminStats() {
    return this.request('/api/admin/stats', {}, true);
  }

  async getAdminUsers(limit: number = 50, offset: number = 0, search: string = '', role: string = '') {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
      ...(search && { search }),
      ...(role && { role })
    });
    return this.request(`/api/admin/users?${params}`, {}, true);
  }

  async createAdminUser(data: { email: string; password: string; fullName: string; role?: string; creditsBalance?: number }) {
    return this.request('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }, true);
  }

  async updateAdminUser(id: string, data: { role?: string; creditsBalance?: number; emailVerified?: boolean }) {
    return this.request(`/api/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }, true);
  }

  async grantCredits(userId: string, amount: number, description?: string) {
    return this.request(`/api/admin/users/${userId}/credits`, {
      method: 'POST',
      body: JSON.stringify({ amount, description }),
    }, true);
  }

  async deleteAdminUser(id: string) {
    return this.request(`/api/admin/users/${id}`, {
      method: 'DELETE',
    }, true);
  }

  async getRevenue() {
    return this.request('/api/admin/revenue', {}, true);
  }

  async getActivity(limit: number = 50) {
    return this.request(`/api/admin/activity?limit=${limit}`, {}, true);
  }
}

export const apiClient = new APIClient();
