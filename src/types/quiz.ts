export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  quiz_count?: number;
  topic_count?: number;
  topics?: string[];
}

export interface Quiz {
  id: number;
  category_id: number;
  title: string;
  slug: string;
  description: string;
  time_limit_seconds: number;
  pass_percentage: number;
  difficulty: 'easy' | 'medium' | 'hard';
  is_published: number;
  shuffle_questions?: number;
  negative_marking_rate?: number;
  created_at: string;
  topic?: string;
  category_name?: string;
  category_color?: string;
  category_icon?: string;
  question_count?: number;
  total_points?: number;
  total_attempts?: number;
  avg_score?: number;
  pass_rate?: number;
}

export interface Option {
  id: number;
  question_id: number;
  option_text: string;
  sort_order: number;
  is_correct?: number; // Only exposed in admin or review mode
}

export interface Question {
  id: number;
  quiz_id: number;
  question_text: string;
  explanation?: string;
  points: number;
  sort_order: number;
  options: Option[];
  selectedOptionId?: number | null;
}

export interface ActiveSessionData {
  sessionToken: string;
  attemptId: number;
  userName?: string;
  userEmail?: string;
  quiz: {
    id: number;
    title: string;
    timeLimitSeconds: number;
    negativeMarkingRate?: number;
  };
  serverTime: number;
  startedAt: number;
  expiresAt: number;
  remainingSeconds: number;
  questions: Question[];
  answersMap?: Record<number, number>;
  negativeMarkingRate?: number;
  tabSwitchesCount?: number;
  isPractice?: boolean;
}

export interface PracticeCheckResult {
  questionId: number;
  selectedOptionId: number;
  isCorrect: boolean;
  correctOptionId: number;
  correctOptionText: string;
  explanation: string;
  points: number;
}

export interface ProctorLogItem {
  id: number;
  session_token: string;
  user_name: string;
  user_email: string;
  status: string;
  tab_switches_count: number;
  score: number;
  max_score: number;
  percentage: number;
  passed: boolean;
  started_at: number;
  completed_at: number;
  time_taken_seconds: number;
  quiz_title: string;
}


export interface GradedResult {
  sessionToken: string;
  attemptId: number;
  status: 'completed' | 'expired';
  score: number;
  rawScore?: number;
  negativePenalties?: number;
  penaltyRate?: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  passPercentage: number;
  timeTakenSeconds: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  totalQuestions: number;
  tabSwitchesCount?: number;
  certificateCode?: string | null;
}

export interface ReviewQuestion {
  question_id: number;
  question_text: string;
  explanation: string;
  points: number;
  sort_order: number;
  selected_option_id: number | null;
  selected_option_text: string | null;
  correct_option_id: number;
  correct_option_text: string;
  is_correct: boolean;
  points_awarded: number;
  options: Option[];
}

export interface FullReviewResult {
  attempt: {
    id: number;
    session_token: string;
    quiz_id: number;
    user_name: string;
    user_email: string;
    status: string;
    started_at: number;
    completed_at: number;
    time_taken_seconds: number;
    score: number;
    max_score: number;
    percentage: number;
    passed: boolean;
    total_questions: number;
    correct_answers_count: number;
    incorrect_answers_count: number;
    unanswered_count: number;
    tab_switches_count?: number;
    certificate_code?: string | null;
    negative_penalties?: number;
    negative_marking_rate?: number;
    quiz_title: string;
    quiz_description: string;
    pass_percentage: number;
    time_limit_seconds: number;
    category_name: string;
    category_color: string;
  };
  questions: ReviewQuestion[];
}

export interface LeaderboardEntry {
  id: number;
  user_name: string;
  score: number;
  max_score: number;
  percentage: number;
  time_taken_seconds: number;
  completed_at: number;
}

export interface QuestionAnalytics {
  question_id: number;
  question_text: string;
  points: number;
  sort_order: number;
  total_attempts: number;
  correct_answers: number;
  incorrect_answers: number;
  accuracy_percentage: number;
}

export interface VerifiedCertificate {
  attempt_id: number;
  student_name: string;
  student_email: string;
  score: number;
  max_score: number;
  percentage: number;
  passed: number | boolean;
  completed_at: number;
  tab_switches_count: number;
  certificate_code: string;
  quiz_id: number;
  quiz_title: string;
  quiz_description: string;
  pass_percentage: number;
  time_limit_seconds: number;
  category_name: string;
}

