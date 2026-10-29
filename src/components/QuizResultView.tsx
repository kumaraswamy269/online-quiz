import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { FullReviewResult } from '../types/quiz.ts';
import { AcademicCertificateModal } from './AcademicCertificateModal.tsx';
import { CandidateReportModal } from './CandidateReportModal.tsx';
import { 
  Trophy, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Award, 
  RotateCcw, 
  BookOpen, 
  HelpCircle, 
  Database,
  ArrowRight,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  AlertTriangle,
  FileText,
  BarChart3,
  TrendingUp,
  Target
} from 'lucide-react';

interface QuizResultViewProps {
  resultData: FullReviewResult;
  onRetake: (quizId: number) => void;
  onViewLeaderboard: () => void;
  onBackToQuizzes: () => void;
}

export const QuizResultView: React.FC<QuizResultViewProps> = ({
  resultData,
  onRetake,
  onViewLeaderboard,
  onBackToQuizzes,
}) => {
  const { attempt, questions } = resultData;
  const [filter, setFilter] = useState<'all' | 'correct' | 'incorrect' | 'unanswered'>('all');
  const [expandedExplanations, setExpandedExplanations] = useState<Record<number, boolean>>({});
  const [showCertificateModal, setShowCertificateModal] = useState<boolean>(false);
  const [showReportModal, setShowReportModal] = useState<boolean>(false);


  useEffect(() => {
    if (attempt.passed) {
      try {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#6366f1', '#10b981', '#38bdf8', '#f59e0b'],
        });
      } catch (e) {
        // Confetti fallback
      }
    }
  }, [attempt.passed]);

  const toggleExplanation = (questionId: number) => {
    setExpandedExplanations((prev) => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remaining = sec % 60;
    return `${mins}m ${remaining}s`;
  };

  const filteredQuestions = questions.filter((q) => {
    if (filter === 'correct') return q.is_correct;
    if (filter === 'incorrect') return !q.is_correct && q.selected_option_id !== null;
    if (filter === 'unanswered') return q.selected_option_id === null;
    return true;
  });

  // Categorize questions into skill domains to generate diagnostic competency breakdown
  const categorizeQuestion = (q: any): string => {
    const text = `${q.question_text} ${q.explanation || ''}`.toLowerCase();
    if (text.includes('index') || text.includes('b-tree') || text.includes('hash') || text.includes('performance') || text.includes('scan')) {
      return 'Indexing & Storage Engines';
    }
    if (text.includes('acid') || text.includes('transaction') || text.includes('isolation') || text.includes('rollback') || text.includes('commit') || text.includes('lock')) {
      return 'ACID Transactions & Concurrency';
    }
    if (text.includes('normal') || text.includes('3nf') || text.includes('schema') || text.includes('foreign key') || text.includes('integrity') || text.includes('primary key')) {
      return 'Relational Modeling & 3NF Normalization';
    }
    if (text.includes('join') || text.includes('select') || text.includes('group by') || text.includes('having') || text.includes('where') || text.includes('aggregate')) {
      return 'SQL Joins & Data Querying';
    }
    return 'Database Foundations & Architecture';
  };

  const domainSkills = React.useMemo(() => {
    const map: Record<string, { total: number; correct: number; pointsTotal: number; pointsEarned: number }> = {};
    questions.forEach((q) => {
      const domain = categorizeQuestion(q);
      if (!map[domain]) {
        map[domain] = { total: 0, correct: 0, pointsTotal: 0, pointsEarned: 0 };
      }
      map[domain].total += 1;
      map[domain].pointsTotal += q.points;
      if (q.is_correct) {
        map[domain].correct += 1;
        map[domain].pointsEarned += q.points_awarded;
      }
    });

    return Object.entries(map).map(([domain, data]) => {
      const percentage = Math.round((data.correct / data.total) * 100);
      return {
        domain,
        ...data,
        percentage,
        isMastered: percentage >= 80,
        isProficient: percentage >= 50 && percentage < 80,
        needsRevision: percentage < 50,
      };
    }).sort((a, b) => b.percentage - a.percentage);
  }, [questions]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 text-slate-100 space-y-8 animate-in fade-in duration-300">
      
      {/* Top Banner Card: Score & Pass/Fail status */}
      <div
        className={`relative overflow-hidden rounded-3xl border p-6 sm:p-8 shadow-2xl ${
          attempt.passed
            ? 'bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900 border-emerald-500/30'
            : 'bg-gradient-to-br from-rose-950/40 via-slate-900 to-slate-900 border-rose-500/30'
        }`}
      >
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          
          {/* Status & Headline */}
          <div className="space-y-3 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">
              {attempt.passed ? (
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Assessment Passed
                </span>
              ) : (
                <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 px-3 py-1 rounded-full flex items-center gap-1.5">
                  <XCircle className="w-4 h-4 text-rose-400" />
                  Score Below Passing Threshold
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
              {attempt.passed ? 'Excellent Performance!' : 'Assessment Completed'}
            </h1>
            <p className="text-sm text-slate-300 max-w-xl">
              Quiz: <span className="text-white font-medium">{attempt.quiz_title}</span> • Candidate: <span className="text-white font-medium">{attempt.user_name}</span>
            </p>
          </div>

          {/* Large Circular Percentage Meter */}
          <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl shrink-0 min-w-[200px]">
            <span className="text-xs uppercase tracking-wider text-slate-400 mb-1">Final Score</span>
            <div className="flex items-baseline gap-1">
              <span
                className={`text-5xl font-black tracking-tight ${
                  attempt.passed ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {attempt.percentage}%
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-2 font-medium">
              {attempt.score} / {attempt.max_score} Points ({attempt.correct_answers_count} of {attempt.total_questions} correct)
            </div>
          </div>

        </div>

        {/* Breakdown Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 border-t border-slate-800/80 mt-6">
          <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs text-slate-400 block">Correct</span>
              <span className="text-base font-bold text-white">{attempt.correct_answers_count}</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
              <XCircle className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs text-slate-400 block">Incorrect</span>
              <span className="text-base font-bold text-white">{attempt.incorrect_answers_count}</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs text-slate-400 block">Time Taken</span>
              <span className="text-base font-bold text-white">{formatSeconds(attempt.time_taken_seconds)}</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs text-slate-400 block">Required Pass</span>
              <span className="text-base font-bold text-white">{attempt.pass_percentage}%</span>
            </div>
          </div>
        </div>

        {/* Negative Marking & Anti-Cheat Summary Banners if applicable */}
        {(Number(attempt.negative_penalties) > 0 || (attempt.tab_switches_count ?? 0) > 0) && (
          <div className="flex flex-wrap items-center gap-3 pt-4 mt-4 border-t border-slate-800/60 text-xs">
            {Number(attempt.negative_penalties) > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>
                  <strong>Negative Marking:</strong> -{attempt.negative_penalties} points deducted ({attempt.incorrect_answers_count} incorrect × {attempt.negative_marking_rate || 0.25} penalty)
                </span>
              </div>
            )}
            {(attempt.tab_switches_count ?? 0) > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>
                  <strong>Proctoring Audit:</strong> {attempt.tab_switches_count} window blur / tab switch{attempt.tab_switches_count! > 1 ? 'es' : ''} logged on server
                </span>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-6 mt-6 border-t border-slate-800/80">
          <button
            onClick={() => onRetake(attempt.quiz_id)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Retake This Quiz</span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowReportModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700 transition-colors shadow-sm"
            >
              <FileText className="w-4 h-4 text-indigo-400" />
              <span>Print Performance Transcript</span>
            </button>

            {attempt.passed && (
              <button
                onClick={() => setShowCertificateModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-amber-950 bg-gradient-to-r from-amber-400 to-yellow-300 hover:from-amber-300 hover:to-yellow-200 transition-all shadow-md shadow-amber-500/20 font-sans active:scale-95"
              >
                <Award className="w-4 h-4 text-amber-950" />
                <span>View Academic Certificate</span>
              </button>
            )}

            <button
              onClick={onViewLeaderboard}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-md shadow-indigo-600/20"
            >
              <Trophy className="w-4 h-4" />
              <span>Quiz Leaderboard</span>
            </button>

            <button
              onClick={onBackToQuizzes}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <span>All Quizzes</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

      {/* Diagnostic Conceptual Skill Mastery Breakdown */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">
                Diagnostic Skill & Competency Mastery
              </h2>
              <p className="text-xs text-slate-400">
                Evaluation breakdown grouped by database domains and question objectives
              </p>
            </div>
          </div>

          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700/60 self-start sm:self-auto">
            {domainSkills.length} Domains Evaluated
          </span>
        </div>

        {/* Competency Mastery Progress Bars */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {domainSkills.map((skill) => (
            <div
              key={skill.domain}
              className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/50 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-slate-200">
                  {skill.domain}
                </span>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                  skill.isMastered
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : skill.isProficient
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                }`}>
                  {skill.isMastered ? 'Mastered (≥80%)' : skill.isProficient ? 'Proficient (50-79%)' : 'Needs Practice (<50%)'}
                </span>
              </div>

              {/* Progress bar meter */}
              <div className="space-y-1">
                <div className="w-full bg-slate-700/50 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      skill.isMastered
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                        : skill.isProficient
                        ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                        : 'bg-gradient-to-r from-rose-500 to-red-400'
                    }`}
                    style={{ width: `${Math.max(5, skill.percentage)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-400 pt-0.5">
                  <span>{skill.correct} of {skill.total} questions correct</span>
                  <span className="font-bold text-slate-200">{skill.percentage}% Accuracy</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Actionable Next Steps */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-950/30 to-purple-950/20 border border-indigo-500/20 flex items-start gap-3 text-xs text-slate-300">
          <Target className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-white block mb-0.5">Personalized Study Recommendations:</span>
            <p className="text-slate-400 leading-relaxed">
              {domainSkills.some((s) => s.needsRevision) ? (
                <>
                  Focus your next revision on <strong className="text-indigo-300">{domainSkills.filter((s) => s.needsRevision).map((s) => s.domain).join(', ')}</strong>. Use Interactive Study & Practice Mode to test individual concepts with instant explanation feedback.
                </>
              ) : (
                <>
                  Outstanding comprehension across all core domains! You demonstrated strong theoretical and relational SQL proficiency.
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Question Review Section with Explanations */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">
              Question-by-Question Audit
            </h2>
            <p className="text-xs text-slate-400">
              Graded server-side with normalized relational answer audit tables
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                filter === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({questions.length})
            </button>
            <button
              onClick={() => setFilter('correct')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                filter === 'correct'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Correct ({attempt.correct_answers_count})
            </button>
            <button
              onClick={() => setFilter('incorrect')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                filter === 'incorrect'
                  ? 'bg-rose-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Incorrect ({attempt.incorrect_answers_count})
            </button>
            {attempt.unanswered_count > 0 && (
              <button
                onClick={() => setFilter('unanswered')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  filter === 'unanswered'
                    ? 'bg-amber-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Skipped ({attempt.unanswered_count})
              </button>
            )}
          </div>
        </div>

        {/* List of Questions with explanations */}
        <div className="space-y-4">
          {filteredQuestions.map((q, idx) => {
            const isExpanded = expandedExplanations[q.question_id] !== false; // expanded by default

            return (
              <div
                key={q.question_id}
                className={`rounded-2xl border bg-slate-900 p-6 transition-all ${
                  q.is_correct
                    ? 'border-emerald-500/30'
                    : q.selected_option_id === null
                    ? 'border-amber-500/30'
                    : 'border-rose-500/30'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-bold text-slate-400">
                      #{q.sort_order || idx + 1}
                    </span>
                    {q.is_correct ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        Correct (+{q.points_awarded} pts)
                      </span>
                    ) : q.selected_option_id === null ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                        Unanswered (0 pts)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        <XCircle className="w-3.5 h-3.5 text-rose-400" />
                        Incorrect (0 pts)
                      </span>
                    )}
                  </div>

                  <span className="text-xs text-slate-500">
                    Max: {q.points} {q.points === 1 ? 'pt' : 'pts'}
                  </span>
                </div>

                {/* Question Text */}
                <h4 className="text-base font-semibold text-slate-100 mb-5 leading-snug">
                  {q.question_text}
                </h4>

                {/* Options List with Visual Feedback */}
                <div className="space-y-2.5 mb-5">
                  {q.options.map((opt) => {
                    const isSelected = q.selected_option_id === opt.id;
                    const isCorrectAnswer = opt.id === q.correct_option_id;

                    let optStyle = 'bg-slate-800/40 border-slate-700/60 text-slate-300';
                    let badge = null;

                    if (isCorrectAnswer) {
                      optStyle = 'bg-emerald-500/15 border-emerald-500/50 text-emerald-200 font-medium';
                      badge = (
                        <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1 shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Correct Answer
                        </span>
                      );
                    } else if (isSelected && !q.is_correct) {
                      optStyle = 'bg-rose-500/15 border-rose-500/50 text-rose-200';
                      badge = (
                        <span className="text-xs font-semibold text-rose-400 flex items-center gap-1 shrink-0">
                          <XCircle className="w-3.5 h-3.5" />
                          Your Choice
                        </span>
                      );
                    }

                    return (
                      <div
                        key={opt.id}
                        className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-sm ${optStyle}`}
                      >
                        <span className="leading-snug">{opt.option_text}</span>
                        {badge}
                      </div>
                    );
                  })}
                </div>

                {/* Explanation Card */}
                {q.explanation && (
                  <div className="mt-4 p-4 rounded-xl bg-slate-800/50 border border-slate-700/60 text-xs text-slate-300 space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-indigo-300">
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Explanation & Key Concept:</span>
                    </div>
                    <p className="leading-relaxed text-slate-300">
                      {q.explanation}
                    </p>
                  </div>
                )}

              </div>
            );
          })}
        </div>
      </div>

      {/* Official Verifiable Certificate Modal */}
      {attempt.passed && (
        <AcademicCertificateModal
          isOpen={showCertificateModal}
          onClose={() => setShowCertificateModal(false)}
          certificate={{
            studentName: attempt.user_name,
            studentEmail: attempt.user_email,
            quizTitle: attempt.quiz_title,
            score: attempt.score,
            maxScore: attempt.max_score,
            percentage: attempt.percentage,
            passPercentage: attempt.pass_percentage,
            completedAt: attempt.completed_at,
            certificateCode: attempt.certificate_code || `CERT-QP-${attempt.id}`,
            tabSwitchesCount: attempt.tab_switches_count || 0,
          }}
        />
      )}

      {/* Official Candidate Performance Report / Printable Transcript Modal */}
      <CandidateReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        resultData={resultData}
      />

    </div>
  );
};

