import React, { useState, useEffect } from 'react';
import { Quiz, Category, ActiveSessionData, GradedResult, FullReviewResult } from './types/quiz.ts';
import { api } from './services/api.ts';
import { Navbar } from './components/Navbar.tsx';
import { QuizList } from './components/QuizList.tsx';
import { StartQuizModal } from './components/StartQuizModal.tsx';
import { ActiveQuizSession } from './components/ActiveQuizSession.tsx';
import { QuizResultView } from './components/QuizResultView.tsx';
import { LeaderboardView } from './components/LeaderboardView.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { StudentExamHistory } from './components/StudentExamHistory.tsx';
import { AuthModal } from './components/AuthModal.tsx';

const ACTIVE_TOKEN_STORAGE_KEY = 'quizpulse_active_token';

export default function App() {
  const [currentView, setCurrentView] = useState<'quizzes' | 'active-quiz' | 'result' | 'leaderboard' | 'admin' | 'history'>('quizzes');
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoadingQuizzes, setIsLoadingQuizzes] = useState<boolean>(true);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);

  // Active user state
  const [currentUser, setCurrentUser] = useState<{ id: number; name: string; email: string; role: 'student' | 'admin' }>({
    id: 2,
    name: 'Sarah Chen (Student)',
    email: 'student1@quizpulse.edu',
    role: 'student',
  });

  // Active quiz & modal states
  const [selectedQuizForModal, setSelectedQuizForModal] = useState<Quiz | null>(null);
  const [showStartModal, setShowStartModal] = useState<boolean>(false);
  const [isStartingQuiz, setIsStartingQuiz] = useState<boolean>(false);
  const [activeSession, setActiveSession] = useState<ActiveSessionData | null>(null);

  // Result state
  const [reviewResult, setReviewResult] = useState<FullReviewResult | null>(null);

  // Leaderboard targeted quiz
  const [targetLeaderboardQuizId, setTargetLeaderboardQuizId] = useState<number | null>(null);

  // Initial data loading
  const loadQuizzesAndCategories = async () => {
    setIsLoadingQuizzes(true);
    try {
      const [cats, qzs] = await Promise.all([
        api.getCategories(),
        api.getQuizzes({
          category: selectedCategory || undefined,
          difficulty: selectedDifficulty || undefined,
          search: searchQuery || undefined,
          topic: selectedTopic || undefined,
        }),
      ]);
      setCategories(cats);
      setQuizzes(qzs);
    } catch (err) {
      console.error('Failed to load quizzes & categories:', err);
    } finally {
      setIsLoadingQuizzes(false);
    }
  };

  useEffect(() => {
    loadQuizzesAndCategories();
  }, [selectedCategory, selectedDifficulty, searchQuery, selectedTopic]);

  // Check for existing active session on page refresh
  useEffect(() => {
    const savedToken = localStorage.getItem(ACTIVE_TOKEN_STORAGE_KEY);
    if (savedToken) {
      api.getActiveSession(savedToken)
        .then((session) => {
          if (session && session.questions && session.remainingSeconds > 0) {
            setActiveSession(session);
            setCurrentView('active-quiz');
          } else {
            localStorage.removeItem(ACTIVE_TOKEN_STORAGE_KEY);
          }
        })
        .catch(() => {
          localStorage.removeItem(ACTIVE_TOKEN_STORAGE_KEY);
        });
    }
  }, []);

  // Start a new quiz attempt
  const handleStartQuiz = async (
    quizId: number, 
    userName: string, 
    userEmail: string, 
    mode: 'exam' | 'practice' = 'exam'
  ) => {
    setIsStartingQuiz(true);
    try {
      const session = await api.startQuiz(quizId, userName, userEmail);
      if (mode === 'practice') {
        session.isPractice = true;
      }
      localStorage.setItem(ACTIVE_TOKEN_STORAGE_KEY, session.sessionToken);
      setActiveSession(session);
      setShowStartModal(false);
      setCurrentView('active-quiz');
    } finally {
      setIsStartingQuiz(false);
    }
  };

  // Submit complete
  const handleQuizSubmitted = async (gradedResult: GradedResult) => {
    localStorage.removeItem(ACTIVE_TOKEN_STORAGE_KEY);
    setActiveSession(null);
    try {
      const fullReview = await api.getAttemptResult(gradedResult.sessionToken);
      setReviewResult(fullReview);
      setCurrentView('result');
      loadQuizzesAndCategories();
    } catch (err) {
      console.error('Failed to load attempt result:', err);
      setCurrentView('quizzes');
    }
  };

  // Session expired
  const handleSessionExpired = async (sessionToken: string) => {
    localStorage.removeItem(ACTIVE_TOKEN_STORAGE_KEY);
    setActiveSession(null);
    try {
      const fullReview = await api.getAttemptResult(sessionToken);
      setReviewResult(fullReview);
      setCurrentView('result');
      loadQuizzesAndCategories();
    } catch (err) {
      console.error('Failed to load expired result:', err);
      setCurrentView('quizzes');
    }
  };

  // Trigger taking a quiz
  const handleTriggerQuizModal = (quiz: Quiz) => {
    setSelectedQuizForModal(quiz);
    setShowStartModal(true);
  };

  // Leaderboard drilldown
  const handleViewLeaderboard = (quizId?: number) => {
    setTargetLeaderboardQuizId(quizId || (quizzes[0]?.id ?? null));
    setCurrentView('leaderboard');
  };

  // Switch demo user
  const handleSwitchUser = (role: 'student' | 'admin') => {
    if (role === 'admin') {
      setCurrentUser({
        id: 1,
        name: 'Prof. Alan Turing (Admin)',
        email: 'admin@quizpulse.edu',
        role: 'admin',
      });
    } else {
      setCurrentUser({
        id: 2,
        name: 'Sarah Chen (Student)',
        email: 'student1@quizpulse.edu',
        role: 'student',
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      
      {/* Top Navigation */}
      <Navbar
        currentView={currentView}
        setCurrentView={(view) => setCurrentView(view)}
        hasActiveQuiz={Boolean(activeSession)}
        onReturnToQuiz={() => setCurrentView('active-quiz')}
        currentUser={currentUser}
        onSwitchUser={handleSwitchUser}
        onOpenAuthModal={() => setShowAuthModal(true)}
      />

      {/* Main Content Router */}
      <main className="flex-1">
        {currentView === 'quizzes' && (
          <QuizList
            quizzes={quizzes}
            categories={categories}
            selectedCategory={selectedCategory}
            setSelectedCategory={(cat) => {
              setSelectedCategory(cat);
              setSelectedTopic('');
            }}
            selectedTopic={selectedTopic}
            setSelectedTopic={setSelectedTopic}
            selectedDifficulty={selectedDifficulty}
            setSelectedDifficulty={setSelectedDifficulty}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onSelectQuiz={handleTriggerQuizModal}
            onViewQuizLeaderboard={handleViewLeaderboard}
            isLoading={isLoadingQuizzes}
          />
        )}

        {currentView === 'active-quiz' && activeSession && (
          <ActiveQuizSession
            sessionData={activeSession}
            onSubmitComplete={handleQuizSubmitted}
            onSessionExpired={handleSessionExpired}
          />
        )}

        {currentView === 'result' && reviewResult && (
          <QuizResultView
            resultData={reviewResult}
            onRetake={(quizId) => {
              const q = quizzes.find((item) => item.id === quizId);
              if (q) handleTriggerQuizModal(q);
              else setCurrentView('quizzes');
            }}
            onViewLeaderboard={() => handleViewLeaderboard(reviewResult.attempt.quiz_id)}
            onBackToQuizzes={() => setCurrentView('quizzes')}
          />
        )}

        {currentView === 'leaderboard' && (
          <LeaderboardView
            quizzes={quizzes}
            initialQuizId={targetLeaderboardQuizId}
            onSelectQuizToTake={handleTriggerQuizModal}
            onBackToQuizzes={() => setCurrentView('quizzes')}
          />
        )}

        {currentView === 'history' && (
          <StudentExamHistory
            studentId={currentUser.id}
            studentName={currentUser.name}
            onRetakeQuiz={(quizId) => {
              const q = quizzes.find((item) => item.id === quizId);
              if (q) handleTriggerQuizModal(q);
              else setCurrentView('quizzes');
            }}
            onReviewAttempt={async (sessionToken) => {
              try {
                const fullReview = await api.getAttemptResult(sessionToken);
                setReviewResult(fullReview);
                setCurrentView('result');
              } catch (err) {
                console.error('Failed to load attempt result:', err);
              }
            }}
          />
        )}

        {currentView === 'admin' && (
          <AdminDashboard
            categories={categories}
            onQuizDataChanged={loadQuizzesAndCategories}
          />
        )}
      </main>

      {/* Candidate Registration / Start Quiz Modal */}
      <StartQuizModal
        quiz={selectedQuizForModal}
        isOpen={showStartModal}
        onClose={() => setShowStartModal(false)}
        onStart={handleStartQuiz}
        isLoading={isStartingQuiz}
      />

      {/* Candidate Authentication & Profile Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          if (user.role === 'admin') setCurrentView('admin');
        }}
      />

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-400">QuizPulse</span>
            <span>•</span>
            <span>Official Academic Examination & Assessment Platform</span>
          </div>
          <div className="flex items-center gap-4 text-slate-500">
            <span>Secure Server Clock</span>
            <span>•</span>
            <span>Encrypted Delivery</span>
            <span>•</span>
            <span>Verifiable Academic Certificates</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
