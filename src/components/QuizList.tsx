import React, { useState, useMemo } from 'react';
import { Quiz, Category } from '../types/quiz.ts';
import { 
  Clock, 
  HelpCircle, 
  Award, 
  Users, 
  Search, 
  ChevronRight, 
  Trophy, 
  Play, 
  ShieldCheck, 
  Database, 
  Server,
  Binary,
  Layers,
  Sparkles,
  Zap,
  TrendingUp,
  BookOpen,
  Tag,
  LayoutGrid,
  FolderTree,
  Compass,
  CheckCircle2,
  BookmarkCheck
} from 'lucide-react';

interface QuizListProps {
  quizzes: Quiz[];
  categories: Category[];
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  selectedTopic: string;
  setSelectedTopic: (topic: string) => void;
  selectedDifficulty: string;
  setSelectedDifficulty: (diff: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onSelectQuiz: (quiz: Quiz) => void;
  onViewQuizLeaderboard: (quizId: number) => void;
  isLoading: boolean;
}

export const QuizList: React.FC<QuizListProps> = ({
  quizzes,
  categories,
  selectedCategory,
  setSelectedCategory,
  selectedTopic,
  setSelectedTopic,
  selectedDifficulty,
  setSelectedDifficulty,
  searchQuery,
  setSearchQuery,
  onSelectQuiz,
  onViewQuizLeaderboard,
  isLoading,
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'tracks'>('grid');
  const [groupByTopic, setGroupByTopic] = useState<boolean>(false);

  const formatMinutes = (sec: number) => {
    const mins = Math.floor(sec / 60);
    return `${mins} min${mins === 1 ? '' : 's'}`;
  };

  const getDifficultyBadge = (diff: string) => {
    switch (diff) {
      case 'easy':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Easy
          </span>
        );
      case 'hard':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            Hard
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Medium
          </span>
        );
    }
  };

  const getCategoryIcon = (iconName?: string) => {
    switch (iconName?.toLowerCase()) {
      case 'database':
        return <Database className="w-4 h-4 text-emerald-400" />;
      case 'server':
        return <Server className="w-4 h-4 text-blue-400" />;
      case 'shieldcheck':
      case 'shield':
        return <ShieldCheck className="w-4 h-4 text-rose-400" />;
      case 'binary':
      case 'cpu':
        return <Binary className="w-4 h-4 text-amber-400" />;
      default:
        return <Layers className="w-4 h-4 text-indigo-400" />;
    }
  };

  // Find active category object
  const activeCategory = useMemo(() => {
    return categories.find((c) => c.slug === selectedCategory);
  }, [categories, selectedCategory]);

  // Derive topics available for the active category (or across all)
  const availableTopics = useMemo(() => {
    if (activeCategory && activeCategory.topics && activeCategory.topics.length > 0) {
      return activeCategory.topics;
    }
    // Fallback: extract distinct topics from current quizzes
    const topicSet = new Set<string>();
    quizzes.forEach((q) => {
      if (q.topic && q.topic !== 'General') {
        if (!selectedCategory || q.category_name === activeCategory?.name) {
          topicSet.add(q.topic);
        }
      }
    });
    return Array.from(topicSet);
  }, [activeCategory, quizzes, selectedCategory]);

  // Quizzes grouped by category for Track View
  const categoriesWithQuizzes = useMemo(() => {
    return categories.map((cat) => {
      const catQuizzes = quizzes.filter(
        (q) => q.category_id === cat.id || q.category_name === cat.name
      );
      
      // Group quizzes in this category by topic
      const topicGroups: Record<string, Quiz[]> = {};
      catQuizzes.forEach((quiz) => {
        const topic = quiz.topic || 'Core Curriculum';
        if (!topicGroups[topic]) {
          topicGroups[topic] = [];
        }
        topicGroups[topic].push(quiz);
      });

      return {
        ...cat,
        quizzes: catQuizzes,
        topicGroups,
      };
    }).filter((cat) => !selectedCategory || cat.slug === selectedCategory);
  }, [categories, quizzes, selectedCategory]);

  // Grouped quizzes by topic for the Grid View when groupByTopic is enabled
  const groupedByTopicList = useMemo(() => {
    const map = new Map<string, Quiz[]>();
    quizzes.forEach((q) => {
      const t = q.topic || 'General Examination';
      if (!map.has(t)) {
        map.set(t, []);
      }
      map.get(t)!.push(q);
    });
    return Array.from(map.entries());
  }, [quizzes]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 text-slate-100">
      
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-950/70 via-slate-900 to-slate-900 border border-indigo-500/20 p-8 sm:p-10 shadow-2xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Academic & Professional Curriculum Tracks</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Official Examination & Topic Assessment Portal
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            Browse structured curriculum categories and targeted subject topics. Attend certified timed examinations with server-side time enforcement, proctoring, and verifiable certificates.
          </p>

          {/* Institutional Feature Highlights */}
          <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-slate-300">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Server-Controlled Timers</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span>Anti-Cheat Tab Proctoring</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Interactive Practice Mode</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
              <Award className="w-3.5 h-3.5 text-yellow-400" />
              <span>Verifiable Certificates</span>
            </div>
          </div>
        </div>
      </div>

      {/* View Mode & Control Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FolderTree className="w-5 h-5 text-indigo-400" />
            <span>Curriculum Categories & Topics</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Explore computer science subject tracks with topic-level question banks
          </p>
        </div>

        {/* View Switcher Toggle */}
        <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold self-start sm:self-auto">
          <button
            onClick={() => setViewMode('grid')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
              viewMode === 'grid'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>All Quizzes</span>
          </button>

          <button
            onClick={() => setViewMode('tracks')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
              viewMode === 'tracks'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Topic Curriculum View</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-4">
        
        {/* Search, Difficulty, and Grouping Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search by quiz title, syllabus topic, or concept..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Difficulty Dropdown / Pills */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
              {['', 'easy', 'medium', 'hard'].map((diff) => (
                <button
                  key={diff}
                  onClick={() => setSelectedDifficulty(diff)}
                  className={`px-3 py-1.5 rounded-lg font-medium capitalize transition-all ${
                    selectedDifficulty === diff
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {diff || 'All Levels'}
                </button>
              ))}
            </div>

            {/* Group By Topic Toggle (in Grid View) */}
            {viewMode === 'grid' && (
              <button
                onClick={() => setGroupByTopic(!groupByTopic)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                  groupByTopic
                    ? 'bg-indigo-950 border-indigo-500/50 text-indigo-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
                title="Toggle Topic Grouping"
              >
                <Tag className="w-3.5 h-3.5" />
                <span>Group by Topic</span>
              </button>
            )}
          </div>

        </div>

        {/* Primary Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => {
              setSelectedCategory('');
              setSelectedTopic('');
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap border transition-all ${
              selectedCategory === ''
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>All Categories</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${selectedCategory === '' ? 'bg-indigo-700 text-white' : 'bg-slate-800 text-slate-400'}`}>
              {quizzes.length}
            </span>
          </button>

          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.slug;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(cat.slug);
                  setSelectedTopic('');
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap border transition-all ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
                }`}
              >
                {getCategoryIcon(cat.icon)}
                <span>{cat.name}</span>
                {cat.quiz_count !== undefined && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-indigo-700 text-white' : 'bg-slate-800 text-slate-400'}`}>
                    {cat.quiz_count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Secondary Topic Drilldown Bar (Categories in Topic) */}
        {availableTopics.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-indigo-500/20 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-300 mr-2">
              <BookmarkCheck className="w-4 h-4 text-indigo-400" />
              <span>
                {activeCategory ? `Topics in ${activeCategory.name}:` : 'Explore Syllabus Topics:'}
              </span>
            </div>

            <button
              onClick={() => setSelectedTopic('')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                selectedTopic === ''
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              All Topics
            </button>

            {availableTopics.map((topic) => {
              const isSelected = selectedTopic === topic;
              const topicQuizCount = quizzes.filter((q) => q.topic === topic).length;
              return (
                <button
                  key={topic}
                  onClick={() => setSelectedTopic(isSelected ? '' : topic)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                      : 'bg-slate-800/60 text-slate-300 border-slate-700/60 hover:text-white hover:border-slate-600'
                  }`}
                >
                  <span>{topic}</span>
                  {topicQuizCount > 0 && (
                    <span className={`text-[10px] px-1 rounded-full ${isSelected ? 'bg-indigo-700 text-white' : 'bg-slate-700 text-slate-400'}`}>
                      {topicQuizCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-64 rounded-2xl bg-slate-900/50 border border-slate-800 animate-pulse" />
          ))}
        </div>
      ) : quizzes.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/40 rounded-3xl border border-slate-800 p-8 space-y-3">
          <HelpCircle className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-lg font-bold text-white">No quizzes found for this topic filter</h3>
          <p className="text-sm text-slate-400 max-w-sm mx-auto">
            Try resetting your topic filter or search criteria to view available examinations.
          </p>
          <button
            onClick={() => {
              setSelectedTopic('');
              setSelectedCategory('');
              setSearchQuery('');
              setSelectedDifficulty('');
            }}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-500 transition-all"
          >
            Reset All Filters
          </button>
        </div>
      ) : viewMode === 'tracks' ? (
        /* ========================================================= */
        /* TOPIC TRACKS & CURRICULUM VIEW                           */
        /* ========================================================= */
        <div className="space-y-10">
          {categoriesWithQuizzes.map((category) => {
            const topicEntries = Object.entries(category.topicGroups);
            return (
              <div
                key={category.id}
                className="rounded-3xl bg-slate-900/80 border border-slate-800 p-6 sm:p-8 space-y-6 shadow-xl"
              >
                {/* Category Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
                  <div className="flex items-start gap-3.5">
                    <div className="p-3 rounded-2xl bg-slate-800 border border-slate-700/80 mt-1 sm:mt-0">
                      {getCategoryIcon(category.icon)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-bold text-white tracking-tight">
                          {category.name}
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          {category.quizzes.length} Quizzes
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                        {category.description}
                      </p>
                    </div>
                  </div>

                  {/* Topics Count Badge */}
                  <div className="flex items-center gap-2 self-start sm:self-auto text-xs text-slate-400 bg-slate-800/60 px-3 py-1.5 rounded-xl border border-slate-700/50">
                    <BookmarkCheck className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{topicEntries.length} Syllabus Topics</span>
                  </div>
                </div>

                {/* Topics in this Category */}
                <div className="space-y-6">
                  {topicEntries.map(([topicTitle, topicQuizzes]) => (
                    <div
                      key={topicTitle}
                      className="rounded-2xl bg-slate-950/60 border border-slate-800/80 p-5 space-y-4 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-indigo-400" />
                          <h4 className="text-sm font-bold text-white tracking-wide">
                            {topicTitle}
                          </h4>
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/60">
                            {topicQuizzes.length} {topicQuizzes.length === 1 ? 'Exam' : 'Exams'}
                          </span>
                        </div>
                      </div>

                      {/* Quizzes under this Topic */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {topicQuizzes.map((quiz) => (
                          <div
                            key={quiz.id}
                            className="flex flex-col justify-between p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-indigo-500/40 transition-all group"
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                {getDifficultyBadge(quiz.difficulty)}
                                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-amber-400" />
                                  {formatMinutes(quiz.time_limit_seconds)}
                                </span>
                              </div>

                              <h5 className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors line-clamp-1">
                                {quiz.title}
                              </h5>

                              <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                                {quiz.description}
                              </p>
                            </div>

                            <div className="pt-3 mt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                              <div className="text-[11px] text-slate-400">
                                <span className="font-semibold text-emerald-400">{quiz.pass_percentage}%</span> pass
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => onSelectQuiz(quiz)}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-all"
                                >
                                  <Play className="w-3 h-3 fill-white" />
                                  <span>Take Quiz</span>
                                </button>
                                <button
                                  onClick={() => onViewQuizLeaderboard(quiz.id)}
                                  className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors"
                                  title="View Leaderboard"
                                >
                                  <Trophy className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                    </div>
                  ))}
                </div>

              </div>
            );
          })}
        </div>
      ) : groupByTopic ? (
        /* ========================================================= */
        /* GROUPED BY TOPIC GRID VIEW                                */
        /* ========================================================= */
        <div className="space-y-10">
          {groupedByTopicList.map(([topicTitle, topicQuizzes]) => (
            <div key={topicTitle} className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                <BookOpen className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold text-white">{topicTitle}</h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                  {topicQuizzes.length} {topicQuizzes.length === 1 ? 'Quiz' : 'Quizzes'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {topicQuizzes.map((quiz) => (
                  <QuizCard
                    key={quiz.id}
                    quiz={quiz}
                    formatMinutes={formatMinutes}
                    getDifficultyBadge={getDifficultyBadge}
                    onSelectQuiz={onSelectQuiz}
                    onViewQuizLeaderboard={onViewQuizLeaderboard}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ========================================================= */
        /* STANDARD ALL QUIZZES GRID VIEW                           */
        /* ========================================================= */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {quizzes.map((quiz) => (
            <QuizCard
              key={quiz.id}
              quiz={quiz}
              formatMinutes={formatMinutes}
              getDifficultyBadge={getDifficultyBadge}
              onSelectQuiz={onSelectQuiz}
              onViewQuizLeaderboard={onViewQuizLeaderboard}
            />
          ))}
        </div>
      )}

    </div>
  );
};

interface QuizCardProps {
  quiz: Quiz;
  formatMinutes: (sec: number) => string;
  getDifficultyBadge: (diff: string) => React.ReactNode;
  onSelectQuiz: (quiz: Quiz) => void;
  onViewQuizLeaderboard: (quizId: number) => void;
}

const QuizCard: React.FC<QuizCardProps> = ({
  quiz,
  formatMinutes,
  getDifficultyBadge,
  onSelectQuiz,
  onViewQuizLeaderboard,
}) => {
  return (
    <div className="group flex flex-col justify-between bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-6 shadow-xl hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300">
      <div>
        
        {/* Card Top: Category and Difficulty */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
            {quiz.category_name || 'Curriculum'}
          </span>
          {getDifficultyBadge(quiz.difficulty)}
        </div>

        {/* Topic Tag Badge */}
        {quiz.topic && (
          <div className="mb-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-xs font-medium">
              <BookOpen className="w-3 h-3 text-indigo-400" />
              <span>Topic: {quiz.topic}</span>
            </span>
          </div>
        )}

        {/* Title */}
        <h3 className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors leading-snug mb-2">
          {quiz.title}
        </h3>

        {/* Description */}
        <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed mb-6">
          {quiz.description}
        </p>

        {/* Key Quiz Parameters Bar */}
        <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-800/60 border border-slate-700/50 text-center text-xs mb-6">
          <div>
            <span className="text-slate-500 block mb-0.5">Time</span>
            <span className="font-semibold text-slate-200">
              {formatMinutes(quiz.time_limit_seconds)}
            </span>
          </div>
          <div className="border-x border-slate-700/60">
            <span className="text-slate-500 block mb-0.5">Questions</span>
            <span className="font-semibold text-slate-200">
              {quiz.question_count || 5} Qs
            </span>
          </div>
          <div>
            <span className="text-slate-500 block mb-0.5">Pass Mark</span>
            <span className="font-semibold text-emerald-400">
              {quiz.pass_percentage}%
            </span>
          </div>
        </div>

      </div>

      {/* Card Footer: Community Stats + Action */}
      <div className="pt-4 border-t border-slate-800/80 space-y-4">
        
        {/* Stats */}
        <div className="flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-slate-500" />
            <span>{quiz.total_attempts || 0} attempts</span>
          </div>

          {quiz.pass_rate !== undefined && quiz.pass_rate !== null && (
            <div className="flex items-center gap-1 text-emerald-400 font-medium">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{quiz.pass_rate}% pass rate</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onSelectQuiz(quiz)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 shadow-md shadow-indigo-600/30 transition-all"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>Take Quiz</span>
          </button>

          <button
            onClick={() => onViewQuizLeaderboard(quiz.id)}
            className="p-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors"
            title="View Leaderboard"
          >
            <Trophy className="w-4 h-4" />
          </button>
        </div>

      </div>

    </div>
  );
};
