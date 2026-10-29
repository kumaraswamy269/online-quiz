import React, { useState, useEffect } from 'react';
import { Quiz } from '../types/quiz.ts';
import { api } from '../services/api.ts';
import { 
  Trophy, 
  Medal, 
  Clock, 
  Award, 
  Users, 
  ChevronRight, 
  ArrowLeft,
  CheckCircle2,
  Calendar
} from 'lucide-react';

interface LeaderboardViewProps {
  quizzes: Quiz[];
  initialQuizId?: number | null;
  onSelectQuizToTake: (quiz: Quiz) => void;
  onBackToQuizzes: () => void;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  quizzes,
  initialQuizId,
  onSelectQuizToTake,
  onBackToQuizzes,
}) => {
  const [selectedQuizId, setSelectedQuizId] = useState<number>(
    initialQuizId || (quizzes.length > 0 ? quizzes[0].id : 1)
  );
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [currentQuiz, setCurrentQuiz] = useState<Quiz | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (initialQuizId) {
      setSelectedQuizId(initialQuizId);
    }
  }, [initialQuizId]);

  useEffect(() => {
    if (!selectedQuizId) return;

    const loadLeaderboard = async () => {
      setIsLoading(true);
      try {
        const data = await api.getQuiz(selectedQuizId);
        setCurrentQuiz(data);
        setLeaderboard(data.leaderboard || []);
      } catch (err) {
        console.error('Failed to load quiz leaderboard:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadLeaderboard();
  }, [selectedQuizId]);

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remaining = sec % 60;
    return `${mins}m ${remaining}s`;
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-bold text-sm shadow-md shadow-amber-500/10">
          🥇
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div className="w-8 h-8 rounded-xl bg-slate-300/20 border border-slate-300/40 text-slate-200 flex items-center justify-center font-bold text-sm">
          🥈
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div className="w-8 h-8 rounded-xl bg-amber-700/20 border border-amber-700/40 text-amber-600 flex items-center justify-center font-bold text-sm">
          🥉
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center font-semibold text-xs">
        #{rank}
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8 text-slate-100">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={onBackToQuizzes}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to All Quizzes</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Quiz Leaderboards</h1>
              <p className="text-xs text-slate-400">
                SQL query aggregated rankings: ORDER BY score DESC, time_taken_seconds ASC
              </p>
            </div>
          </div>
        </div>

        {/* Quiz Selector Dropdown */}
        <div className="w-full sm:w-auto">
          <label className="block text-xs text-slate-400 mb-1">Select Quiz</label>
          <select
            value={selectedQuizId}
            onChange={(e) => setSelectedQuizId(Number(e.target.value))}
            className="w-full sm:w-72 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {quizzes.map((q) => (
              <option key={q.id} value={q.id}>
                {q.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Selected Quiz Overview & Call to action */}
      {currentQuiz && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
          <div className="space-y-1">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              {currentQuiz.category_name}
            </span>
            <h3 className="text-lg font-bold text-white">{currentQuiz.title}</h3>
            <p className="text-xs text-slate-400 line-clamp-1 max-w-xl">
              {currentQuiz.description}
            </p>
          </div>

          <button
            onClick={() => onSelectQuizToTake(currentQuiz)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-all shadow-md shadow-indigo-600/30 whitespace-nowrap"
          >
            <span>Take This Quiz</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Leaderboard Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Medal className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white">Top Ranked Candidates</h3>
          </div>
          <span className="text-xs text-slate-400">
            {leaderboard.length} Record{leaderboard.length === 1 ? '' : 's'}
          </span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span>Loading leaderboard query...</span>
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm space-y-2">
            <Trophy className="w-8 h-8 text-slate-600 mx-auto" />
            <p>No completed attempts recorded for this quiz yet.</p>
            <p className="text-xs text-slate-500">Be the first candidate to set the record!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-800/60 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">Rank</th>
                  <th className="px-6 py-3.5">Candidate</th>
                  <th className="px-6 py-3.5 text-center">Score</th>
                  <th className="px-6 py-3.5 text-center">Percentage</th>
                  <th className="px-6 py-3.5 text-center">Time Taken</th>
                  <th className="px-6 py-3.5 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {leaderboard.map((entry, index) => {
                  const rank = index + 1;
                  const isTop3 = rank <= 3;
                  const dateStr = entry.completed_at
                    ? new Date(entry.completed_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : 'Recent';

                  return (
                    <tr
                      key={entry.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isTop3 ? 'bg-indigo-950/10' : ''
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getRankBadge(rank)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-white">
                        {entry.user_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-slate-300">
                        <span className="font-semibold text-white">{entry.score}</span> / {entry.max_score}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {entry.percentage}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-slate-400 font-mono text-xs">
                        {formatSeconds(entry.time_taken_seconds)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-xs text-slate-500">
                        {dateStr}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
