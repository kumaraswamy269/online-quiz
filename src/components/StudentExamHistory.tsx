import React, { useState, useEffect } from 'react';
import { api } from '../services/api.ts';
import { AcademicCertificateModal } from './AcademicCertificateModal.tsx';
import { 
  Award, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Search, 
  ShieldCheck, 
  RotateCcw, 
  ExternalLink,
  BookOpen,
  Filter,
  AlertCircle
} from 'lucide-react';

interface StudentExamHistoryProps {
  studentId: number;
  studentName: string;
  onRetakeQuiz: (quizId: number) => void;
  onReviewAttempt: (sessionToken: string) => void;
}

export const StudentExamHistory: React.FC<StudentExamHistoryProps> = ({
  studentName,
  onRetakeQuiz,
  onReviewAttempt,
}) => {
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'passed' | 'failed'>('all');

  // Certificate modal state
  const [selectedCert, setSelectedCert] = useState<any | null>(null);

  // Certificate Verification Lookup
  const [verifyCode, setVerifyCode] = useState<string>('');
  const [verifyLoading, setVerifyLoading] = useState<boolean>(false);
  const [verifyResult, setVerifyResult] = useState<any | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const data = await api.getMyResults();
      setHistory(data || []);
    } catch (err) {
      console.error('Failed to load student exam history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyCode.trim()) return;
    setVerifyLoading(true);
    setVerifyError(null);
    setVerifyResult(null);

    try {
      const cert = await api.verifyCertificate(verifyCode.trim());
      setVerifyResult(cert);
    } catch (err: any) {
      setVerifyError(err.message || 'Certificate verification failed. No authenticated record found.');
    } finally {
      setVerifyLoading(false);
    }
  };

  const filteredHistory = history.filter((item) => {
    const matchesSearch = item.quiz_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.certificate_code?.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (statusFilter === 'passed') return Boolean(item.passed);
    if (statusFilter === 'failed') return !item.passed;
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 text-slate-100 space-y-8 animate-in fade-in duration-300">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Candidate Academic Record
            </span>
            <span className="text-xs text-slate-400">Authenticated Student: {studentName}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
            My Examination History & Certificates
          </h1>
          <p className="text-sm text-slate-400">
            View past assessment scorecards, download institutional certificates, and audit server-side proctoring logs.
          </p>
        </div>

        {/* Quick Stats Pill */}
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-center">
            <span className="text-xs text-slate-400 block font-mono">Total Taken</span>
            <span className="text-lg font-bold text-white">{history.length}</span>
          </div>
          <div className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-center">
            <span className="text-xs text-slate-400 block font-mono">Passed</span>
            <span className="text-lg font-bold text-emerald-400">
              {history.filter((h) => h.passed).length}
            </span>
          </div>
        </div>
      </div>

      {/* Certificate Verification Lookup Box */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-500/30 shadow-xl">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Public Credential Verification Portal</span>
          </div>
          <h2 className="text-lg font-bold text-white mb-2">
            Verify Institutional Certificate Authenticity
          </h2>
          <p className="text-xs text-slate-300 mb-4">
            Enter any unique Credential ID (e.g. <span className="font-mono text-amber-300">CERT-XXXX-XXXX</span>) issued by QuizPulse to cryptographically authenticate the examination score directly from the relational database.
          </p>

          <form onSubmit={handleVerifyLookup} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
              <input
                type="text"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value)}
                placeholder="Enter Credential ID (e.g. CERT-QP26-89AF)..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={verifyLoading || !verifyCode.trim()}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition-all shadow-md shadow-indigo-600/30 flex items-center justify-center gap-2 shrink-0"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{verifyLoading ? 'Verifying...' : 'Verify Credential'}</span>
            </button>
          </form>

          {/* Verification Result Notification */}
          {verifyError && (
            <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{verifyError}</span>
            </div>
          )}

          {verifyResult && (
            <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide">
                    Authentic Verified Examination Record
                  </span>
                </div>
                <p className="text-sm font-semibold text-white">
                  {verifyResult.student_name} — {verifyResult.quiz_title}
                </p>
                <p className="text-xs text-slate-400 font-mono">
                  Score: {verifyResult.percentage}% • ID: {verifyResult.certificate_code} • Issued: {new Date(verifyResult.completed_at || verifyResult.calculated_at || Date.now()).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedCert({
                  studentName: verifyResult.student_name,
                  studentEmail: verifyResult.student_email,
                  quizTitle: verifyResult.quiz_title,
                  score: verifyResult.marks_obtained ?? verifyResult.score,
                  maxScore: verifyResult.total_marks ?? verifyResult.max_score,
                  percentage: verifyResult.percentage,
                  passPercentage: verifyResult.passing_percentage ?? verifyResult.pass_percentage ?? 70,
                  completedAt: verifyResult.completed_at || verifyResult.calculated_at,
                  certificateCode: verifyResult.certificate_code,
                  tabSwitchesCount: verifyResult.tab_switches_count || 0,
                })}
                className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-amber-950 font-bold rounded-xl text-xs shadow flex items-center gap-1.5 shrink-0"
              >
                <Award className="w-4 h-4" />
                <span>Open Full Certificate</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by quiz title or ID..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                statusFilter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({history.length})
            </button>
            <button
              onClick={() => setStatusFilter('passed')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                statusFilter === 'passed' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Passed
            </button>
            <button
              onClick={() => setStatusFilter('failed')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                statusFilter === 'failed' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Failed
            </button>
          </div>
        </div>
      </div>

      {/* Exam Attempts List */}
      {isLoading ? (
        <div className="py-16 text-center">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-400 font-mono">Loading examination attempts from database...</p>
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="py-16 text-center bg-slate-900/40 rounded-2xl border border-slate-800/60 p-8">
          <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white mb-1">No Examination Attempts Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
            You haven't attempted any assessments matching the selected filters yet. Browse available quizzes to get certified!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredHistory.map((item) => (
            <div
              key={item.attempt_id || item.id}
              className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              {/* Left Details */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-indigo-400">
                    {item.category_name || 'Computer Science'}
                  </span>
                  <span className="text-xs text-slate-600">•</span>
                  <span className="text-xs text-slate-400">
                    {new Date(item.submitted_at || item.completed_at || item.calculated_at || Date.now()).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                  {item.tab_switches_count > 0 && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-amber-400" />
                      <span>{item.tab_switches_count} Tab Switches</span>
                    </span>
                  )}
                </div>

                <h3 className="text-lg font-bold text-white">
                  {item.quiz_title}
                </h3>

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 font-mono">
                  <span>Score: <strong className="text-white">{item.marks_obtained ?? item.score} / {item.total_marks ?? item.max_score}</strong></span>
                  <span>•</span>
                  <span>Percentage: <strong className={item.passed ? 'text-emerald-400' : 'text-rose-400'}>{item.percentage}%</strong></span>
                  {item.certificate_code && (
                    <>
                      <span>•</span>
                      <span className="text-amber-400">ID: {item.certificate_code}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Right: Actions */}
              <div className="flex flex-wrap items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
                {item.passed && (
                  <button
                    onClick={() => setSelectedCert({
                      studentName: item.student_name || studentName,
                      studentEmail: item.student_email,
                      quizTitle: item.quiz_title,
                      score: item.marks_obtained ?? item.score,
                      maxScore: item.total_marks ?? item.max_score,
                      percentage: item.percentage,
                      passPercentage: item.passing_percentage ?? item.pass_percentage ?? 70,
                      completedAt: item.submitted_at || item.completed_at || item.calculated_at,
                      certificateCode: item.certificate_code || `CERT-QP-${item.attempt_id || item.id}`,
                      tabSwitchesCount: item.tab_switches_count || 0,
                    })}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-amber-950 bg-gradient-to-r from-amber-400 to-yellow-300 hover:from-amber-300 transition-all shadow shadow-amber-500/20 active:scale-95"
                  >
                    <Award className="w-4 h-4 text-amber-950" />
                    <span>View Certificate</span>
                  </button>
                )}

                <button
                  onClick={() => onRetakeQuiz(item.quiz_id)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retake</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Academic Certificate Modal */}
      {selectedCert && (
        <AcademicCertificateModal
          isOpen={Boolean(selectedCert)}
          onClose={() => setSelectedCert(null)}
          certificate={selectedCert}
        />
      )}

    </div>
  );
};
