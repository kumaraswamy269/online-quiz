import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  BookOpen, 
  Trophy, 
  Database, 
  Settings, 
  Clock,
  ShieldCheck,
  User,
  LogOut,
  ChevronDown,
  Award
} from 'lucide-react';

interface NavbarProps {
  currentView: 'quizzes' | 'active-quiz' | 'result' | 'leaderboard' | 'admin' | 'history';
  setCurrentView: (view: 'quizzes' | 'leaderboard' | 'admin' | 'history') => void;
  hasActiveQuiz: boolean;
  onReturnToQuiz?: () => void;
  currentUser?: { name: string; email: string; role: string } | null;
  onSwitchUser?: (role: 'student' | 'admin') => void;
  onOpenAuthModal?: () => void;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  setCurrentView,
  hasActiveQuiz,
  onReturnToQuiz,
  currentUser = { name: 'Sarah Chen (Student)', email: 'student1@quizpulse.edu', role: 'student' },
  onSwitchUser,
  onOpenAuthModal,
  onLogout,
}) => {
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-800 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand / Logo */}
        <div 
          onClick={() => setCurrentView('quizzes')} 
          className="flex items-center gap-3 cursor-pointer group select-none"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 p-0.5 shadow-lg shadow-indigo-500/20 group-hover:shadow-indigo-500/40 transition-all">
            <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                QuizPulse
              </span>
              <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Examination Portal
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Official Timed Examination & Assessment Platform
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 sm:gap-2">
          {hasActiveQuiz && currentView !== 'active-quiz' && (
            <button
              onClick={onReturnToQuiz}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs sm:text-sm font-medium animate-pulse hover:bg-amber-500/30 transition-all mr-2"
            >
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Resume Active Exam</span>
            </button>
          )}

          <button
            onClick={() => setCurrentView('quizzes')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${
              currentView === 'quizzes'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Examinations</span>
          </button>

          <button
            onClick={() => setCurrentView('leaderboard')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${
              currentView === 'leaderboard'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span className="hidden sm:inline">Leaderboard</span>
          </button>

          <button
            onClick={() => setCurrentView('history')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${
              currentView === 'history'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Candidate scorecards, certificates, and proctoring audit"
          >
            <Award className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">My Exams & Certs</span>
          </button>

          <button
            onClick={() => setCurrentView('admin')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${
              currentView === 'admin'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Settings className="w-4 h-4 text-slate-300" />
            <span className="hidden sm:inline">Instructor Portal</span>
          </button>
        </nav>

        {/* User Role Switcher & Account Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-xs text-slate-200 transition-all"
          >
            <div className={`w-2 h-2 rounded-full ${currentUser?.role === 'admin' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
            <span className="max-w-[120px] truncate font-medium">
              {currentUser?.name || 'Account'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {showUserDropdown && (
            <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-2 z-50 text-xs space-y-1">
              <div className="p-2.5 border-b border-slate-800">
                <div className="font-semibold text-white">{currentUser?.name}</div>
                <div className="text-[11px] text-slate-400 truncate">{currentUser?.email}</div>
                <div className="mt-1">
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                    currentUser?.role === 'admin'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}>
                    {currentUser?.role === 'admin' ? 'Administrator' : 'Enrolled Candidate'}
                  </span>
                </div>
              </div>

              {/* Sign In / Register Modal trigger */}
              <button
                onClick={() => {
                  setShowUserDropdown(false);
                  onOpenAuthModal && onOpenAuthModal();
                }}
                className="w-full text-left p-2 rounded-xl bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-300 font-semibold flex items-center justify-between transition-colors"
              >
                <span>Sign In / Switch User</span>
                <User className="w-3.5 h-3.5 text-indigo-400" />
              </button>

              {/* Quick switch between Demo accounts */}
              <div className="p-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Quick Profile Switch
              </div>
              <button
                onClick={() => {
                  onSwitchUser && onSwitchUser('student');
                  setShowUserDropdown(false);
                }}
                className="w-full text-left p-2 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-between"
              >
                <span>Student: Sarah Chen</span>
                <span className="text-[10px] text-emerald-400">Student</span>
              </button>
              <button
                onClick={() => {
                  onSwitchUser && onSwitchUser('admin');
                  setShowUserDropdown(false);
                  setCurrentView('admin');
                }}
                className="w-full text-left p-2 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-between"
              >
                <span>Admin: Prof. Alan Turing</span>
                <span className="text-[10px] text-amber-400">Admin</span>
              </button>
            </div>
          )}
        </div>

      </div>
    </header>
  );
};
