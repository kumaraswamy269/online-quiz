-- Online Quiz System Normalized Relational Schema
-- Constraints: Primary Keys, Foreign Keys with ON DELETE CASCADE, CHECK constraints, UNIQUE constraints

PRAGMA foreign_keys = ON;

-- 1. Categories Table (1NF, 2NF, 3NF normalized)
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  icon VARCHAR(50) DEFAULT 'Layers',
  color VARCHAR(50) DEFAULT 'indigo',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Quizzes Table (Relational entity referencing categories)
CREATE TABLE IF NOT EXISTS quizzes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  time_limit_seconds INTEGER NOT NULL DEFAULT 600 CHECK(time_limit_seconds >= 30),
  pass_percentage INTEGER NOT NULL DEFAULT 70 CHECK(pass_percentage >= 0 AND pass_percentage <= 100),
  difficulty VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK(difficulty IN ('easy', 'medium', 'hard')),
  is_published INTEGER NOT NULL DEFAULT 1 CHECK(is_published IN (0, 1)),
  shuffle_questions INTEGER NOT NULL DEFAULT 0 CHECK(shuffle_questions IN (0, 1)),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
);

-- Index on category for optimized JOIN queries
CREATE INDEX IF NOT EXISTS idx_quizzes_category_id ON quizzes(category_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_is_published ON quizzes(is_published);

-- 3. Questions Table (Normalized questions referencing quizzes)
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quiz_id INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  explanation TEXT,
  points INTEGER NOT NULL DEFAULT 1 CHECK(points > 0),
  sort_order INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON questions(quiz_id);

-- 4. Question Options Table (Secure option storage; separates answers from questions)
CREATE TABLE IF NOT EXISTS question_options (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL,
  option_text TEXT NOT NULL,
  is_correct INTEGER NOT NULL DEFAULT 0 CHECK(is_correct IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_options_question_id ON question_options(question_id);
CREATE INDEX IF NOT EXISTS idx_options_is_correct ON question_options(question_id, is_correct);

-- 5. Quiz Attempts Table (Server-authoritative session tracking)
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_token VARCHAR(64) NOT NULL UNIQUE,
  quiz_id INTEGER NOT NULL,
  user_name VARCHAR(100) NOT NULL,
  user_email VARCHAR(150) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress', 'completed', 'expired', 'abandoned')),
  started_at INTEGER NOT NULL, -- Unix epoch millisecond timestamp
  expires_at INTEGER NOT NULL, -- Unix epoch millisecond timestamp
  completed_at INTEGER,        -- Unix epoch millisecond timestamp
  time_taken_seconds INTEGER DEFAULT 0,
  score INTEGER DEFAULT 0,
  max_score INTEGER DEFAULT 0,
  percentage REAL DEFAULT 0.0,
  passed INTEGER DEFAULT 0 CHECK(passed IN (0, 1)),
  total_questions INTEGER DEFAULT 0,
  correct_answers_count INTEGER DEFAULT 0,
  incorrect_answers_count INTEGER DEFAULT 0,
  unanswered_count INTEGER DEFAULT 0,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_attempts_token ON quiz_attempts(session_token);
CREATE INDEX IF NOT EXISTS idx_attempts_quiz_id ON quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_attempts_status ON quiz_attempts(status);

-- 6. Attempt Answers Table (Relational audit log of user responses)
CREATE TABLE IF NOT EXISTS attempt_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attempt_id INTEGER NOT NULL,
  question_id INTEGER NOT NULL,
  selected_option_id INTEGER,
  is_correct INTEGER DEFAULT 0 CHECK(is_correct IN (0, 1)),
  points_awarded INTEGER DEFAULT 0,
  answered_at INTEGER, -- Unix epoch millisecond timestamp
  UNIQUE(attempt_id, question_id),
  FOREIGN KEY (attempt_id) REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
  FOREIGN KEY (selected_option_id) REFERENCES question_options(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_attempt_answers_attempt ON attempt_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_attempt_answers_question ON attempt_answers(question_id);

-- 7. Audit Log Table (Tracking administrative actions & quiz mutations)
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INTEGER,
  details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
