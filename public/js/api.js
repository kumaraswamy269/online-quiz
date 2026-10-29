/**
 * Online Quiz System - Client API Module
 * Handles AJAX requests with JWT Bearer tokens and error normalization
 */

const API_BASE = '/api';

const api = {
  getToken() {
    return localStorage.getItem('token');
  },

  setToken(token) {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  },

  getCurrentUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  setCurrentUser(user) {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
  },

  async request(endpoint, options = {}) {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    };

    const config = {
      ...options,
      headers,
    };

    const response = await fetch(`${API_BASE}${endpoint}`, config);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(data.message || `Request failed with status ${response.status}`);
      error.status = response.status;
      error.details = data.details;
      throw error;
    }

    return data;
  },

  // Authentication
  async register(name, email, password, role = 'student') {
    const res = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, role }),
    });
    if (res.data && res.data.token) {
      this.setToken(res.data.token);
      this.setCurrentUser(res.data.user);
    }
    return res;
  },

  async login(email, password) {
    const res = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (res.data && res.data.token) {
      this.setToken(res.data.token);
      this.setCurrentUser(res.data.user);
    }
    return res;
  },

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      this.setToken(null);
      this.setCurrentUser(null);
    }
  },

  async getMe() {
    return await this.request('/auth/me');
  },

  // Quizzes
  async getQuizzes(search = '') {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    return await this.request(`/quizzes${query}`);
  },

  async getQuiz(id) {
    return await this.request(`/quizzes/${id}`);
  },

  // Attempts
  async startQuiz(quizId) {
    return await this.request(`/quizzes/${quizId}/start`, { method: 'POST' });
  },

  async getAttempt(attemptId) {
    return await this.request(`/attempts/${attemptId}`);
  },

  async saveAnswer(attemptId, questionId, selectedOptionId) {
    return await this.request(`/attempts/${attemptId}/answers`, {
      method: 'PUT',
      body: JSON.stringify({ questionId, selectedOptionId }),
    });
  },

  async submitQuiz(attemptId, answers = null) {
    return await this.request(`/attempts/${attemptId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    });
  },

  async getResult(attemptId) {
    return await this.request(`/attempts/${attemptId}/result`);
  },

  async getMyResults() {
    return await this.request('/my-results');
  },

  // Admin APIs
  async getAdminDashboard() {
    return await this.request('/admin/dashboard');
  },

  async getAdminQuizzes() {
    return await this.request('/admin/quizzes');
  },

  async getAdminQuizDetail(id) {
    return await this.request(`/admin/quizzes/${id}`);
  },

  async createQuiz(data) {
    return await this.request('/admin/quizzes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateQuiz(id, data) {
    return await this.request(`/admin/quizzes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteQuiz(id) {
    return await this.request(`/admin/quizzes/${id}`, { method: 'DELETE' });
  },

  async togglePublish(id, is_published) {
    return await this.request(`/admin/quizzes/${id}/publish`, {
      method: 'PATCH',
      body: JSON.stringify({ is_published }),
    });
  },

  async addQuestion(quizId, data) {
    return await this.request(`/admin/quizzes/${quizId}/questions`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async deleteQuestion(questionId) {
    return await this.request(`/admin/questions/${questionId}`, { method: 'DELETE' });
  },

  async getAdminResults(filters = {}) {
    const params = new URLSearchParams(filters);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return await this.request(`/admin/results${qs}`);
  },

  async getAdminStudents() {
    return await this.request('/admin/students');
  },
};

window.api = api;
