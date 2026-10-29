import { 
  Category, 
  Quiz, 
  ActiveSessionData, 
  GradedResult, 
  FullReviewResult, 
  QuestionAnalytics 
} from '../types/quiz.ts';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });

  const json = await res.json();
  if (!res.ok || json.success === false) {
    const errorMsg = json.error || `Request failed with status ${res.status}`;
    const err = new Error(errorMsg) as any;
    err.status = res.status;
    err.details = json;
    throw err;
  }

  return json.data !== undefined ? json.data : json;
}

export const api = {
  // Public Quizzes & Categories
  async getCategories(): Promise<Category[]> {
    return fetchJson<Category[]>('/api/categories');
  },

  async getQuizzes(params?: { category?: string; difficulty?: string; search?: string; topic?: string }): Promise<Quiz[]> {
    const query = new URLSearchParams();
    if (params?.category) query.set('category', params.category);
    if (params?.difficulty) query.set('difficulty', params.difficulty);
    if (params?.search) query.set('search', params.search);
    if (params?.topic) query.set('topic', params.topic);
    const qs = query.toString();
    return fetchJson<Quiz[]>(`/api/quizzes${qs ? `?${qs}` : ''}`);
  },

  async getQuiz(id: number): Promise<Quiz & { leaderboard: any[] }> {
    return fetchJson<Quiz & { leaderboard: any[] }>(`/api/quizzes/${id}`);
  },

  // Active Quiz Session & Server Timing
  async startQuiz(quizId: number, userName: string, userEmail: string): Promise<ActiveSessionData> {
    return fetchJson<ActiveSessionData>('/api/attempts/start', {
      method: 'POST',
      body: JSON.stringify({ quizId, userName, userEmail }),
    });
  },

  async getActiveSession(sessionToken: string): Promise<ActiveSessionData> {
    return fetchJson<ActiveSessionData>(`/api/attempts/${sessionToken}/active`);
  },

  async saveAnswer(sessionToken: string, questionId: number, selectedOptionId: number | null): Promise<{ saved: boolean; remainingSeconds: number }> {
    return fetchJson<{ saved: boolean; remainingSeconds: number }>(`/api/attempts/${sessionToken}/save-answer`, {
      method: 'POST',
      body: JSON.stringify({ questionId, selectedOptionId }),
    });
  },

  async submitQuiz(sessionToken: string, answers?: Record<number, number>): Promise<GradedResult> {
    return fetchJson<GradedResult>(`/api/attempts/${sessionToken}/submit`, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    });
  },

  async getAttemptResult(sessionToken: string): Promise<FullReviewResult> {
    return fetchJson<FullReviewResult>(`/api/attempts/${sessionToken}/result`);
  },

  // Admin APIs
  async getAdminOverview(): Promise<any> {
    return fetchJson<any>('/api/admin/overview');
  },

  async getAdminQuizzes(): Promise<any[]> {
    return fetchJson<any[]>('/api/admin/quizzes');
  },

  async getAdminQuizDetail(id: number): Promise<any> {
    return fetchJson<any>(`/api/admin/quizzes/${id}`);
  },

  async createQuiz(quizData: any): Promise<{ id: number }> {
    return fetchJson<{ id: number }>('/api/admin/quizzes', {
      method: 'POST',
      body: JSON.stringify(quizData),
    });
  },

  async updateQuiz(id: number, quizData: any): Promise<void> {
    return fetchJson<void>(`/api/admin/quizzes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(quizData),
    });
  },

  async deleteQuiz(id: number): Promise<void> {
    return fetchJson<void>(`/api/admin/quizzes/${id}`, {
      method: 'DELETE',
    });
  },

  async addQuestion(quizId: number, questionData: any): Promise<{ questionId: number }> {
    return fetchJson<{ questionId: number }>(`/api/admin/quizzes/${quizId}/questions`, {
      method: 'POST',
      body: JSON.stringify(questionData),
    });
  },

  async deleteQuestion(questionId: number): Promise<void> {
    return fetchJson<void>(`/api/admin/questions/${questionId}`, {
      method: 'DELETE',
    });
  },

  async getQuestionAnalytics(quizId: number): Promise<QuestionAnalytics[]> {
    return fetchJson<QuestionAnalytics[]>(`/api/admin/questions/analytics/${quizId}`);
  },

  async runSqlQuery(sql: string): Promise<{ rows: any[]; rowCount: number; executionTimeMs: number }> {
    return fetchJson<{ rows: any[]; rowCount: number; executionTimeMs: number }>('/api/admin/sql-console', {
      method: 'POST',
      body: JSON.stringify({ sql }),
    });
  },

  async resetSeedDatabase(): Promise<void> {
    return fetchJson<void>('/api/admin/seed-reset', {
      method: 'POST',
    });
  },

  // Advanced Examination & Proctoring Features
  async recordProctorEvent(sessionToken: string): Promise<{ recorded: boolean; count: number }> {
    return fetchJson<{ recorded: boolean; count: number }>(`/api/attempts/${sessionToken}/proctor-event`, {
      method: 'POST',
    });
  },

  async verifyCertificate(code: string): Promise<any> {
    return fetchJson<any>(`/api/certificates/verify/${encodeURIComponent(code.trim().toUpperCase())}`);
  },

  async exportQuestions(quizId: number): Promise<any> {
    return fetchJson<any>(`/api/admin/quizzes/${quizId}/export`);
  },

  async importQuestions(quizId: number, questions: any[]): Promise<{ count: number; message: string }> {
    return fetchJson<{ count: number; message: string }>(`/api/admin/quizzes/${quizId}/import`, {
      method: 'POST',
      body: JSON.stringify({ questions }),
    });
  },

  async getMyResults(): Promise<any[]> {
    return fetchJson<any[]>('/api/my-results');
  },

  // Interactive Practice / Study Mode Answer Check
  async checkPracticeAnswer(
    quizId: number,
    questionId: number,
    selectedOptionId: number
  ): Promise<{
    questionId: number;
    selectedOptionId: number;
    isCorrect: boolean;
    correctOptionId: number;
    correctOptionText: string;
    explanation: string;
    points: number;
  }> {
    return fetchJson<{
      questionId: number;
      selectedOptionId: number;
      isCorrect: boolean;
      correctOptionId: number;
      correctOptionText: string;
      explanation: string;
      points: number;
    }>(`/api/quizzes/${quizId}/practice-check`, {
      method: 'POST',
      body: JSON.stringify({ questionId, selectedOptionId }),
    });
  },

  // Admin: Proctoring Surveillance Logs
  async getProctoringLogs(): Promise<{
    attempts: any[];
    totalFlagged: number;
    totalMonitored: number;
  }> {
    return fetchJson<{
      attempts: any[];
      totalFlagged: number;
      totalMonitored: number;
    }>('/api/admin/proctoring-logs');
  },
};

