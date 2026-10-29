import React from 'react';
import { 
  Printer, 
  X, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Award, 
  ShieldCheck, 
  AlertTriangle,
  FileText,
  School,
  Check,
  Minus
} from 'lucide-react';
import { FullReviewResult } from '../types/quiz.ts';

interface CandidateReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  resultData: FullReviewResult;
}

export const CandidateReportModal: React.FC<CandidateReportModalProps> = ({
  isOpen,
  onClose,
  resultData,
}) => {
  if (!isOpen) return null;

  const { attempt, questions } = resultData;

  const formattedDate = attempt.completed_at
    ? new Date(attempt.completed_at).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : new Date().toLocaleString();

  const handlePrint = () => {
    window.print();
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remaining = sec % 60;
    return `${mins}m ${remaining}s`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white print:overflow-visible">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8 print:my-0 print:border-none print:shadow-none print:bg-white print:text-black">
        
        {/* Top Control Bar (Hidden when printing) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80 print:hidden">
          <div className="flex items-center gap-2 text-indigo-400 text-sm font-semibold">
            <FileText className="w-5 h-5 text-indigo-400" />
            <span>Official Candidate Examination Performance Report</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save as PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Transcript Document Area */}
        <div className="p-8 sm:p-10 space-y-8 print:p-6 print:space-y-6">
          
          {/* Institution Header */}
          <div className="flex items-start justify-between border-b border-slate-800 pb-6 print:border-gray-300">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 print:bg-indigo-50 print:text-indigo-700 print:border-indigo-200">
                <School className="w-8 h-8" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-indigo-400 print:text-indigo-600">
                  QuizPulse Academic Examination Board
                </span>
                <h1 className="text-2xl font-black text-white print:text-black">
                  Official Assessment Transcript
                </h1>
                <p className="text-xs text-slate-400 print:text-gray-500">
                  Server-Authoritative Evaluation & Relational Database System Audit
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                attempt.passed
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 print:bg-emerald-100 print:text-emerald-800'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30 print:bg-rose-100 print:text-rose-800'
              }`}>
                {attempt.passed ? 'PASSED / QUALIFIED' : 'FAILED / DID NOT MEET PASS MARK'}
              </span>
              <p className="text-xs text-slate-400 print:text-gray-500 mt-1.5">
                Issue Date: {formattedDate}
              </p>
            </div>
          </div>

          {/* Candidate & Assessment Metadata */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 rounded-2xl bg-slate-800/40 border border-slate-700/60 print:bg-gray-50 print:border-gray-200">
            <div>
              <span className="text-xs text-slate-400 print:text-gray-500 block">Candidate Name</span>
              <span className="text-sm font-bold text-white print:text-black">{attempt.user_name}</span>
            </div>
            <div>
              <span className="text-xs text-slate-400 print:text-gray-500 block">Email Address</span>
              <span className="text-sm font-medium text-white print:text-black truncate block">{attempt.user_email}</span>
            </div>
            <div>
              <span className="text-xs text-slate-400 print:text-gray-500 block">Assessment Title</span>
              <span className="text-sm font-bold text-white print:text-black">{attempt.quiz_title}</span>
            </div>
            <div>
              <span className="text-xs text-slate-400 print:text-gray-500 block">Session Token</span>
              <span className="text-xs font-mono text-slate-300 print:text-gray-600 truncate block">
                {attempt.session_token.slice(0, 16)}...
              </span>
            </div>
          </div>

          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/50 print:bg-gray-100 print:border-gray-200 text-center">
              <span className="text-xs text-slate-400 print:text-gray-500 block">Score Earned</span>
              <span className="text-xl font-black text-indigo-400 print:text-indigo-700">
                {attempt.score} <span className="text-xs font-normal text-slate-400">/ {attempt.max_score}</span>
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/50 print:bg-gray-100 print:border-gray-200 text-center">
              <span className="text-xs text-slate-400 print:text-gray-500 block">Percentage</span>
              <span className={`text-xl font-black ${attempt.passed ? 'text-emerald-400 print:text-emerald-700' : 'text-rose-400 print:text-rose-700'}`}>
                {attempt.percentage}%
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/50 print:bg-gray-100 print:border-gray-200 text-center">
              <span className="text-xs text-slate-400 print:text-gray-500 block">Required Mark</span>
              <span className="text-xl font-bold text-white print:text-gray-800">
                {attempt.pass_percentage}%
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/50 print:bg-gray-100 print:border-gray-200 text-center">
              <span className="text-xs text-slate-400 print:text-gray-500 block">Time Elapsed</span>
              <span className="text-xl font-bold text-white print:text-gray-800">
                {formatSeconds(attempt.time_taken_seconds)}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/50 print:bg-gray-100 print:border-gray-200 text-center">
              <span className="text-xs text-slate-400 print:text-gray-500 block">Correct / Total</span>
              <span className="text-xl font-bold text-white print:text-gray-800">
                {attempt.correct_answers_count} / {attempt.total_questions}
              </span>
            </div>
          </div>

          {/* Anti-cheat and Certificate Details */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-slate-800/30 border border-slate-700/40 text-xs print:bg-gray-50 print:border-gray-200">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-300 print:text-gray-700">
                <strong>Proctoring Audit:</strong>{' '}
                {(attempt.tab_switches_count ?? 0) === 0
                  ? 'Clean Session (0 tab switches recorded)'
                  : `${attempt.tab_switches_count} tab switches recorded by server`}
              </span>
            </div>

            {attempt.certificate_code && (
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" />
                <span className="text-slate-300 print:text-gray-700">
                  <strong>Certificate Credential:</strong>{' '}
                  <span className="font-mono text-amber-300 print:text-amber-800 font-bold">{attempt.certificate_code}</span>
                </span>
              </div>
            )}
          </div>

          {/* Itemized Questions Breakdown Table */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 print:text-gray-800">
              Itemized Question-Level Analysis
            </h3>
            
            <div className="border border-slate-800 rounded-2xl overflow-hidden print:border-gray-300">
              <table className="w-full text-left text-xs text-slate-300 print:text-gray-700">
                <thead className="bg-slate-800/80 text-slate-400 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-700/80 print:bg-gray-100 print:text-gray-600">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3">Question Text</th>
                    <th className="py-2.5 px-3">Your Answer</th>
                    <th className="py-2.5 px-3">Correct Answer</th>
                    <th className="py-2.5 px-3 text-center">Result</th>
                    <th className="py-2.5 px-3 text-right">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 print:divide-gray-200">
                  {questions.map((q, idx) => (
                    <tr key={q.question_id} className="hover:bg-slate-800/30 print:hover:bg-transparent">
                      <td className="py-3 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-3 font-medium text-white print:text-black max-w-xs sm:max-w-md">
                        {q.question_text}
                      </td>
                      <td className="py-3 px-3">
                        {q.selected_option_text ? (
                          <span className={q.is_correct ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}>
                            {q.selected_option_text}
                          </span>
                        ) : (
                          <span className="text-amber-400 italic">Unanswered (Skipped)</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-emerald-400 font-medium print:text-emerald-700">
                        {q.correct_option_text}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {q.is_correct ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                            <span>Correct</span>
                          </span>
                        ) : q.selected_option_id === null ? (
                          <span className="text-amber-400 font-medium">Skipped</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-400 font-bold">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Wrong</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-200 print:text-black">
                        {q.points_awarded} / {q.points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Institutional Sign-off Block */}
          <div className="pt-6 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 print:border-gray-300 print:text-gray-500">
            <div>
              <p className="font-semibold text-slate-300 print:text-gray-700">QuizPulse Examination Platform</p>
              <p>Certified Cryptographic Timestamp: {new Date().toISOString()}</p>
            </div>
            <div className="text-right">
              <div className="w-36 border-b border-slate-700 pb-1 mb-1 print:border-gray-400">
                <span className="font-serif italic text-slate-300 print:text-gray-800 text-sm">A. Turing, Lead Examiner</span>
              </div>
              <span className="text-[10px] uppercase tracking-wider block">Official Examiner Signature</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
