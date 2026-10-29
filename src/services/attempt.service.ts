import { get, query, run } from '../config/db.ts';
import { AppError } from '../utils/AppError.ts';
import { scoringService } from './scoring.service.ts';

export const attemptService = {
  // Start a new server-controlled timed quiz attempt
  async startAttempt(userId: number, quizId: number) {
    // 1. Verify quiz exists and is published
    const quiz = await get<{ id: number; title: string; duration_minutes: number; is_published: number }>(
      'SELECT id, title, duration_minutes, is_published FROM quizzes WHERE id = ?;',
      [quizId]
    );

    if (!quiz || quiz.is_published !== 1) {
      throw new AppError('Quiz is not available or unpublished.', 404);
    }

    // 2. Prevent duplicate active simultaneous attempts for the same quiz
    const activeAttempt = await get<any>(
      `SELECT id, started_at, expires_at 
       FROM quiz_attempts 
       WHERE user_id = ? AND quiz_id = ? AND status = 'in_progress';`,
      [userId, quizId]
    );

    const now = Date.now();

    if (activeAttempt) {
      // Check if existing attempt is already expired on server
      if (now > activeAttempt.expires_at) {
        // Auto-finalize and close the stale attempt
        await scoringService.finalizeAttempt(activeAttempt.id, 'expired');
      } else {
        // Resume existing active attempt
        return await this.getAttempt(activeAttempt.id, userId);
      }
    }

    // 3. Check quiz has questions
    const questionCount = await get<{ count: number }>(
      'SELECT COUNT(*) as count FROM questions WHERE quiz_id = ?;',
      [quizId]
    );

    if (!questionCount || questionCount.count === 0) {
      throw new AppError('This examination currently has no questions.', 400);
    }

    // 4. Server-Authoritative Timestamps
    const durationMs = quiz.duration_minutes * 60 * 1000;
    const startedAt = now;
    const expiresAt = now + durationMs;

    // 5. Create attempt record in MySQL
    const insertRes = await run(
      `INSERT INTO quiz_attempts (user_id, quiz_id, started_at, expires_at, status)
       VALUES (?, ?, ?, ?, 'in_progress');`,
      [userId, quizId, startedAt, expiresAt]
    );

    const attemptId = insertRes.insertId;

    // 6. Return attempt with sanitized questions (answers omitted!)
    return await this.getAttempt(attemptId, userId);
  },

  // Get active attempt state (for initial start or page refresh recovery)
  async getAttempt(attemptId: number, userId: number) {
    const attempt = await get<any>(
      `SELECT 
        qa.id, qa.user_id, qa.quiz_id, qa.started_at, qa.expires_at, qa.submitted_at, qa.status, qa.tab_switches_count,
        q.title AS quiz_title, q.duration_minutes, q.passing_percentage,
        COALESCE(q.negative_marking_rate, 0.0) AS negative_marking_rate,
        COALESCE(q.shuffle_questions, 0) AS shuffle_questions
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      WHERE qa.id = ?;`,
      [attemptId]
    );

    if (!attempt) {
      throw new AppError('Quiz attempt not found.', 404);
    }

    // Verify ownership
    if (attempt.user_id !== userId) {
      throw new AppError('Forbidden: You cannot access another student\'s attempt.', 403);
    }

    const now = Date.now();
    const remainingMs = attempt.expires_at - now;
    const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));

    // Server-enforced expiry check (grace period: 2 seconds for network latency)
    if (attempt.status === 'in_progress' && remainingMs < -2000) {
      await scoringService.finalizeAttempt(attempt.id, 'expired');
      throw new AppError('The examination duration has expired. Your answers have been auto-submitted.', 403, {
        status: 'expired',
        attemptId: attempt.id,
      });
    }

    // Fetch questions without answer keys
    let questions = await query<{
      id: number;
      question_text: string;
      marks: number;
      question_order: number;
    }>(
      `SELECT id, question_text, marks, question_order
       FROM questions
       WHERE quiz_id = ?
       ORDER BY question_order ASC;`,
      [attempt.quiz_id]
    );

    // If shuffle_questions enabled, sort pseudo-randomly with deterministic seed (attempt.id)
    if (attempt.shuffle_questions === 1 && questions.length > 1) {
      const seed = Number(attempt.id) || 1;
      questions = [...questions].sort((a, b) => {
        const hashA = (a.id * 19 + seed * 7) % 101;
        const hashB = (b.id * 19 + seed * 7) % 101;
        return hashA - hashB;
      });
    }

    const questionIds = questions.map((q) => q.id);
    let options: any[] = [];
    if (questionIds.length > 0) {
      // Secure delivery: is_correct is intentionally excluded!
      options = await query(
        `SELECT id, question_id, option_text, option_order
         FROM answer_options
         WHERE question_id IN (${questionIds.map(() => '?').join(',')})
         ORDER BY option_order ASC;`,
        questionIds
      );
    }

    // Fetch student's saved draft answers
    const savedAnswers = await query<{ question_id: number; selected_option_id: number }>(
      'SELECT question_id, selected_option_id FROM attempt_answers WHERE attempt_id = ?;',
      [attempt.id]
    );

    const answersMap: Record<number, number> = {};
    savedAnswers.forEach((a) => {
      answersMap[a.question_id] = a.selected_option_id;
    });

    const formattedQuestions = questions.map((q) => ({
      ...q,
      options: options.filter((opt) => opt.question_id === q.id),
      selected_option_id: answersMap[q.id] || null,
    }));

    return {
      attemptId: attempt.id,
      quizId: attempt.quiz_id,
      quizTitle: attempt.quiz_title,
      status: attempt.status,
      startedAt: attempt.started_at,
      expiresAt: attempt.expires_at,
      remainingSeconds,
      negativeMarkingRate: Number(attempt.negative_marking_rate) || 0.0,
      tabSwitchesCount: attempt.tab_switches_count || 0,
      questions: formattedQuestions,
      answersMap,
    };
  },

  // Save single answer with server-authoritative timer validation
  async saveAnswer(attemptId: number, questionId: number, selectedOptionId: number | null, userId: number) {
    const attempt = await get<any>(
      'SELECT id, user_id, quiz_id, status, expires_at FROM quiz_attempts WHERE id = ?;',
      [attemptId]
    );

    if (!attempt) {
      throw new AppError('Attempt not found.', 404);
    }

    if (attempt.user_id !== userId) {
      throw new AppError('Forbidden: Cannot save answers to another student\'s attempt.', 403);
    }

    if (attempt.status !== 'in_progress') {
      throw new AppError(`Cannot modify answers: Attempt is already ${attempt.status}.`, 400);
    }

    // Server-enforced clock validation
    const now = Date.now();
    if (now > attempt.expires_at + 2000) {
      await scoringService.finalizeAttempt(attempt.id, 'expired');
      throw new AppError('Examination time expired.', 403, { status: 'expired' });
    }

    // Validate that question belongs to this quiz
    const question = await get('SELECT id FROM questions WHERE id = ? AND quiz_id = ?;', [
      questionId,
      attempt.quiz_id,
    ]);
    if (!question) {
      throw new AppError('Question does not belong to this quiz.', 400);
    }

    // Validate that option belongs to this question if provided
    if (selectedOptionId) {
      const option = await get('SELECT id FROM answer_options WHERE id = ? AND question_id = ?;', [
        selectedOptionId,
        questionId,
      ]);
      if (!option) {
        throw new AppError('Selected option does not belong to this question.', 400);
      }
    }

    // Idempotent upsert in attempt_answers
    await run(
      `INSERT INTO attempt_answers (attempt_id, question_id, selected_option_id, answered_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(attempt_id, question_id)
       DO UPDATE SET selected_option_id = excluded.selected_option_id, answered_at = excluded.answered_at;`,
      [attempt.id, questionId, selectedOptionId || null, now]
    );

    const remainingSeconds = Math.max(0, Math.floor((attempt.expires_at - now) / 1000));
    return { saved: true, questionId, selectedOptionId, remainingSeconds };
  },
};
