-- ========================================================================
-- ONLINE QUIZ SYSTEM - RELATIONAL DATABASE SCHEMA (MySQL 8.0+ / InnoDB)
-- Third Normal Form (3NF) Architecture with Referential Integrity
-- ========================================================================

-- Create Database if not exists
CREATE DATABASE IF NOT EXISTS online_quiz_system
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE online_quiz_system;

-- Disable foreign key checks during schema re-creation
SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------------------
-- 1. USERS TABLE
-- Stores authenticated entities (Administrators and Students)
-- Passwords are encrypted using bcrypt (60 character salted hashes)
-- ------------------------------------------------------------------------
DROP TABLE IF EXISTS users;
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('student', 'admin') NOT NULL DEFAULT 'student',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_users_email UNIQUE (email),
  INDEX idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------
-- 2. QUIZZES TABLE
-- Stores assessment configurations, time limits, and availability windows
-- ------------------------------------------------------------------------
DROP TABLE IF EXISTS quizzes;
CREATE TABLE quizzes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  duration_minutes INT NOT NULL DEFAULT 10,
  passing_percentage DECIMAL(5, 2) NOT NULL DEFAULT 70.00,
  is_published TINYINT(1) NOT NULL DEFAULT 1,
  available_from DATETIME NULL,
  available_until DATETIME NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_quizzes_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT chk_duration CHECK (duration_minutes >= 1),
  CONSTRAINT chk_passing_percentage CHECK (passing_percentage >= 0.00 AND passing_percentage <= 100.00),
  INDEX idx_quizzes_is_published (is_published),
  INDEX idx_quizzes_created_by (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------
-- 3. QUESTIONS TABLE
-- Stores questions associated with quizzes in 1-to-Many relationship
-- ------------------------------------------------------------------------
DROP TABLE IF EXISTS questions;
CREATE TABLE questions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  quiz_id INT NOT NULL,
  question_text TEXT NOT NULL,
  explanation TEXT NULL,
  marks INT NOT NULL DEFAULT 1,
  question_order INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_questions_quiz FOREIGN KEY (quiz_id) REFERENCES quizzes (id) ON DELETE CASCADE,
  CONSTRAINT chk_question_marks CHECK (marks > 0),
  INDEX idx_questions_quiz_id (quiz_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------
-- 4. ANSWER_OPTIONS TABLE
-- Normalized storage for multiple choice options
-- is_correct = 1 designates the official key (isolated on server)
-- ------------------------------------------------------------------------
DROP TABLE IF EXISTS answer_options;
CREATE TABLE answer_options (
  id INT AUTO_INCREMENT PRIMARY KEY,
  question_id INT NOT NULL,
  option_text TEXT NOT NULL,
  is_correct TINYINT(1) NOT NULL DEFAULT 0,
  option_order INT NOT NULL DEFAULT 1,
  CONSTRAINT fk_options_question FOREIGN KEY (question_id) REFERENCES questions (id) ON DELETE CASCADE,
  INDEX idx_options_question_id (question_id),
  INDEX idx_options_is_correct (question_id, is_correct)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------
-- 5. QUIZ_ATTEMPTS TABLE
-- Tracks student quiz sessions with server-authoritative timestamps
-- Status transitions: 'in_progress' -> 'submitted' OR 'expired'
-- ------------------------------------------------------------------------
DROP TABLE IF EXISTS quiz_attempts;
CREATE TABLE quiz_attempts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  quiz_id INT NOT NULL,
  started_at BIGINT NOT NULL,        -- Server epoch milliseconds
  expires_at BIGINT NOT NULL,        -- Server epoch milliseconds = started_at + (duration_minutes * 60000)
  submitted_at BIGINT NULL,          -- Server epoch milliseconds on completion
  status ENUM('in_progress', 'submitted', 'expired', 'abandoned') NOT NULL DEFAULT 'in_progress',
  CONSTRAINT fk_attempts_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_attempts_quiz FOREIGN KEY (quiz_id) REFERENCES quizzes (id) ON DELETE CASCADE,
  INDEX idx_attempts_user_quiz (user_id, quiz_id),
  INDEX idx_attempts_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------
-- 6. ATTEMPT_ANSWERS TABLE
-- Audit log of selected option for each question within an attempt
-- Enforces UNIQUE(attempt_id, question_id) to guarantee idempotency
-- ------------------------------------------------------------------------
DROP TABLE IF EXISTS attempt_answers;
CREATE TABLE attempt_answers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  attempt_id INT NOT NULL,
  question_id INT NOT NULL,
  selected_option_id INT NULL,
  answered_at BIGINT NULL,
  CONSTRAINT fk_attempt_answers_attempt FOREIGN KEY (attempt_id) REFERENCES quiz_attempts (id) ON DELETE CASCADE,
  CONSTRAINT fk_attempt_answers_question FOREIGN KEY (question_id) REFERENCES questions (id) ON DELETE CASCADE,
  CONSTRAINT fk_attempt_answers_option FOREIGN KEY (selected_option_id) REFERENCES answer_options (id) ON DELETE SET NULL,
  CONSTRAINT uq_attempt_question UNIQUE (attempt_id, question_id),
  INDEX idx_attempt_answers_attempt (attempt_id),
  INDEX idx_attempt_answers_question (question_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------
-- 7. QUIZ_RESULTS TABLE
-- Relational snapshot of graded outcome calculated by server transaction
-- Enforces UNIQUE(attempt_id) to prevent duplicate score awarding
-- ------------------------------------------------------------------------
DROP TABLE IF EXISTS quiz_results;
CREATE TABLE quiz_results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  attempt_id INT NOT NULL,
  total_questions INT NOT NULL,
  correct_answers INT NOT NULL,
  incorrect_answers INT NOT NULL,
  unanswered_questions INT NOT NULL,
  total_marks INT NOT NULL,
  marks_obtained INT NOT NULL,
  percentage DECIMAL(5, 2) NOT NULL,
  passed TINYINT(1) NOT NULL DEFAULT 0,
  calculated_at BIGINT NOT NULL,
  CONSTRAINT fk_results_attempt FOREIGN KEY (attempt_id) REFERENCES quiz_attempts (id) ON DELETE CASCADE,
  CONSTRAINT uq_results_attempt UNIQUE (attempt_id),
  INDEX idx_results_passed (passed)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Re-enable foreign key constraints
SET FOREIGN_KEY_CHECKS = 1;
