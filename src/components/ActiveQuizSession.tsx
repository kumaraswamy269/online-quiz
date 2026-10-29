import React, { useState, useEffect, useRef } from 'react';
import { ActiveSessionData, GradedResult, PracticeCheckResult } from '../types/quiz.ts';
import { api } from '../services/api.ts';
import { 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Bookmark, 
  ChevronLeft, 
  ChevronRight, 
  Send, 
  RotateCcw,
  ShieldCheck,
  Check,
  Layers,
  HelpCircle,
  AlertCircle,
  Sparkles,
  Lightbulb,
  Filter,
  Flag,
  XCircle
} from 'lucide-react';

interface ActiveQuizSessionProps {
  sessionData: ActiveSessionData;
  onSubmitComplete: (result: GradedResult) => void;
  onSessionExpired: (sessionToken: string) => void;
}

export const ActiveQuizSession: React.FC<ActiveQuizSessionProps> = ({
  sessionData,
  onSubmitComplete,
  onSessionExpired,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>(() => {
    // Initialize with existing draft answers if present
    const initial: Record<number, number> = {};
    if (sessionData.answersMap) {
      Object.assign(initial, sessionData.answersMap);
    }
    sessionData.questions.forEach((q) => {
      if (q.selectedOptionId) {
        initial[q.id] = q.selectedOptionId;
      }
    });
    return initial;
  });

  const [flagged, setFlagged] = useState<Record<number, boolean>>({});
  const [paletteFilter, setPaletteFilter] = useState<'all' | 'answered' | 'flagged' | 'unanswered'>('all');
  const [practiceFeedbacks, setPracticeFeedbacks] = useState<Record<number, PracticeCheckResult>>({});
  const [isCheckingPractice, setIsCheckingPractice] = useState(false);
  const [savingStatus, setSavingStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('saved');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Anti-Cheat Proctoring state
  const [tabSwitchesCount, setTabSwitchesCount] = useState<number>(sessionData.tabSwitchesCount || 0);
  const [showProctorWarning, setShowProctorWarning] = useState<boolean>(false);

  // Server-authoritative timer state
  // We use `sessionData.expiresAt` (epoch ms) to compute remaining seconds strictly
  const [remainingSeconds, setRemainingSeconds] = useState<number>(() => {
    const msLeft = sessionData.expiresAt - Date.now();
    return Math.max(0, Math.floor(msLeft / 1000));
  });

  const autoSubmittedRef = useRef(false);

  // Anti-Cheat Proctoring: Detect tab switches and window blur events
  useEffect(() => {
    let lastLogged = 0;
    const handleVisibilityOrBlur = () => {
      if (document.hidden || !document.hasFocus()) {
        const now = Date.now();
        if (now - lastLogged > 2500) {
          lastLogged = now;
          setTabSwitchesCount((prev) => prev + 1);
          setShowProctorWarning(true);
          api.recordProctorEvent(sessionData.sessionToken).catch(console.error);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrBlur);
    window.addEventListener('blur', handleVisibilityOrBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrBlur);
      window.removeEventListener('blur', handleVisibilityOrBlur);
    };
  }, [sessionData.sessionToken]);


  // Countdown timer effect
  useEffect(() => {
    const interval = setInterval(() => {
      const msLeft = sessionData.expiresAt - Date.now();
      const secLeft = Math.max(0, Math.floor(msLeft / 1000));
      setRemainingSeconds(secLeft);

      if (secLeft <= 0 && !autoSubmittedRef.current) {
        autoSubmittedRef.current = true;
        clearInterval(interval);
        handleAutoExpire();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionData.expiresAt]);

  // Periodic heartbeat / server time resync every 30 seconds
  useEffect(() => {
    const resyncInterval = setInterval(async () => {
      try {
        const active = await api.getActiveSession(sessionData.sessionToken);
        if (active.remainingSeconds !== undefined) {
          setRemainingSeconds(active.remainingSeconds);
        }
      } catch (err: any) {
        if (err.details?.status === 'expired') {
          onSessionExpired(sessionData.sessionToken);
        }
      }
    }, 30000);

    return () => clearInterval(resyncInterval);
  }, [sessionData.sessionToken]);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showConfirmModal || isSubmitting) return;

      if (e.key === 'ArrowRight') {
        goToNext();
      } else if (e.key === 'ArrowLeft') {
        goToPrev();
      } else if (e.key === 'f' || e.key === 'F') {
        const currentQ = sessionData.questions[currentIndex];
        if (currentQ) toggleFlag(currentQ.id);
      } else if (['1', '2', '3', '4'].includes(e.key)) {
        const currentQ = sessionData.questions[currentIndex];
        const optIndex = parseInt(e.key, 10) - 1;
        if (currentQ && currentQ.options[optIndex]) {
          handleSelectOption(currentQ.id, currentQ.options[optIndex].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, sessionData.questions, answers, showConfirmModal, isSubmitting]);

  // Jump to next flagged question
  const jumpToNextFlagged = () => {
    const totalQ = sessionData.questions.length;
    for (let offset = 1; offset < totalQ; offset++) {
      const idx = (currentIndex + offset) % totalQ;
      const q = sessionData.questions[idx];
      if (flagged[q.id]) {
        setCurrentIndex(idx);
        return;
      }
    }
  };

  // Jump to next unanswered question
  const jumpToNextUnanswered = () => {
    const totalQ = sessionData.questions.length;
    for (let offset = 1; offset < totalQ; offset++) {
      const idx = (currentIndex + offset) % totalQ;
      const q = sessionData.questions[idx];
      if (answers[q.id] === undefined) {
        setCurrentIndex(idx);
        return;
      }
    }
  };

  // Practice Mode: Check answer and reveal concept explanation
  const handleCheckPracticeAnswer = async (qId: number) => {
    const selectedOpt = answers[qId];
    if (!selectedOpt) return;

    setIsCheckingPractice(true);
    try {
      const feedback = await api.checkPracticeAnswer(
        sessionData.quiz.id,
        qId,
        selectedOpt
      );
      setPracticeFeedbacks((prev) => ({
        ...prev,
        [qId]: feedback,
      }));
    } catch (err: any) {
      console.error('Failed to verify practice answer:', err);
    } finally {
      setIsCheckingPractice(false);
    }
  };

  // Handle automatic timeout
  const handleAutoExpire = async () => {
    setIsSubmitting(true);
    setErrorMessage('Time limit reached. Auto-submitting answers to the server for grading...');
    try {
      const result = await api.submitQuiz(sessionData.sessionToken, answers);
      onSubmitComplete(result);
    } catch (err: any) {
      console.error('Auto-submit failed:', err);
      onSessionExpired(sessionData.sessionToken);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Option selection with optimistic UI + server persistence
  const handleSelectOption = async (questionId: number, optionId: number) => {
    // If clicking same selected option, keep or deselect
    const newAnswers = { ...answers, [questionId]: optionId };
    setAnswers(newAnswers);
    setSavingStatus('saving');

    try {
      await api.saveAnswer(sessionData.sessionToken, questionId, optionId);
      setSavingStatus('saved');
    } catch (err: any) {
      console.error('Failed to save answer on server:', err);
      setSavingStatus('error');
      if (err.details?.status === 'expired') {
        setErrorMessage('Quiz session expired on server.');
        onSessionExpired(sessionData.sessionToken);
      }
    }
  };

  const toggleFlag = (questionId: number) => {
    setFlagged((prev) => ({ ...prev, [questionId]: !prev[questionId] }));
  };

  const goToNext = () => {
    if (currentIndex < sessionData.questions.length - 1) {
      setCurrentIndex((i) => i + 1);
    }
  };

  const goToPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  };

  const handleManualSubmit = async () => {
    setIsSubmitting(true);
    setShowConfirmModal(false);
    try {
      const result = await api.submitQuiz(sessionData.sessionToken, answers);
      onSubmitComplete(result);
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMessage(err.message || 'Failed to submit quiz.');
    }
  };

  const currentQuestion = sessionData.questions[currentIndex];
  const totalQuestions = sessionData.questions.length;
  const answeredCount = Object.keys(answers).filter((qId) => answers[Number(qId)] !== undefined).length;
  const unansweredCount = totalQuestions - answeredCount;
  const flaggedCount = Object.values(flagged).filter(Boolean).length;

  // Format timer display
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedTimer = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  // Urgency styling
  const isUrgent = remainingSeconds < 60;
  const isWarning = remainingSeconds < 180 && !isUrgent;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 flex flex-col">
      
      {/* Top Banner: Quiz Title, Timer & Server Sync */}
      <div className="sticky top-16 z-30 bg-slate-900/90 backdrop-blur border-b border-slate-800 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
          
          {/* Left: Title & Progress Bar */}
          <div className="flex items-center gap-4 min-w-[200px]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                {sessionData.isPractice ? (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-emerald-400" />
                    <span>Study & Practice Mode</span>
                  </span>
                ) : (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Active Timed Exam
                  </span>
                )}
                <span className="text-xs text-slate-400 hidden sm:inline">
                  Candidate: {sessionData.userName || 'Student'}
                </span>
                {Number(sessionData.quiz.negativeMarkingRate || sessionData.negativeMarkingRate) > 0 && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    Penalty: -{Number(sessionData.quiz.negativeMarkingRate || sessionData.negativeMarkingRate)} / wrong
                  </span>
                )}
                {tabSwitchesCount > 0 && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 animate-pulse">
                    <ShieldCheck className="w-3 h-3 text-amber-400" />
                    <span>{tabSwitchesCount} Tab Switch{tabSwitchesCount > 1 ? 'es' : ''}</span>
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white truncate max-w-sm sm:max-w-md">
                {sessionData.quiz.title}
              </h2>
            </div>
          </div>

          {/* Center: Server-Authoritative Timer Clock */}
          <div className="flex items-center gap-3">
            <div
              className={`flex items-center gap-2.5 px-4 py-2 rounded-xl border font-mono font-bold text-base sm:text-lg transition-all shadow-inner ${
                isUrgent
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/50 animate-pulse'
                  : isWarning
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                  : 'bg-slate-800/80 text-emerald-400 border-slate-700'
              }`}
            >
              <Clock className={`w-5 h-5 ${isUrgent ? 'animate-spin' : ''}`} />
              <span>{formattedTimer}</span>
            </div>

            {/* Sync / Autosave status indicator */}
            <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-400 bg-slate-800/60 px-2.5 py-1.5 rounded-lg border border-slate-700/60">
              {savingStatus === 'saving' && (
                <>
                  <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  <span>Syncing...</span>
                </>
              )}
              {savingStatus === 'saved' && (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Server Saved</span>
                </>
              )}
              {savingStatus === 'error' && (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  <span>Sync Error</span>
                </>
              )}
            </div>
          </div>

          {/* Right: Submit Button */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowConfirmModal(true)}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 shadow-md shadow-indigo-600/30 transition-all disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>Submit Assessment</span>
            </button>
          </div>

        </div>

        {/* Linear Progress Bar */}
        <div className="w-full h-1 bg-slate-800">
          <div 
            className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
          />
        </div>
      </div>

      {/* Proctoring Warning Banner if detected */}
      {showProctorWarning && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 w-full">
          <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Anti-Cheat Security Proctor Notice:</strong> Leaving or blurring the active examination window has been logged on the server ({tabSwitchesCount} total). Maintain focus on the examination tab.
              </span>
            </div>
            <button
              onClick={() => setShowProctorWarning(false)}
              className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-semibold border border-amber-500/30 shrink-0 text-xs"
            >
              Acknowledge
            </button>
          </div>
        </div>
      )}

      {/* Error alert if any */}
      {errorMessage && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 w-full">
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        </div>
      )}

      {/* Main Workspace Area: Question view + Navigator Sidebar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex-1 flex flex-col lg:flex-row gap-6">
        
        {/* Left: Active Question Card */}
        <div className="flex-1 flex flex-col justify-between bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
          <div>
            
            {/* Question Header & Meta */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-indigo-400">
                  Question {currentIndex + 1} of {totalQuestions}
                </span>
                <span className="text-xs text-slate-500">•</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {currentQuestion.points} {currentQuestion.points === 1 ? 'Point' : 'Points'}
                </span>
              </div>

              {/* Bookmark / Flag toggle */}
              <button
                onClick={() => toggleFlag(currentQuestion.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  flagged[currentQuestion.id]
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-slate-800/60 text-slate-400 border-slate-700/60 hover:text-slate-200'
                }`}
              >
                <Bookmark className={`w-3.5 h-3.5 ${flagged[currentQuestion.id] ? 'fill-amber-400 text-amber-400' : ''}`} />
                <span>{flagged[currentQuestion.id] ? 'Flagged for Review' : 'Flag Question'}</span>
              </button>
            </div>

            {/* Question Text */}
            <h3 className="text-lg sm:text-xl font-medium text-slate-100 leading-relaxed mb-8">
              {currentQuestion.question_text}
            </h3>

            {/* Multiple Choice Options */}
            <div className="space-y-3">
              {currentQuestion.options.map((option, optIdx) => {
                const isSelected = answers[currentQuestion.id] === option.id;
                const letter = String.fromCharCode(65 + optIdx); // A, B, C, D

                return (
                  <div
                    key={option.id}
                    onClick={() => handleSelectOption(currentQuestion.id, option.id)}
                    className={`group relative flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-indigo-600/15 border-indigo-500/60 shadow-lg shadow-indigo-600/10'
                        : 'bg-slate-800/50 border-slate-700/60 hover:bg-slate-800 hover:border-slate-600'
                    }`}
                  >
                    {/* Option Letter Indicator */}
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs transition-colors shrink-0 ${
                        isSelected
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-700/60 text-slate-300 group-hover:bg-slate-700'
                      }`}
                    >
                      {letter}
                    </div>

                    {/* Option Text */}
                    <span className={`text-sm sm:text-base leading-snug flex-1 ${isSelected ? 'text-white font-medium' : 'text-slate-300'}`}>
                      {option.option_text}
                    </span>

                    {/* Radio Checkmark */}
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors shrink-0 ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-600'
                          : 'border-slate-600 group-hover:border-slate-500'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Interactive Practice / Study Mode Instant Feedback */}
            {sessionData.isPractice && (
              <div className="mt-6 pt-5 border-t border-slate-800">
                {!answers[currentQuestion.id] ? (
                  <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/50 flex items-center gap-3 text-xs text-slate-400">
                    <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Select an answer above to check your reasoning and reveal concept explanations instantly.</span>
                  </div>
                ) : practiceFeedbacks[currentQuestion.id] ? (
                  <div className={`p-5 rounded-xl border animate-in fade-in duration-200 space-y-3 ${
                    practiceFeedbacks[currentQuestion.id].isCorrect
                      ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-100'
                      : 'bg-rose-950/20 border-rose-500/40 text-rose-100'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {practiceFeedbacks[currentQuestion.id].isCorrect ? (
                          <>
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            <span className="font-bold text-sm text-emerald-400">Correct Answer!</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-5 h-5 text-rose-400" />
                            <span className="font-bold text-sm text-rose-400">Incorrect Choice</span>
                          </>
                        )}
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {practiceFeedbacks[currentQuestion.id].points} Points
                      </span>
                    </div>

                    {!practiceFeedbacks[currentQuestion.id].isCorrect && (
                      <div className="text-xs text-slate-300 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                        <span className="text-slate-400 font-semibold block mb-1">Correct Answer:</span>
                        <span className="text-emerald-400 font-medium">
                          {practiceFeedbacks[currentQuestion.id].correctOptionText}
                        </span>
                      </div>
                    )}

                    <div className="p-3.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-slate-300 space-y-1">
                      <div className="flex items-center gap-1.5 font-semibold text-amber-400">
                        <Lightbulb className="w-4 h-4" />
                        <span>Core Concept & Pedagogical Takeaway:</span>
                      </div>
                      <p className="leading-relaxed text-slate-300">
                        {practiceFeedbacks[currentQuestion.id].explanation}
                      </p>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleCheckPracticeAnswer(currentQuestion.id)}
                    disabled={isCheckingPractice}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 transition-all shadow-sm disabled:opacity-50"
                  >
                    {isCheckingPractice ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                        <span>Verifying with Database...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-emerald-400" />
                        <span>Check Answer & Reveal Explanation</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            )}

          </div>

          {/* Navigation Bottom Bar */}
          <div className="flex items-center justify-between pt-8 border-t border-slate-800 mt-8">
            <button
              onClick={goToPrev}
              disabled={currentIndex === 0}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            <span className="text-xs text-slate-500 hidden sm:inline">
              Keys: [1-4] options • [← →] navigate • [F] flag
            </span>

            {currentIndex < totalQuestions - 1 ? (
              <button
                onClick={goToNext}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-md shadow-indigo-600/20"
              >
                <span>Next Question</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => setShowConfirmModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors shadow-md shadow-emerald-600/20"
              >
                <span>Review & Finish</span>
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>

        </div>

        {/* Right: Question Palette & Overview Drawer */}
        <div className="w-full lg:w-80 flex flex-col gap-5">
          
          {/* Summary Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <h4 className="text-sm font-semibold text-slate-200 flex items-center justify-between">
              <span>Assessment Summary</span>
              <Layers className="w-4 h-4 text-slate-400" />
            </h4>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-xs text-emerald-400 block mb-0.5">Answered</span>
                <span className="text-base font-bold text-white">{answeredCount}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
                <span className="text-xs text-slate-400 block mb-0.5">Remaining</span>
                <span className="text-base font-bold text-white">{unansweredCount}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <span className="text-xs text-amber-400 block mb-0.5">Flagged</span>
                <span className="text-base font-bold text-white">{flaggedCount}</span>
              </div>
            </div>

            {/* Filter Tabs for Palette */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Question Navigator</span>
                </span>
                <span className="text-[11px] text-slate-500">
                  {paletteFilter === 'all' ? `${totalQuestions} total` : `${sessionData.questions.filter((q) => {
                    if (paletteFilter === 'answered') return answers[q.id] !== undefined;
                    if (paletteFilter === 'flagged') return Boolean(flagged[q.id]);
                    if (paletteFilter === 'unanswered') return answers[q.id] === undefined;
                    return true;
                  }).length} shown`}
                </span>
              </div>

              {/* Quick Filter Buttons */}
              <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-slate-800/80 border border-slate-700/60 text-[11px] mb-3">
                <button
                  type="button"
                  onClick={() => setPaletteFilter('all')}
                  className={`py-1 rounded-lg font-medium transition-all ${
                    paletteFilter === 'all'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All ({totalQuestions})
                </button>
                <button
                  type="button"
                  onClick={() => setPaletteFilter('answered')}
                  className={`py-1 rounded-lg font-medium transition-all ${
                    paletteFilter === 'answered'
                      ? 'bg-emerald-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Done ({answeredCount})
                </button>
                <button
                  type="button"
                  onClick={() => setPaletteFilter('flagged')}
                  className={`py-1 rounded-lg font-medium transition-all ${
                    paletteFilter === 'flagged'
                      ? 'bg-amber-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Flag ({flaggedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setPaletteFilter('unanswered')}
                  className={`py-1 rounded-lg font-medium transition-all ${
                    paletteFilter === 'unanswered'
                      ? 'bg-slate-700 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Left ({unansweredCount})
                </button>
              </div>

              {/* Quick Jump Buttons */}
              {(flaggedCount > 0 || unansweredCount > 0) && (
                <div className="flex items-center gap-2 mb-3">
                  {flaggedCount > 0 && (
                    <button
                      type="button"
                      onClick={jumpToNextFlagged}
                      className="flex-1 py-1.5 px-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[11px] font-medium flex items-center justify-center gap-1 transition-colors"
                    >
                      <Flag className="w-3 h-3" />
                      <span>Next Flagged</span>
                    </button>
                  )}
                  {unansweredCount > 0 && (
                    <button
                      type="button"
                      onClick={jumpToNextUnanswered}
                      className="flex-1 py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[11px] font-medium flex items-center justify-center gap-1 transition-colors"
                    >
                      <span>Next Left</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-5 gap-2">
                {sessionData.questions.map((q, idx) => {
                  const isCurrent = idx === currentIndex;
                  const isAnswered = answers[q.id] !== undefined;
                  const isFlagged = flagged[q.id];

                  // Filter check
                  const matchesFilter =
                    paletteFilter === 'all' ||
                    (paletteFilter === 'answered' && isAnswered) ||
                    (paletteFilter === 'flagged' && isFlagged) ||
                    (paletteFilter === 'unanswered' && !isAnswered);

                  let btnClass = 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700';

                  if (isCurrent) {
                    btnClass = 'ring-2 ring-indigo-500 font-bold bg-indigo-600/30 text-white border-indigo-500';
                  } else if (isFlagged) {
                    btnClass = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
                  } else if (isAnswered) {
                    btnClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
                  }

                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentIndex(idx)}
                      className={`h-10 rounded-xl border text-xs font-medium flex items-center justify-center transition-all relative ${btnClass} ${
                        !matchesFilter ? 'opacity-20 hover:opacity-100' : ''
                      }`}
                      title={`Question ${idx + 1}${isFlagged ? ' (Flagged)' : ''}${isAnswered ? ' (Answered)' : ''}`}
                    >
                      {idx + 1}
                      {isFlagged && (
                        <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400 shadow-sm" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Legend */}
            <div className="pt-3 border-t border-slate-800/80 flex flex-wrap gap-3 text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500/40 border border-emerald-500/60" />
                <span>Answered</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-slate-800 border border-slate-700" />
                <span>Unanswered</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-amber-500/40 border border-amber-500/60" />
                <span>Flagged</span>
              </div>
            </div>

          </div>

          {/* Anti-cheat & Server Control info card */}
          <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-4 text-xs text-slate-400 space-y-2">
            <div className="flex items-center gap-2 font-medium text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Server-Authoritative Validation</span>
            </div>
            <p>
              Your session expiry timestamp is validated on every action. Leaving this window does not stop the timer.
            </p>
          </div>

        </div>

      </div>

      {/* Confirmation Modal Before Submission */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-center gap-3 text-indigo-400">
              <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                <HelpCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">
                Submit Your Assessment?
              </h3>
            </div>

            <p className="text-sm text-slate-300">
              Are you sure you want to finish and submit your answers? Your assessment will be scored immediately on the server.
            </p>

            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Total Questions:</span>
                <span className="font-semibold">{totalQuestions}</span>
              </div>
              <div className="flex justify-between text-emerald-400">
                <span>Answered:</span>
                <span className="font-semibold">{answeredCount}</span>
              </div>
              {unansweredCount > 0 && (
                <div className="flex justify-between text-amber-400">
                  <span>Unanswered (0 points):</span>
                  <span className="font-semibold">{unansweredCount}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800"
              >
                Continue Quiz
              </button>
              <button
                type="button"
                onClick={handleManualSubmit}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>Grading Answers...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm & Finish</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
