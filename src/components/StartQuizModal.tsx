import React, { useState } from 'react';
import { Quiz } from '../types/quiz.ts';
import { 
  X, 
  Clock, 
  Award, 
  HelpCircle, 
  AlertCircle, 
  ShieldCheck, 
  Play, 
  Sparkles,
  User,
  Mail
} from 'lucide-react';

interface StartQuizModalProps {
  quiz: Quiz | null;
  isOpen: boolean;
  onClose: () => void;
  onStart: (quizId: number, name: string, email: string, mode: 'exam' | 'practice') => Promise<void>;
  isLoading: boolean;
}

export const StartQuizModal: React.FC<StartQuizModalProps> = ({
  quiz,
  isOpen,
  onClose,
  onStart,
  isLoading,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mode, setMode] = useState<'exam' | 'practice'>('exam');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !quiz) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please provide your full name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please provide a valid email address.');
      return;
    }

    try {
      await onStart(quiz.id, name.trim(), email.trim(), mode);
    } catch (err: any) {
      setError(err.message || 'Failed to initialize quiz session on server.');
    }
  };

  const formatMinutes = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    return `${mins} minute${mins === 1 ? '' : 's'}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 bg-gradient-to-r from-slate-900 to-indigo-950/40">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                  {quiz.category_name || 'Timed Assessment'}
                </span>
                <h3 className="text-xl font-bold text-white leading-tight">
                  {quiz.title}
                </h3>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Quiz Parameters Bar */}
          <div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/50 text-center">
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Duration</span>
              </div>
              <span className="font-semibold text-sm text-slate-100">
                {formatMinutes(quiz.time_limit_seconds)}
              </span>
            </div>

            <div className="flex flex-col items-center border-x border-slate-700/60">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
                <span>Questions</span>
              </div>
              <span className="font-semibold text-sm text-slate-100">
                {quiz.question_count || 5} questions
              </span>
            </div>

            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                <Award className="w-3.5 h-3.5 text-emerald-400" />
                <span>Pass Mark</span>
              </div>
              <span className="font-semibold text-sm text-emerald-400">
                {quiz.pass_percentage}%
              </span>
            </div>
          </div>

          {/* Candidate Credentials */}
          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Candidate Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Morgan"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Email Address (for results persistence)
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  required
                  placeholder="alex.morgan@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Assessment Mode Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Select Mode
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMode('exam')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  mode === 'exam'
                    ? 'bg-indigo-600/15 border-indigo-500 ring-2 ring-indigo-500/30 text-white'
                    : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck className={`w-4 h-4 ${mode === 'exam' ? 'text-indigo-400' : 'text-slate-500'}`} />
                  <span className="font-semibold text-xs text-white">Strict Exam Mode</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-tight">
                  Server-timed, anti-cheat surveillance, certificate eligible upon passing.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setMode('practice')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  mode === 'practice'
                    ? 'bg-emerald-600/15 border-emerald-500 ring-2 ring-emerald-500/30 text-white'
                    : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className={`w-4 h-4 ${mode === 'practice' ? 'text-emerald-400' : 'text-slate-500'}`} />
                  <span className="font-semibold text-xs text-white">Study & Practice</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-tight">
                  Instant answer verification, concept explanations, and zero penalty testing.
                </p>
              </button>
            </div>
          </div>

          {/* Rules notice based on mode */}
          <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/40 space-y-1.5 text-xs text-slate-400">
            <div className="flex items-center gap-1.5 font-medium text-slate-300">
              {mode === 'exam' ? (
                <>
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  <span>Strict Examination Protocols</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>Interactive Learning Guidelines</span>
                </>
              )}
            </div>
            <ul className="list-disc pl-4 space-y-1 text-slate-400">
              {mode === 'exam' ? (
                <>
                  <li>Authoritative server timer; auto-submits when countdown expires.</li>
                  <li>Anti-cheat monitors browser tab switching and window blur events.</li>
                  <li>Official Verifiable Certificate generated upon scoring ≥{quiz.pass_percentage}%.</li>
                </>
              ) : (
                <>
                  <li>Check your answers immediately with detailed pedagogical explanations.</li>
                  <li>Answers are autosaved; explore concepts at your own pace without penalty.</li>
                  <li>Filter between answered, flagged, and unanswered questions anytime.</li>
                </>
              )}
            </ul>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Starting Session...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>Start Quiz Now</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
