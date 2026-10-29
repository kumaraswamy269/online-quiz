import React, { useState, useEffect } from 'react';
import { Quiz, Category, QuestionAnalytics } from '../types/quiz.ts';
import { api } from '../services/api.ts';
import { 
  Settings, 
  Plus, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  BarChart3, 
  Layers, 
  HelpCircle, 
  Save, 
  RotateCcw,
  Sparkles,
  TrendingDown,
  X,
  Radio,
  FileQuestion,
  Download,
  Upload,
  FileText,
  ShieldCheck,
  ShieldAlert,
  Eye,
  FileSpreadsheet
} from 'lucide-react';

interface AdminDashboardProps {
  categories: Category[];
  onQuizDataChanged: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  categories,
  onQuizDataChanged,
}) => {
  const [activeTab, setActiveTab] = useState<'quizzes' | 'questions' | 'analytics' | 'attempts' | 'proctoring'>('quizzes');
  
  // Data states
  const [overview, setOverview] = useState<any>(null);
  const [adminQuizzes, setAdminQuizzes] = useState<any[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState<number | null>(null);
  const [selectedQuizDetails, setSelectedQuizDetails] = useState<any>(null);
  const [analytics, setAnalytics] = useState<QuestionAnalytics[]>([]);
  const [proctorLogs, setProctorLogs] = useState<any[]>([]);
  const [proctorSummary, setProctorSummary] = useState<{ totalFlagged: number; totalMonitored: number }>({ totalFlagged: 0, totalMonitored: 0 });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal / Form states
  const [showCreateQuizModal, setShowCreateQuizModal] = useState<boolean>(false);
  const [showAddQuestionModal, setShowAddQuestionModal] = useState<boolean>(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState<boolean>(false);
  const [bulkImportJson, setBulkImportJson] = useState<string>('');
  const [bulkImportError, setBulkImportError] = useState<string | null>(null);
  const [isBulkImporting, setIsBulkImporting] = useState<boolean>(false);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);

  // New Quiz Form state
  const [newQuizTitle, setNewQuizTitle] = useState('');
  const [newQuizTopic, setNewQuizTopic] = useState('');
  const [newQuizDesc, setNewQuizDesc] = useState('');
  const [newQuizCategory, setNewQuizCategory] = useState<number>(categories[0]?.id || 1);
  const [newQuizTimeLimit, setNewQuizTimeLimit] = useState<number>(300);
  const [newQuizPassPct, setNewQuizPassPct] = useState<number>(75);
  const [newQuizDifficulty, setNewQuizDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [newQuizNegativeMarking, setNewQuizNegativeMarking] = useState<number>(0.0);
  const [newQuizShuffle, setNewQuizShuffle] = useState<boolean>(true);


  // New Question Form state
  const [newQText, setNewQText] = useState('');
  const [newQExplanation, setNewQExplanation] = useState('');
  const [newQPoints, setNewQPoints] = useState<number>(2);
  const [newQOptions, setNewQOptions] = useState<Array<{ text: string; isCorrect: boolean }>>([
    { text: '', isCorrect: true },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
  ]);

  // Load Overview & Quizzes
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [overviewData, quizzesData] = await Promise.all([
        api.getAdminOverview(),
        api.getAdminQuizzes(),
      ]);
      setOverview(overviewData);
      setAdminQuizzes(quizzesData);
      if (quizzesData.length > 0 && !selectedQuizId) {
        setSelectedQuizId(quizzesData[0].id);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to load admin data.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // When selectedQuizId changes, load its questions and analytics
  useEffect(() => {
    if (!selectedQuizId) return;

    const loadQuizDetails = async () => {
      try {
        const [details, analyticsData] = await Promise.all([
          api.getAdminQuizDetail(selectedQuizId),
          api.getQuestionAnalytics(selectedQuizId),
        ]);
        setSelectedQuizDetails(details);
        setAnalytics(analyticsData);
      } catch (err: any) {
        console.error('Failed to load quiz details:', err);
      }
    };

    loadQuizDetails();
  }, [selectedQuizId]);

  // Load Proctoring Audit Logs
  const loadProctorLogs = async () => {
    try {
      const data = await api.getProctoringLogs();
      setProctorLogs(data.attempts || []);
      setProctorSummary({
        totalFlagged: data.totalFlagged || 0,
        totalMonitored: data.totalMonitored || 0,
      });
    } catch (err: any) {
      console.error('Failed to load proctoring logs:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'proctoring') {
      loadProctorLogs();
    }
  }, [activeTab]);

  const downloadAttemptsCsv = () => {
    const link = document.createElement('a');
    link.href = '/api/admin/export/attempts-csv';
    link.setAttribute('download', 'quizpulse_attempts_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadLeaderboardCsv = () => {
    const link = document.createElement('a');
    link.href = '/api/admin/export/leaderboard-csv';
    link.setAttribute('download', 'quizpulse_leaderboard_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle Create Quiz
  const handleCreateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createQuiz({
        categoryId: newQuizCategory,
        title: newQuizTitle,
        topic: newQuizTopic || undefined,
        description: newQuizDesc,
        timeLimitSeconds: newQuizTimeLimit,
        passPercentage: newQuizPassPct,
        difficulty: newQuizDifficulty,
        negative_marking_rate: newQuizNegativeMarking,
        shuffle_questions: newQuizShuffle ? 1 : 0,
        isPublished: 1,
      });
      setShowCreateQuizModal(false);
      setNewQuizTitle('');
      setNewQuizTopic('');
      setNewQuizDesc('');
      setNewQuizNegativeMarking(0.0);
      setNewQuizShuffle(true);
      setMessage({ type: 'success', text: 'New quiz created successfully with configured timing and scoring rules.' });
      await loadData();
      onQuizDataChanged();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to create quiz.' });
    }
  };

  // Export questions for selected quiz
  const handleExportQuestions = async () => {
    if (!selectedQuizId) return;
    try {
      const data = await api.exportQuestions(selectedQuizId);
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quiz_${selectedQuizId}_questions_export.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setMessage({ type: 'success', text: 'Questions successfully exported as JSON file.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to export questions.' });
    }
  };

  // Bulk import questions
  const handleBulkImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuizId) return;
    setBulkImportError(null);
    setIsBulkImporting(true);

    try {
      const parsed = JSON.parse(bulkImportJson);
      const questionsList = Array.isArray(parsed) ? parsed : (parsed.questions || []);
      if (!Array.isArray(questionsList) || questionsList.length === 0) {
        throw new Error('Payload must contain an array of questions.');
      }

      const res = await api.importQuestions(selectedQuizId, questionsList);
      setMessage({ type: 'success', text: res.message || `Imported ${res.count} questions into quiz bank.` });
      setShowBulkImportModal(false);
      setBulkImportJson('');

      const details = await api.getAdminQuizDetail(selectedQuizId);
      setSelectedQuizDetails(details);
      onQuizDataChanged();
      await loadData();
    } catch (err: any) {
      setBulkImportError(err.message || 'Failed to parse JSON or import questions.');
    } finally {
      setIsBulkImporting(false);
    }
  };

  const loadSampleJson = () => {
    const sample = [
      {
        "question_text": "Which normal form removes partial dependency on the candidate key?",
        "explanation": "Second Normal Form (2NF) enforces full functional dependency on the entire composite primary key.",
        "points": 2,
        "options": [
          { "text": "First Normal Form (1NF)", "isCorrect": false },
          { "text": "Second Normal Form (2NF)", "isCorrect": true },
          { "text": "Third Normal Form (3NF)", "isCorrect": false },
          { "text": "Boyce-Codd Normal Form (BCNF)", "isCorrect": false }
        ]
      },
      {
        "question_text": "What is the primary role of an isolation level in database concurrency control?",
        "explanation": "Isolation prevents dirty reads, non-repeatable reads, and phantom reads across concurrent transactions.",
        "points": 2,
        "options": [
          { "text": "Controlling visibility of uncommitted changes between concurrent transactions", "isCorrect": true },
          { "text": "Compressing indexes on the storage engine", "isCorrect": false },
          { "text": "Limiting network bandwidth on replication slaves", "isCorrect": false },
          { "text": "Encrypting passwords before hashing", "isCorrect": false }
        ]
      }
    ];
    setBulkImportJson(JSON.stringify(sample, null, 2));
    setBulkImportError(null);
  };


  // Handle Delete Quiz
  const handleDeleteQuiz = async (quizId: number) => {
    if (!confirm('Are you sure you want to delete this quiz? All child questions, options, and attempt records will cascade delete.')) {
      return;
    }
    try {
      await api.deleteQuiz(quizId);
      setMessage({ type: 'success', text: 'Quiz deleted.' });
      await loadData();
      onQuizDataChanged();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to delete quiz.' });
    }
  };

  // Handle Add Question
  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuizId) return;

    const validOptions = newQOptions.filter((o) => o.text.trim().length > 0);
    if (validOptions.length < 2) {
      setMessage({ type: 'error', text: 'At least 2 options are required.' });
      return;
    }
    const hasCorrect = validOptions.some((o) => o.isCorrect);
    if (!hasCorrect) {
      setMessage({ type: 'error', text: 'Select one option as the correct answer.' });
      return;
    }

    try {
      await api.addQuestion(selectedQuizId, {
        questionText: newQText,
        explanation: newQExplanation,
        points: newQPoints,
        options: validOptions,
      });

      setShowAddQuestionModal(false);
      setNewQText('');
      setNewQExplanation('');
      setNewQOptions([
        { text: '', isCorrect: true },
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
      ]);
      setMessage({ type: 'success', text: 'Question added to quiz.' });

      // Reload quiz details
      const [details, analyticsData] = await Promise.all([
        api.getAdminQuizDetail(selectedQuizId),
        api.getQuestionAnalytics(selectedQuizId),
      ]);
      setSelectedQuizDetails(details);
      setAnalytics(analyticsData);
      onQuizDataChanged();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to add question.' });
    }
  };

  // Handle Delete Question
  const handleDeleteQuestion = async (qId: number) => {
    if (!confirm('Delete this question?')) return;
    try {
      await api.deleteQuestion(qId);
      if (selectedQuizId) {
        const [details, analyticsData] = await Promise.all([
          api.getAdminQuizDetail(selectedQuizId),
          api.getQuestionAnalytics(selectedQuizId),
        ]);
        setSelectedQuizDetails(details);
        setAnalytics(analyticsData);
      }
      onQuizDataChanged();
      setMessage({ type: 'success', text: 'Question deleted.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to delete question.' });
    }
  };

  // Handle Reset / Re-seed Database
  const handleResetDatabase = async () => {
    setShowResetConfirm(false);
    try {
      await api.resetSeedDatabase();
      setMessage({ type: 'success', text: 'Database reset to default curriculum.' });
      await loadData();
      onQuizDataChanged();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to reset database.' });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 text-slate-100">
      
      {/* Admin Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Admin & Course Author Studio
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            Quiz Management & Item Analytics
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Create quizzes, author secure questions, inspect student submissions, and examine question difficulty.
          </p>
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowResetConfirm(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-800 transition-colors"
            title="Reset database to initial sample schema"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Demo Data</span>
          </button>

          <button
            onClick={() => setShowCreateQuizModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Quiz</span>
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      {message && (
        <div
          className={`p-4 rounded-xl text-sm flex items-center justify-between border ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Stats Grid */}
      {overview?.stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
            <span className="text-xs text-slate-400 block mb-1">Total Quizzes</span>
            <span className="text-2xl font-bold text-white">{overview.stats.total_quizzes}</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
            <span className="text-xs text-slate-400 block mb-1">Question Bank Size</span>
            <span className="text-2xl font-bold text-white">{overview.stats.total_questions}</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
            <span className="text-xs text-slate-400 block mb-1">Total Submissions</span>
            <span className="text-2xl font-bold text-white">{overview.stats.total_attempts}</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
            <span className="text-xs text-slate-400 block mb-1">Global Pass Rate</span>
            <span className="text-2xl font-bold text-emerald-400">{overview.stats.pass_rate}%</span>
          </div>
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('quizzes')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            activeTab === 'quizzes'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          Quizzes Catalog ({adminQuizzes.length})
        </button>

        <button
          onClick={() => setActiveTab('questions')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            activeTab === 'questions'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          Question Authoring & Options
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            activeTab === 'analytics'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          Item Difficulty Analytics
        </button>

        <button
          onClick={() => setActiveTab('attempts')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            activeTab === 'attempts'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          Candidate Submissions Log
        </button>

        <button
          onClick={() => setActiveTab('proctoring')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            activeTab === 'proctoring'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Proctoring & Anti-Cheat Audit</span>
          {proctorSummary.totalFlagged > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {proctorSummary.totalFlagged}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: QUIZZES CATALOG */}
      {activeTab === 'quizzes' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-800/60 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">Quiz Title</th>
                  <th className="px-6 py-3.5">Category</th>
                  <th className="px-6 py-3.5 text-center">Questions</th>
                  <th className="px-6 py-3.5 text-center">Duration</th>
                  <th className="px-6 py-3.5 text-center">Pass Mark</th>
                  <th className="px-6 py-3.5 text-center">Attempts</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {adminQuizzes.map((quiz) => (
                  <tr key={quiz.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 font-semibold text-white">
                      <div>{quiz.title}</div>
                      <div className="text-xs text-slate-500 font-normal line-clamp-1">{quiz.description}</div>
                    </td>
                    <td className="px-6 py-4 text-xs">
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                        {quiz.category_name}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center text-slate-300 font-semibold">
                      {quiz.question_count || 0}
                    </td>
                    <td className="px-6 py-4 text-center text-slate-400 font-mono text-xs">
                      {Math.floor(quiz.time_limit_seconds / 60)} mins
                    </td>
                    <td className="px-6 py-4 text-center text-emerald-400 font-semibold text-xs">
                      {quiz.pass_percentage}%
                    </td>
                    <td className="px-6 py-4 text-center text-slate-400 text-xs">
                      {quiz.attempt_count || 0}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => {
                          setSelectedQuizId(quiz.id);
                          setActiveTab('questions');
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20"
                      >
                        Questions
                      </button>
                      <button
                        onClick={() => handleDeleteQuiz(quiz.id)}
                        className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10"
                        title="Delete Quiz"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: QUESTIONS AUTHORING */}
      {activeTab === 'questions' && (
        <div className="space-y-6">
          
          {/* Quiz selector for questions */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400 font-medium">Select Quiz:</span>
              <select
                value={selectedQuizId || ''}
                onChange={(e) => setSelectedQuizId(Number(e.target.value))}
                className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {adminQuizzes.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleExportQuestions}
                disabled={!selectedQuizId || !selectedQuizDetails?.questions?.length}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 disabled:opacity-50 transition-all border border-slate-700"
                title="Download JSON export of question bank"
              >
                <Download className="w-3.5 h-3.5 text-indigo-400" />
                <span>Export JSON</span>
              </button>

              <button
                onClick={() => {
                  setBulkImportError(null);
                  setShowBulkImportModal(true);
                }}
                disabled={!selectedQuizId}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all"
                title="Bulk import questions from JSON"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-400" />
                <span>Bulk Import JSON</span>
              </button>

              <button
                onClick={() => setShowAddQuestionModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Question</span>
              </button>
            </div>
          </div>

          {/* List of Questions for Selected Quiz */}
          {selectedQuizDetails?.questions?.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm bg-slate-900 border border-slate-800 rounded-2xl">
              No questions found for this quiz. Click "Add Question to Quiz" to create one.
            </div>
          ) : (
            <div className="space-y-4">
              {selectedQuizDetails?.questions?.map((q: any, idx: number) => (
                <div key={q.id} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-indigo-400">Question #{idx + 1}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {q.points} Points
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteQuestion(q.id)}
                      className="p-1 text-slate-500 hover:text-rose-400"
                      title="Delete Question"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-sm font-semibold text-white leading-snug">{q.question_text}</p>

                  {/* Options List */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {q.options?.map((opt: any) => (
                      <div
                        key={opt.id}
                        className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                          opt.is_correct
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200 font-medium'
                            : 'bg-slate-800/40 border-slate-700/60 text-slate-300'
                        }`}
                      >
                        <span>{opt.option_text}</span>
                        {opt.is_correct ? (
                          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                            Correct
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  {q.explanation && (
                    <div className="p-3 rounded-xl bg-slate-800/50 text-xs text-slate-400">
                      <span className="text-indigo-400 font-semibold mr-1">Explanation:</span>
                      {q.explanation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

        </div>
      )}

      {/* TAB 3: ITEM DIFFICULTY ANALYTICS */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Item Discrimination & Question Difficulty</h3>
              <p className="text-xs text-slate-400">
                Calculated via SQL JOIN: accuracy percentage across candidate attempts
              </p>
            </div>
            <select
              value={selectedQuizId || ''}
              onChange={(e) => setSelectedQuizId(Number(e.target.value))}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
            >
              {adminQuizzes.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.title}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-800/60 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-3.5">Question</th>
                    <th className="px-6 py-3.5 text-center">Attempts</th>
                    <th className="px-6 py-3.5 text-center">Correct</th>
                    <th className="px-6 py-3.5 text-center">Accuracy Rate</th>
                    <th className="px-6 py-3.5 text-center">Difficulty Flag</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {analytics.map((item) => {
                    const acc = item.accuracy_percentage ?? 0;
                    const isHard = acc < 50 && item.total_attempts > 0;

                    return (
                      <tr key={item.question_id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-6 py-4 text-xs font-medium text-slate-200 max-w-md">
                          {item.question_text}
                        </td>
                        <td className="px-6 py-4 text-center text-xs text-slate-400">
                          {item.total_attempts}
                        </td>
                        <td className="px-6 py-4 text-center text-xs text-emerald-400 font-semibold">
                          {item.correct_answers}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-xs font-bold text-white">{acc}%</span>
                            <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${acc >= 70 ? 'bg-emerald-400' : acc >= 50 ? 'bg-amber-400' : 'bg-rose-400'}`}
                                style={{ width: `${acc}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {isHard ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              Tricky Question
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400">
                              Normal
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CANDIDATE SUBMISSIONS LOG */}
      {activeTab === 'attempts' && overview?.recentAttempts && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl space-y-4">
          <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white">Recent Candidate Submissions Audit</h3>
              <span className="text-xs text-slate-400">Server-persisted examination records in relational storage</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={downloadAttemptsCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors shadow-sm"
              >
                <Download className="w-3.5 h-3.5 text-indigo-400" />
                <span>Export Attempts CSV</span>
              </button>

              <button
                type="button"
                onClick={downloadLeaderboardCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors shadow-sm"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>Export Leaderboard CSV</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-800/60 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">Candidate</th>
                  <th className="px-6 py-3.5">Quiz</th>
                  <th className="px-6 py-3.5 text-center">Score</th>
                  <th className="px-6 py-3.5 text-center">Status</th>
                  <th className="px-6 py-3.5 text-center">Time Spent</th>
                  <th className="px-6 py-3.5 text-right">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {overview.recentAttempts.map((att: any) => (
                  <tr key={att.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 font-medium text-white text-xs">
                      <div>{att.user_name}</div>
                      <div className="text-[11px] text-slate-500 font-normal">{att.user_email}</div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-300">
                      {att.quiz_title}
                    </td>
                    <td className="px-6 py-4 text-center text-xs font-semibold text-white">
                      {att.score} / {att.max_score} ({att.percentage}%)
                    </td>
                    <td className="px-6 py-4 text-center text-xs">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono capitalize bg-slate-800 text-slate-300">
                        {att.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center text-xs text-slate-400 font-mono">
                      {att.time_taken_seconds}s
                    </td>
                    <td className="px-6 py-4 text-right">
                      {att.passed ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-300">
                          PASSED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/20 text-rose-300">
                          FAILED
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: PROCTORING & ANTI-CHEAT SURVEILLANCE */}
      {activeTab === 'proctoring' && (
        <div className="space-y-6">
          {/* Proctoring KPI Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-1">
              <span className="text-xs text-slate-400 block">Monitored Candidate Sessions</span>
              <span className="text-3xl font-black text-white">{proctorSummary.totalMonitored}</span>
              <p className="text-[11px] text-slate-500">Live background surveillance active</p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-1">
              <span className="text-xs text-slate-400 block">Clean Exam Records</span>
              <span className="text-3xl font-black text-emerald-400">
                {Math.max(0, proctorSummary.totalMonitored - proctorSummary.totalFlagged)}
              </span>
              <p className="text-[11px] text-emerald-400/80">0 Tab switches / window blur events</p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-1">
              <span className="text-xs text-slate-400 block">Suspicious / Flagged Attempts</span>
              <span className="text-3xl font-black text-amber-400">{proctorSummary.totalFlagged}</span>
              <p className="text-[11px] text-amber-400/80">Tab switches or app blurs recorded</p>
            </div>
          </div>

          {/* Surveillance Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Anti-Cheat Proctoring Surveillance Audit</span>
                </h3>
                <span className="text-xs text-slate-400">Browser tab-switching & focus changes monitored server-side</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadProctorLogs}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  title="Refresh Audit Logs"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={downloadAttemptsCsv}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors shadow-sm"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Export Full Audit CSV</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-800/60 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-3.5">Candidate</th>
                    <th className="px-6 py-3.5">Assessment</th>
                    <th className="px-6 py-3.5 text-center">Proctoring Status</th>
                    <th className="px-6 py-3.5 text-center">Tab Switches</th>
                    <th className="px-6 py-3.5 text-center">Score</th>
                    <th className="px-6 py-3.5 text-right">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {proctorLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-xs text-slate-400">
                        No candidate sessions recorded yet. Start a quiz to observe live surveillance.
                      </td>
                    </tr>
                  ) : (
                    proctorLogs.map((log: any) => {
                      const isFlagged = (log.tab_switches_count || 0) > 0;
                      return (
                        <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="px-6 py-4 font-medium text-white text-xs">
                            <div>{log.user_name}</div>
                            <div className="text-[11px] text-slate-500 font-normal">{log.user_email}</div>
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-300">
                            {log.quiz_title}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {isFlagged ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                                <span>Violation Flagged</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Clean Session</span>
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center text-xs font-mono font-bold">
                            <span className={isFlagged ? 'text-amber-400' : 'text-slate-400'}>
                              {log.tab_switches_count || 0}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center text-xs font-semibold text-white">
                            {log.score ?? 0} / {log.max_score ?? 0} ({log.percentage ?? 0}%)
                          </td>
                          <td className="px-6 py-4 text-right">
                            {log.passed ? (
                              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-300">
                                PASSED
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/20 text-rose-300">
                                FAILED
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CREATE QUIZ MODAL */}
      {showCreateQuizModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">Create New Assessment</h3>
              <button onClick={() => setShowCreateQuizModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateQuiz} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Quiz Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Distributed Systems & Consensus"
                  value={newQuizTitle}
                  onChange={(e) => setNewQuizTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Category</label>
                  <select
                    value={newQuizCategory}
                    onChange={(e) => setNewQuizCategory(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Syllabus Topic</label>
                  <input
                    type="text"
                    placeholder="e.g. Relational Normalization & 3NF"
                    value={newQuizTopic}
                    onChange={(e) => setNewQuizTopic(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Description</label>
                <textarea
                  rows={3}
                  placeholder="Detailed description of assessment scope..."
                  value={newQuizDesc}
                  onChange={(e) => setNewQuizDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Duration (Seconds)</label>
                  <input
                    type="number"
                    min={30}
                    step={30}
                    value={newQuizTimeLimit}
                    onChange={(e) => setNewQuizTimeLimit(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Pass Mark (%)</label>
                  <input
                    type="number"
                    min={10}
                    max={100}
                    value={newQuizPassPct}
                    onChange={(e) => setNewQuizPassPct(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Difficulty</label>
                  <select
                    value={newQuizDifficulty}
                    onChange={(e) => setNewQuizDifficulty(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm capitalize"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Negative Marking Penalty</label>
                  <select
                    value={newQuizNegativeMarking}
                    onChange={(e) => setNewQuizNegativeMarking(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm"
                  >
                    <option value={0.0}>Disabled (No penalty)</option>
                    <option value={0.25}>-0.25 Marks (Standard)</option>
                    <option value={0.33}>-0.33 Marks (1/3rd Deduction)</option>
                    <option value={0.5}>-0.50 Marks (High)</option>
                    <option value={1.0}>-1.00 Marks (Strict 1:1)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Question Order</label>
                  <label className="flex items-center gap-2 px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newQuizShuffle}
                      onChange={(e) => setNewQuizShuffle(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 bg-slate-900 border-slate-600"
                    />
                    <span className="text-xs text-slate-300">Deterministic Shuffle</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateQuizModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30"
                >
                  Create Quiz
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD QUESTION MODAL */}
      {showAddQuestionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">Add Question to Quiz</h3>
              <button onClick={() => setShowAddQuestionModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddQuestion} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Question Prompt</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Enter the complete question prompt..."
                  value={newQText}
                  onChange={(e) => setNewQText(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Points</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={newQPoints}
                  onChange={(e) => setNewQPoints(Number(e.target.value))}
                  className="w-24 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Explanation & Key Concept</label>
                <textarea
                  rows={2}
                  placeholder="Detailed explanation shown after submission..."
                  value={newQExplanation}
                  onChange={(e) => setNewQExplanation(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm"
                />
              </div>

              {/* Options authoring */}
              <div className="space-y-2 pt-2">
                <label className="block text-slate-300 font-medium">
                  Multiple Choice Options (Select radio for Correct Answer)
                </label>
                {newQOptions.map((opt, oIdx) => (
                  <div key={oIdx} className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="correctOption"
                      checked={opt.isCorrect}
                      onChange={() => {
                        setNewQOptions((prev) =>
                          prev.map((o, i) => ({ ...o, isCorrect: i === oIdx }))
                        );
                      }}
                      className="w-4 h-4 text-indigo-600 bg-slate-800 border-slate-700 focus:ring-indigo-500"
                    />
                    <input
                      type="text"
                      placeholder={`Option ${String.fromCharCode(65 + oIdx)} text...`}
                      value={opt.text}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewQOptions((prev) =>
                          prev.map((o, i) => (i === oIdx ? { ...o, text: val } : o))
                        );
                      }}
                      className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm"
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddQuestionModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30"
                >
                  Save Question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BULK IMPORT QUESTIONS MODAL */}
      {showBulkImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-bold text-white">Bulk Question Import (JSON)</h3>
              </div>
              <button
                onClick={() => setShowBulkImportModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Target Quiz: <strong className="text-white">{selectedQuizDetails?.title || 'Selected Quiz'}</strong></span>
              <button
                type="button"
                onClick={loadSampleJson}
                className="text-indigo-400 hover:text-indigo-300 font-semibold underline"
              >
                Load Sample JSON Template
              </button>
            </div>

            {bulkImportError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{bulkImportError}</span>
              </div>
            )}

            <form onSubmit={handleBulkImportSubmit} className="space-y-4 flex-1 flex flex-col">
              <div className="flex-1 flex flex-col">
                <label className="block text-slate-300 text-xs font-medium mb-1">
                  Paste JSON Array of Questions (supports question_text, points, explanation, options with isCorrect)
                </label>
                <textarea
                  rows={10}
                  required
                  value={bulkImportJson}
                  onChange={(e) => setBulkImportJson(e.target.value)}
                  placeholder={`[\n  {\n    "question_text": "Sample question text?",\n    "explanation": "Rationale...",\n    "points": 2,\n    "options": [\n      { "text": "Option A (Correct)", "isCorrect": true },\n      { "text": "Option B", "isCorrect": false }\n    ]\n  }\n]`}
                  className="w-full flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[220px]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowBulkImportModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isBulkImporting || !bulkImportJson.trim()}
                  className="px-5 py-2.5 rounded-xl font-semibold text-xs text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 shadow-md shadow-emerald-600/30 flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isBulkImporting ? 'Importing...' : 'Validate & Import into Database'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* RESET CONFIRMATION MODAL */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-bold text-white">Reset Demo Database?</h3>
            </div>
            <p className="text-sm text-slate-300">
              This will re-initialize the 3NF schema and re-seed the standard curriculum quizzes (Database Systems, Node.js, Web Security). All temporary attempts will be refreshed.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleResetDatabase}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
