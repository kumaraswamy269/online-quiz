import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { get, query, run, transaction } from './db.ts';
import { seedInitialData } from './seed.ts';

const router = Router();

// ==========================================
// 1. PUBLIC CATEGORIES & QUIZZES API
// ==========================================

// Get all categories with quiz counts and topic breakdowns
router.get('/categories', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await query(`
      SELECT 
        c.id, c.name, c.slug, c.description, c.icon, c.color,
        COUNT(DISTINCT q.id) as quiz_count,
        COUNT(DISTINCT q.topic) as topic_count,
        GROUP_CONCAT(DISTINCT q.topic) as topics_csv
      FROM categories c
      LEFT JOIN quizzes q ON q.category_id = c.id AND q.is_published = 1
      GROUP BY c.id
      ORDER BY c.id ASC;
    `);

    const mapped = categories.map((cat: any) => {
      const rawTopics = cat.topics_csv ? cat.topics_csv.split(',') : [];
      const topics = Array.from(new Set(rawTopics.map((t: string) => t.trim()).filter((t: string) => t && t !== 'General')));
      return {
        ...cat,
        topics,
        topic_count: topics.length || (cat.quiz_count > 0 ? 1 : 0),
      };
    });

    res.json({ success: true, data: mapped });
  } catch (err) {
    next(err);
  }
});

// Get quizzes with category info, topic, question count, and attempt statistics
router.get('/quizzes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, difficulty, search, topic } = req.query;
    let sql = `
      SELECT 
        q.id, q.title, q.slug, q.description, q.time_limit_seconds, 
        q.pass_percentage, q.difficulty, q.is_published, q.created_at,
        COALESCE(q.topic, 'General') as topic,
        c.id as category_id, c.name as category_name, c.color as category_color, c.icon as category_icon,
        COUNT(DISTINCT qu.id) as question_count,
        COALESCE(SUM(qu.points), 0) as total_points,
        COUNT(DISTINCT qa.id) as total_attempts,
        ROUND(AVG(CASE WHEN qa.status = 'completed' THEN qa.percentage ELSE NULL END), 1) as avg_score,
        ROUND(AVG(CASE WHEN qa.status = 'completed' THEN qa.passed ELSE NULL END) * 100, 1) as pass_rate
      FROM quizzes q
      JOIN categories c ON q.category_id = c.id
      LEFT JOIN questions qu ON qu.quiz_id = q.id
      LEFT JOIN quiz_attempts qa ON qa.quiz_id = q.id
      WHERE q.is_published = 1
    `;
    const params: any[] = [];

    if (category) {
      sql += ' AND c.slug = ?';
      params.push(category);
    }
    if (difficulty) {
      sql += ' AND q.difficulty = ?';
      params.push(difficulty);
    }
    if (topic) {
      sql += ' AND q.topic = ?';
      params.push(topic);
    }
    if (search) {
      sql += ' AND (q.title LIKE ? OR q.description LIKE ? OR q.topic LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ' GROUP BY q.id ORDER BY q.created_at DESC;';

    const quizzes = await query(sql, params);
    res.json({ success: true, data: quizzes });
  } catch (err) {
    next(err);
  }
});

// Get single quiz details (public view, instructions, leaderboard)
router.get('/quizzes/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quizId = Number(req.params.id);
    if (!quizId) {
      return res.status(400).json({ success: false, error: 'Invalid quiz ID' });
    }

    const quiz = await get(`
      SELECT 
        q.id, q.title, q.slug, q.description, q.time_limit_seconds, 
        q.pass_percentage, q.difficulty, q.is_published, q.created_at,
        COALESCE(q.topic, 'General') as topic,
        c.id as category_id, c.name as category_name, c.color as category_color, c.icon as category_icon,
        COUNT(DISTINCT qu.id) as question_count,
        COALESCE(SUM(qu.points), 0) as total_points,
        COUNT(DISTINCT qa.id) as total_attempts,
        ROUND(AVG(CASE WHEN qa.status = 'completed' THEN qa.percentage ELSE NULL END), 1) as avg_score,
        ROUND(AVG(CASE WHEN qa.status = 'completed' THEN qa.passed ELSE NULL END) * 100, 1) as pass_rate
      FROM quizzes q
      JOIN categories c ON q.category_id = c.id
      LEFT JOIN questions qu ON qu.quiz_id = q.id
      LEFT JOIN quiz_attempts qa ON qa.quiz_id = q.id
      WHERE q.id = ?
      GROUP BY q.id;
    `, [quizId]);

    if (!quiz) {
      return res.status(404).json({ success: false, error: 'Quiz not found' });
    }

    // Fetch top 10 leaderboard for this quiz
    const leaderboard = await query(`
      SELECT 
        qa.id, qa.user_name, qa.score, qa.max_score, qa.percentage,
        qa.time_taken_seconds, qa.completed_at
      FROM quiz_attempts qa
      WHERE qa.quiz_id = ? AND qa.status = 'completed'
      ORDER BY qa.score DESC, qa.time_taken_seconds ASC
      LIMIT 10;
    `, [quizId]);

    res.json({ success: true, data: { ...quiz, leaderboard } });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 2. SERVER-TIMED QUIZ ENGINE & ATTEMPTS API
// ==========================================

// Start a quiz session (Server authoritative timer initialization)
router.post('/attempts/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { quizId, userName, userEmail } = req.body;

    if (!quizId || !userName?.trim() || !userEmail?.trim()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Quiz ID, candidate name, and email address are required.' 
      });
    }

    // Verify quiz exists and is published
    const quiz = await get<{ id: number; title: string; time_limit_seconds: number; is_published: number }>(
      'SELECT id, title, time_limit_seconds, is_published FROM quizzes WHERE id = ?;',
      [quizId]
    );

    if (!quiz || quiz.is_published !== 1) {
      return res.status(404).json({ success: false, error: 'Quiz is unavailable or not published.' });
    }

    // Count available questions
    const questionCountRes = await get<{ count: number }>(
      'SELECT COUNT(*) as count FROM questions WHERE quiz_id = ?;',
      [quizId]
    );

    if (!questionCountRes || questionCountRes.count === 0) {
      return res.status(400).json({ success: false, error: 'This quiz has no questions yet.' });
    }

    // Calculate server timestamps
    const now = Date.now();
    const durationMs = quiz.time_limit_seconds * 1000;
    const expiresAt = now + durationMs;
    const sessionToken = crypto.randomUUID();

    // Insert new attempt record
    const insertRes = await run(
      `INSERT INTO quiz_attempts (
        session_token, quiz_id, user_name, user_email, status,
        started_at, expires_at, total_questions
      ) VALUES (?, ?, ?, ?, 'in_progress', ?, ?, ?);`,
      [sessionToken, quizId, userName.trim(), userEmail.trim(), now, expiresAt, questionCountRes.count]
    );

    // Fetch questions and options SECURELY (is_correct is omitted!)
    const questions = await query<{
      id: number;
      question_text: string;
      points: number;
      sort_order: number;
    }>(
      `SELECT id, question_text, points, sort_order 
       FROM questions 
       WHERE quiz_id = ? 
       ORDER BY sort_order ASC;`,
      [quizId]
    );

    const questionIds = questions.map((q) => q.id);
    let options: Array<{
      id: number;
      question_id: number;
      option_text: string;
      sort_order: number;
    }> = [];

    if (questionIds.length > 0) {
      // Fetch only public option info
      options = await query(
        `SELECT id, question_id, option_text, sort_order 
         FROM question_options 
         WHERE question_id IN (${questionIds.map(() => '?').join(',')})
         ORDER BY sort_order ASC;`,
        questionIds
      );
    }

    // Assemble questions with options
    const formattedQuestions = questions.map((q) => ({
      ...q,
      options: options.filter((opt) => opt.question_id === q.id),
    }));

    res.json({
      success: true,
      data: {
        sessionToken,
        attemptId: insertRes.lastInsertRowid,
        userName: userName.trim(),
        userEmail: userEmail.trim(),
        quiz: {
          id: quiz.id,
          title: quiz.title,
          timeLimitSeconds: quiz.time_limit_seconds,
        },
        serverTime: now,
        startedAt: now,
        expiresAt,
        remainingSeconds: quiz.time_limit_seconds,
        questions: formattedQuestions,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Resume or get active session state (with server remaining time and draft answers)
router.get('/attempts/:sessionToken/active', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionToken } = req.params;

    const attempt = await get<any>(
      `SELECT 
        qa.id, qa.session_token, qa.quiz_id, qa.user_name, qa.user_email,
        qa.status, qa.started_at, qa.expires_at, qa.completed_at,
        q.title as quiz_title, q.time_limit_seconds, q.pass_percentage
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      WHERE qa.session_token = ?;`,
      [sessionToken]
    );

    if (!attempt) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    const now = Date.now();
    const remainingMs = attempt.expires_at - now;
    const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));

    // Check if session has expired on server
    if (attempt.status === 'in_progress' && remainingMs < -2000) {
      // 2 seconds grace period exceeded -> trigger auto-grading and expire
      await autoGradeAttempt(attempt.id);
      return res.status(400).json({
        success: false,
        error: 'Quiz time limit has expired. Your answers have been automatically graded.',
        status: 'expired',
        sessionToken,
      });
    }

    // If already completed or expired, redirect to result
    if (attempt.status !== 'in_progress') {
      return res.json({
        success: true,
        data: {
          status: attempt.status,
          sessionToken,
          isCompleted: true,
        },
      });
    }

    // Fetch secure questions without answers
    const questions = await query<{
      id: number;
      question_text: string;
      points: number;
      sort_order: number;
    }>(
      `SELECT id, question_text, points, sort_order 
       FROM questions 
       WHERE quiz_id = ? 
       ORDER BY sort_order ASC;`,
      [attempt.quiz_id]
    );

    const questionIds = questions.map((q) => q.id);
    let options: any[] = [];
    if (questionIds.length > 0) {
      options = await query(
        `SELECT id, question_id, option_text, sort_order 
         FROM question_options 
         WHERE question_id IN (${questionIds.map(() => '?').join(',')})
         ORDER BY sort_order ASC;`,
        questionIds
      );
    }

    // Fetch existing saved draft answers
    const draftAnswers = await query<{ question_id: number; selected_option_id: number }>(
      'SELECT question_id, selected_option_id FROM attempt_answers WHERE attempt_id = ?;',
      [attempt.id]
    );

    const answersMap: Record<number, number> = {};
    for (const a of draftAnswers) {
      answersMap[a.question_id] = a.selected_option_id;
    }

    const formattedQuestions = questions.map((q) => ({
      ...q,
      options: options.filter((opt) => opt.question_id === q.id),
      selectedOptionId: answersMap[q.id] || null,
    }));

    res.json({
      success: true,
      data: {
        sessionToken: attempt.session_token,
        quizId: attempt.quiz_id,
        quizTitle: attempt.quiz_title,
        userName: attempt.user_name,
        startedAt: attempt.started_at,
        expiresAt: attempt.expires_at,
        serverTime: now,
        remainingSeconds,
        questions: formattedQuestions,
        answersMap,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Save or change a draft answer during the active quiz
router.post('/attempts/:sessionToken/save-answer', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionToken } = req.params;
    const { questionId, selectedOptionId } = req.body;

    if (!questionId) {
      return res.status(400).json({ success: false, error: 'Question ID is required.' });
    }

    const attempt = await get<any>(
      'SELECT id, quiz_id, status, started_at, expires_at FROM quiz_attempts WHERE session_token = ?;',
      [sessionToken]
    );

    if (!attempt) {
      return res.status(404).json({ success: false, error: 'Quiz attempt session not found.' });
    }

    if (attempt.status !== 'in_progress') {
      return res.status(400).json({
        success: false,
        error: `Attempt is no longer in progress (status: ${attempt.status}).`,
        status: attempt.status,
      });
    }

    // Server-side strict expiration check (with 2 seconds grace for latency)
    const now = Date.now();
    if (now > attempt.expires_at + 2000) {
      await autoGradeAttempt(attempt.id);
      return res.status(403).json({
        success: false,
        error: 'Quiz time expired. Your assessment has been finalized.',
        status: 'expired',
      });
    }

    // Verify question belongs to this quiz
    const question = await get('SELECT id FROM questions WHERE id = ? AND quiz_id = ?;', [
      questionId,
      attempt.quiz_id,
    ]);
    if (!question) {
      return res.status(400).json({ success: false, error: 'Question does not belong to this quiz.' });
    }

    // Verify option belongs to this question if provided
    if (selectedOptionId) {
      const option = await get('SELECT id FROM question_options WHERE id = ? AND question_id = ?;', [
        selectedOptionId,
        questionId,
      ]);
      if (!option) {
        return res.status(400).json({ success: false, error: 'Option does not belong to this question.' });
      }
    }

    // Upsert answer in relational attempt_answers table
    await run(
      `INSERT INTO attempt_answers (attempt_id, question_id, selected_option_id, answered_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(attempt_id, question_id) 
       DO UPDATE SET selected_option_id = excluded.selected_option_id, answered_at = excluded.answered_at;`,
      [attempt.id, questionId, selectedOptionId || null, now]
    );

    const remainingSeconds = Math.max(0, Math.floor((attempt.expires_at - now) / 1000));

    res.json({
      success: true,
      data: {
        saved: true,
        questionId,
        selectedOptionId,
        remainingSeconds,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Proctoring Security: Record tab switch / window blur event
router.post('/attempts/:sessionToken/proctor-event', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionToken } = req.params;
    const attempt = await get<any>('SELECT id, status FROM quiz_attempts WHERE session_token = ?;', [sessionToken]);
    if (!attempt || attempt.status !== 'in_progress') {
      return res.json({ success: true, recorded: false });
    }

    await run('UPDATE quiz_attempts SET tab_switches_count = COALESCE(tab_switches_count, 0) + 1 WHERE id = ?;', [attempt.id]);
    const updated = await get<{ tab_switches_count: number }>('SELECT tab_switches_count FROM quiz_attempts WHERE id = ?;', [attempt.id]);
    res.json({ success: true, count: updated?.tab_switches_count || 1 });
  } catch (err) {
    next(err);
  }
});

// Finalize and submit quiz: Server-Authoritative Grading & Persistence
router.post('/attempts/:sessionToken/submit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionToken } = req.params;
    const { answers } = req.body; // Optional bulk answers payload: { [questionId]: optionId }

    const attempt = await get<any>(
      `SELECT 
        qa.id, qa.quiz_id, qa.status, qa.started_at, qa.expires_at, qa.user_name, qa.user_email,
        q.title as quiz_title, q.time_limit_seconds, q.pass_percentage
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      WHERE qa.session_token = ?;`,
      [sessionToken]
    );

    if (!attempt) {
      return res.status(404).json({ success: false, error: 'Attempt session not found' });
    }

    if (attempt.status === 'completed') {
      return res.json({
        success: true,
        message: 'This attempt was already submitted.',
        data: { sessionToken, isCompleted: true },
      });
    }

    const now = Date.now();
    // Allow submission even if slightly past deadline (up to 5s grace), otherwise marked expired
    const isPastDeadline = now > attempt.expires_at + 5000;

    // If answers passed in submit body, upsert them first
    if (answers && typeof answers === 'object') {
      for (const [qIdStr, optId] of Object.entries(answers)) {
        const qId = Number(qIdStr);
        if (qId && optId) {
          await run(
            `INSERT INTO attempt_answers (attempt_id, question_id, selected_option_id, answered_at)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(attempt_id, question_id)
             DO UPDATE SET selected_option_id = excluded.selected_option_id, answered_at = excluded.answered_at;`,
            [attempt.id, qId, Number(optId), now]
          );
        }
      }
    }

    // Perform atomic server grading
    const gradedResult = await gradeAttempt(attempt.id, isPastDeadline ? 'expired' : 'completed');

    res.json({
      success: true,
      data: gradedResult,
    });
  } catch (err) {
    next(err);
  }
});

// Helper function to grade an attempt atomically
async function autoGradeAttempt(attemptId: number): Promise<void> {
  await gradeAttempt(attemptId, 'expired');
}

async function gradeAttempt(attemptId: number, targetStatus: 'completed' | 'expired') {
  return await transaction(async () => {
    // 1. Fetch attempt and quiz data with negative marking and proctor tracking
    const attempt = await get<any>(
      `SELECT 
        qa.id, qa.session_token, qa.quiz_id, qa.started_at, qa.expires_at, qa.user_name, qa.user_email,
        qa.tab_switches_count,
        q.title, q.pass_percentage, COALESCE(q.negative_marking_rate, 0.0) as negative_marking_rate
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      WHERE qa.id = ?;`,
      [attemptId]
    );

    if (!attempt) throw new Error('Attempt not found for grading');

    // 2. Fetch all questions and their correct options using SQL JOIN
    const questionDetails = await query<{
      question_id: number;
      points: number;
      correct_option_id: number;
    }>(
      `SELECT 
        q.id as question_id,
        q.points,
        qo.id as correct_option_id
      FROM questions q
      JOIN question_options qo ON qo.question_id = q.id AND qo.is_correct = 1
      WHERE q.quiz_id = ?;`,
      [attempt.quiz_id]
    );

    // 3. Fetch user recorded answers
    const userAnswers = await query<{
      question_id: number;
      selected_option_id: number | null;
    }>(
      'SELECT question_id, selected_option_id FROM attempt_answers WHERE attempt_id = ?;',
      [attemptId]
    );

    const userAnswerMap = new Map<number, number | null>();
    for (const ua of userAnswers) {
      userAnswerMap.set(ua.question_id, ua.selected_option_id);
    }

    // 4. Calculate score, correct answers, and update attempt_answers table
    let totalScore = 0;
    let maxScore = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let unansweredCount = 0;

    for (const q of questionDetails) {
      maxScore += q.points;
      const selectedOpt = userAnswerMap.get(q.question_id);

      if (selectedOpt === undefined || selectedOpt === null) {
        unansweredCount++;
        // Record unattempted question in attempt_answers
        await run(
          `INSERT INTO attempt_answers (attempt_id, question_id, selected_option_id, is_correct, points_awarded, answered_at)
           VALUES (?, ?, NULL, 0, 0, ?)
           ON CONFLICT(attempt_id, question_id)
           DO UPDATE SET is_correct = 0, points_awarded = 0;`,
          [attemptId, q.question_id, Date.now()]
        );
      } else if (selectedOpt === q.correct_option_id) {
        correctCount++;
        totalScore += q.points;
        await run(
          `UPDATE attempt_answers 
           SET is_correct = 1, points_awarded = ? 
           WHERE attempt_id = ? AND question_id = ?;`,
          [q.points, attemptId, q.question_id]
        );
      } else {
        incorrectCount++;
        await run(
          `UPDATE attempt_answers 
           SET is_correct = 0, points_awarded = 0 
           WHERE attempt_id = ? AND question_id = ?;`,
          [attemptId, q.question_id]
        );
      }
    }

    // Negative marking penalty deduction
    const penaltyRate = Number(attempt.negative_marking_rate) || 0.0;
    const negativePenalties = Number((incorrectCount * penaltyRate).toFixed(2));
    const finalScore = Math.max(0, Number((totalScore - negativePenalties).toFixed(2)));

    const percentage = maxScore > 0 ? Number(((finalScore / maxScore) * 100).toFixed(1)) : 0;
    const passed = percentage >= attempt.pass_percentage ? 1 : 0;
    const now = Date.now();
    const timeTakenSeconds = Math.max(1, Math.round((Math.min(now, attempt.expires_at) - attempt.started_at) / 1000));

    // Verifiable unique certificate code for passing candidates
    const certificateCode = passed === 1
      ? `CERT-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
      : null;

    // 5. Update quiz_attempts row
    await run(
      `UPDATE quiz_attempts SET
        status = ?,
        completed_at = ?,
        time_taken_seconds = ?,
        score = ?,
        max_score = ?,
        percentage = ?,
        passed = ?,
        total_questions = ?,
        correct_answers_count = ?,
        incorrect_answers_count = ?,
        unanswered_count = ?,
        certificate_code = ?,
        negative_penalties = ?
      WHERE id = ?;`,
      [
        targetStatus,
        now,
        timeTakenSeconds,
        finalScore,
        maxScore,
        percentage,
        passed,
        questionDetails.length,
        correctCount,
        incorrectCount,
        unansweredCount,
        certificateCode,
        negativePenalties,
        attemptId,
      ]
    );

    return {
      sessionToken: attempt.session_token,
      attemptId,
      status: targetStatus,
      score: finalScore,
      rawScore: totalScore,
      negativePenalties,
      penaltyRate,
      maxScore,
      percentage,
      passed: Boolean(passed),
      passPercentage: attempt.pass_percentage,
      timeTakenSeconds,
      correctCount,
      incorrectCount,
      unansweredCount,
      totalQuestions: questionDetails.length,
      tabSwitchesCount: attempt.tab_switches_count || 0,
      certificateCode,
    };
  });
}

// Get full review and result breakdown for a completed quiz attempt (SQL joins)
router.get('/attempts/:sessionToken/result', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionToken } = req.params;

    const attempt = await get<any>(
      `SELECT 
        qa.id, qa.session_token, qa.quiz_id, qa.user_name, qa.user_email,
        qa.status, qa.started_at, qa.completed_at, qa.time_taken_seconds,
        qa.score, qa.max_score, qa.percentage, qa.passed,
        qa.total_questions, qa.correct_answers_count, qa.incorrect_answers_count, qa.unanswered_count,
        qa.tab_switches_count, qa.certificate_code, qa.negative_penalties,
        q.title as quiz_title, q.description as quiz_description, q.pass_percentage, q.time_limit_seconds,
        COALESCE(q.negative_marking_rate, 0.0) as negative_marking_rate,
        c.name as category_name, c.color as category_color
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      JOIN categories c ON q.category_id = c.id
      WHERE qa.session_token = ?;`,
      [sessionToken]
    );

    if (!attempt) {
      return res.status(404).json({ success: false, error: 'Attempt not found' });
    }

    // Detailed question and answer breakdown using SQL JOINs
    // JOINS: attempt_answers -> questions -> user chosen option -> correct option
    const questionsBreakdown = await query<any>(
      `SELECT 
        q.id as question_id,
        q.question_text,
        q.explanation,
        q.points,
        q.sort_order,
        aa.selected_option_id,
        aa.is_correct,
        aa.points_awarded,
        sel_opt.option_text as selected_option_text,
        cor_opt.id as correct_option_id,
        cor_opt.option_text as correct_option_text
      FROM questions q
      LEFT JOIN attempt_answers aa ON aa.question_id = q.id AND aa.attempt_id = ?
      LEFT JOIN question_options sel_opt ON aa.selected_option_id = sel_opt.id
      JOIN question_options cor_opt ON cor_opt.question_id = q.id AND cor_opt.is_correct = 1
      WHERE q.quiz_id = ?
      ORDER BY q.sort_order ASC;`,
      [attempt.id, attempt.quiz_id]
    );

    // Also fetch all options for each question so user can see what the alternatives were
    const questionIds = questionsBreakdown.map((q) => q.question_id);
    let allOptions: any[] = [];
    if (questionIds.length > 0) {
      allOptions = await query(
        `SELECT id, question_id, option_text, is_correct, sort_order 
         FROM question_options 
         WHERE question_id IN (${questionIds.map(() => '?').join(',')})
         ORDER BY sort_order ASC;`,
        questionIds
      );
    }

    const reviewQuestions = questionsBreakdown.map((qb) => ({
      ...qb,
      is_correct: Boolean(qb.is_correct),
      options: allOptions.filter((opt) => opt.question_id === qb.question_id),
    }));

    res.json({
      success: true,
      data: {
        attempt: {
          ...attempt,
          passed: Boolean(attempt.passed),
        },
        questions: reviewQuestions,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Institutional Certificate Verification (Public Verifiable Credential)
router.get('/certificates/verify/:code', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const code = String(req.params.code).trim().toUpperCase();
    const cert = await get<any>(
      `SELECT 
        qa.id as attempt_id, qa.user_name as student_name, qa.user_email as student_email,
        qa.score, qa.max_score, qa.percentage, qa.passed, qa.completed_at,
        qa.tab_switches_count, qa.certificate_code,
        q.id as quiz_id, q.title as quiz_title, q.description as quiz_description,
        q.pass_percentage, q.time_limit_seconds,
        c.name as category_name
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      JOIN categories c ON q.category_id = c.id
      WHERE UPPER(qa.certificate_code) = ? AND qa.passed = 1;`,
      [code]
    );

    if (!cert) {
      return res.status(404).json({ 
        success: false, 
        error: 'Certificate not found. The specified credential ID does not match any authenticated passing examination records.' 
      });
    }

    res.json({ success: true, data: cert });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 3. ADMIN QUIZ & SYSTEM MANAGEMENT API
// ==========================================

// Admin overview analytics
router.get('/admin/overview', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const counts = await get<{
      total_quizzes: number;
      total_questions: number;
      total_attempts: number;
      passed_attempts: number;
    }>(`
      SELECT 
        (SELECT COUNT(*) FROM quizzes) as total_quizzes,
        (SELECT COUNT(*) FROM questions) as total_questions,
        (SELECT COUNT(*) FROM quiz_attempts) as total_attempts,
        (SELECT COUNT(*) FROM quiz_attempts WHERE passed = 1) as passed_attempts;
    `);

    // Category distribution
    const categoryStats = await query(`
      SELECT 
        c.id, c.name, c.color,
        COUNT(DISTINCT q.id) as quiz_count,
        COUNT(DISTINCT qu.id) as question_count
      FROM categories c
      LEFT JOIN quizzes q ON q.category_id = c.id
      LEFT JOIN questions qu ON qu.quiz_id = q.id
      GROUP BY c.id;
    `);

    // Recent attempts with user and quiz information
    const recentAttempts = await query(`
      SELECT 
        qa.id, qa.session_token, qa.user_name, qa.user_email, qa.status,
        qa.percentage, qa.passed, qa.score, qa.max_score, qa.time_taken_seconds, qa.completed_at,
        q.title as quiz_title
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      ORDER BY qa.id DESC
      LIMIT 10;
    `);

    // Audit logs
    const auditLogs = await query(`
      SELECT id, action, entity_type, entity_id, details, created_at 
      FROM audit_logs 
      ORDER BY id DESC 
      LIMIT 15;
    `);

    res.json({
      success: true,
      data: {
        stats: {
          ...counts,
          pass_rate: counts && counts.total_attempts > 0 
            ? Number(((counts.passed_attempts / counts.total_attempts) * 100).toFixed(1))
            : 0,
        },
        categoryStats,
        recentAttempts,
        auditLogs,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Admin: Get all quizzes with complete data for editing
router.get('/admin/quizzes', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const quizzes = await query(`
      SELECT 
        q.id, q.category_id, q.title, q.slug, q.description,
        q.time_limit_seconds, q.pass_percentage, q.difficulty, q.is_published, q.created_at,
        COALESCE(q.topic, 'General') as topic,
        c.name as category_name, c.color as category_color,
        COUNT(DISTINCT qu.id) as question_count,
        COUNT(DISTINCT qa.id) as attempt_count,
        ROUND(AVG(qa.percentage), 1) as avg_score
      FROM quizzes q
      JOIN categories c ON q.category_id = c.id
      LEFT JOIN questions qu ON qu.quiz_id = q.id
      LEFT JOIN quiz_attempts qa ON qa.quiz_id = q.id AND qa.status = 'completed'
      GROUP BY q.id
      ORDER BY q.id DESC;
    `);
    res.json({ success: true, data: quizzes });
  } catch (err) {
    next(err);
  }
});

// Admin: Get single quiz with all its questions & options (including is_correct for management)
router.get('/admin/quizzes/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quizId = Number(req.params.id);
    const quiz = await get('SELECT * FROM quizzes WHERE id = ?;', [quizId]);
    if (!quiz) {
      return res.status(404).json({ success: false, error: 'Quiz not found' });
    }

    const questions = await query(
      'SELECT * FROM questions WHERE quiz_id = ? ORDER BY sort_order ASC;',
      [quizId]
    );

    const questionIds = questions.map((q) => q.id);
    let options: any[] = [];
    if (questionIds.length > 0) {
      options = await query(
        `SELECT * FROM question_options WHERE question_id IN (${questionIds.map(() => '?').join(',')}) ORDER BY sort_order ASC;`,
        questionIds
      );
    }

    const questionsWithOptions = questions.map((q) => ({
      ...q,
      options: options.filter((o) => o.question_id === q.id),
    }));

    res.json({
      success: true,
      data: {
        ...quiz,
        questions: questionsWithOptions,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Admin: Create Quiz
router.post('/admin/quizzes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { categoryId, title, description, timeLimitSeconds, passPercentage, difficulty, isPublished, topic } = req.body;

    if (!categoryId || !title?.trim()) {
      return res.status(400).json({ success: false, error: 'Title and category are required.' });
    }

    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now().toString().slice(-4);

    const result = await run(
      `INSERT INTO quizzes (
        category_id, title, slug, description, time_limit_seconds,
        pass_percentage, difficulty, is_published, topic
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        categoryId,
        title.trim(),
        slug,
        description || '',
        Number(timeLimitSeconds) || 600,
        Number(passPercentage) || 70,
        difficulty || 'medium',
        isPublished ? 1 : 0,
        (topic && topic.trim()) || 'General',
      ]
    );

    await run('INSERT INTO audit_logs (action, entity_type, entity_id, details) VALUES (?, ?, ?, ?);', [
      'CREATE_QUIZ',
      'QUIZ',
      result.lastInsertRowid,
      `Created quiz "${title}" in topic "${topic || 'General'}"`,
    ]);

    res.json({ success: true, data: { id: result.lastInsertRowid } });
  } catch (err) {
    next(err);
  }
});

// Admin: Update Quiz
router.put('/admin/quizzes/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quizId = Number(req.params.id);
    const { categoryId, title, description, timeLimitSeconds, passPercentage, difficulty, isPublished, topic } = req.body;

    await run(
      `UPDATE quizzes SET
        category_id = ?,
        title = ?,
        description = ?,
        time_limit_seconds = ?,
        pass_percentage = ?,
        difficulty = ?,
        is_published = ?,
        topic = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?;`,
      [
        categoryId,
        title.trim(),
        description || '',
        Number(timeLimitSeconds) || 600,
        Number(passPercentage) || 70,
        difficulty || 'medium',
        isPublished ? 1 : 0,
        (topic && topic.trim()) || 'General',
        quizId,
      ]
    );

    await run('INSERT INTO audit_logs (action, entity_type, entity_id, details) VALUES (?, ?, ?, ?);', [
      'UPDATE_QUIZ',
      'QUIZ',
      quizId,
      `Updated quiz settings for ID ${quizId}`,
    ]);

    res.json({ success: true, message: 'Quiz updated successfully' });
  } catch (err) {
    next(err);
  }
});

// Admin: Delete Quiz (ON DELETE CASCADE handles questions, options, and attempts)
router.delete('/admin/quizzes/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quizId = Number(req.params.id);
    await run('DELETE FROM quizzes WHERE id = ?;', [quizId]);

    await run('INSERT INTO audit_logs (action, entity_type, entity_id, details) VALUES (?, ?, ?, ?);', [
      'DELETE_QUIZ',
      'QUIZ',
      quizId,
      `Deleted quiz ID ${quizId} and cascaded dependent relations`,
    ]);

    res.json({ success: true, message: 'Quiz and all associated questions deleted' });
  } catch (err) {
    next(err);
  }
});

// Admin: Add Question to Quiz
router.post('/admin/quizzes/:id/questions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quizId = Number(req.params.id);
    const { questionText, explanation, points, options } = req.body;

    if (!questionText?.trim() || !Array.isArray(options) || options.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Question text and at least 2 options are required.',
      });
    }

    const hasCorrect = options.some((opt: any) => opt.isCorrect);
    if (!hasCorrect) {
      return res.status(400).json({
        success: false,
        error: 'At least one option must be marked as the correct answer.',
      });
    }

    const result = await transaction(async () => {
      // Get next sort order
      const maxSort = await get<{ max_sort: number }>(
        'SELECT COALESCE(MAX(sort_order), 0) as max_sort FROM questions WHERE quiz_id = ?;',
        [quizId]
      );
      const nextSort = (maxSort?.max_sort || 0) + 1;

      const qRes = await run(
        'INSERT INTO questions (quiz_id, question_text, explanation, points, sort_order) VALUES (?, ?, ?, ?, ?);',
        [quizId, questionText.trim(), explanation?.trim() || '', Number(points) || 1, nextSort]
      );

      const questionId = qRes.lastInsertRowid;

      for (let i = 0; i < options.length; i++) {
        const opt = options[i];
        await run(
          'INSERT INTO question_options (question_id, option_text, is_correct, sort_order) VALUES (?, ?, ?, ?);',
          [questionId, opt.text.trim(), opt.isCorrect ? 1 : 0, i + 1]
        );
      }

      return questionId;
    });

    await run('INSERT INTO audit_logs (action, entity_type, entity_id, details) VALUES (?, ?, ?, ?);', [
      'ADD_QUESTION',
      'QUESTION',
      result,
      `Added question to quiz ID ${quizId}`,
    ]);

    res.json({ success: true, data: { questionId: result } });
  } catch (err) {
    next(err);
  }
});

// Admin: Delete Question
router.delete('/admin/questions/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const questionId = Number(req.params.id);
    await run('DELETE FROM questions WHERE id = ?;', [questionId]);
    res.json({ success: true, message: 'Question deleted successfully' });
  } catch (err) {
    next(err);
  }
});

// Admin: Export questions as JSON
router.get('/admin/quizzes/:id/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quizId = Number(req.params.id);
    const quiz = await get<{ id: number; title: string }>('SELECT id, title FROM quizzes WHERE id = ?;', [quizId]);
    if (!quiz) return res.status(404).json({ success: false, error: 'Quiz not found' });

    const questions = await query<any>(
      'SELECT id, question_text, explanation, points, sort_order FROM questions WHERE quiz_id = ? ORDER BY sort_order ASC;',
      [quizId]
    );

    const questionIds = questions.map((q) => q.id);
    let options: any[] = [];
    if (questionIds.length > 0) {
      options = await query<any>(
        `SELECT id, question_id, option_text, is_correct, sort_order 
         FROM question_options 
         WHERE question_id IN (${questionIds.map(() => '?').join(',')}) 
         ORDER BY sort_order ASC;`,
        questionIds
      );
    }

    const exportData = {
      quizTitle: quiz.title,
      exportedAt: new Date().toISOString(),
      questions: questions.map((q) => ({
        question_text: q.question_text,
        explanation: q.explanation,
        points: q.points,
        options: options
          .filter((opt) => opt.question_id === q.id)
          .map((opt) => ({
            text: opt.option_text,
            isCorrect: Boolean(opt.is_correct),
          })),
      })),
    };

    res.json({ success: true, data: exportData });
  } catch (err) {
    next(err);
  }
});

// Admin: Bulk Import questions from JSON
router.post('/admin/quizzes/:id/import', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quizId = Number(req.params.id);
    const quiz = await get<{ id: number }>('SELECT id FROM quizzes WHERE id = ?;', [quizId]);
    if (!quiz) return res.status(404).json({ success: false, error: 'Quiz not found' });

    const { questions } = req.body;
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ success: false, error: 'Payload must contain a non-empty array of questions.' });
    }

    const currentMax = await get<{ max_sort: number }>(
      'SELECT COALESCE(MAX(sort_order), 0) as max_sort FROM questions WHERE quiz_id = ?;',
      [quizId]
    );
    let nextSort = (currentMax?.max_sort || 0) + 1;
    let count = 0;

    await transaction(async () => {
      for (const q of questions) {
        const text = q.question_text || q.text;
        const opts = q.options || [];
        if (!text?.trim() || !Array.isArray(opts) || opts.length < 2) {
          throw new Error('Each question requires text and at least 2 options.');
        }

        const hasCorrect = opts.some((o: any) => Boolean(o.isCorrect || o.is_correct));
        if (!hasCorrect) {
          throw new Error(`Question "${text.slice(0, 30)}..." must specify at least one correct option.`);
        }

        const qRes = await run(
          'INSERT INTO questions (quiz_id, question_text, explanation, points, sort_order) VALUES (?, ?, ?, ?, ?);',
          [quizId, text.trim(), q.explanation?.trim() || '', Number(q.points || q.marks) || 1, nextSort++]
        );

        const questionId = qRes.lastInsertRowid;
        for (let i = 0; i < opts.length; i++) {
          const opt = opts[i];
          const optText = opt.text || opt.option_text;
          const isCorrect = Boolean(opt.isCorrect || opt.is_correct);
          await run(
            'INSERT INTO question_options (question_id, option_text, is_correct, sort_order) VALUES (?, ?, ?, ?);',
            [questionId, optText.trim(), isCorrect ? 1 : 0, i + 1]
          );
        }
        count++;
      }
    });

    res.json({ success: true, message: `Successfully imported ${count} questions.`, count });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Import failed' });
  }
});


// Admin: Question Analytics (Item difficulty and discrimination analysis using SQL joins)
router.get('/admin/questions/analytics/:quizId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quizId = Number(req.params.quizId);

    const analytics = await query(`
      SELECT 
        q.id as question_id,
        q.question_text,
        q.points,
        q.sort_order,
        COUNT(aa.id) as total_attempts,
        COALESCE(SUM(aa.is_correct), 0) as correct_answers,
        COUNT(aa.id) - COALESCE(SUM(aa.is_correct), 0) as incorrect_answers,
        ROUND(AVG(aa.is_correct) * 100, 1) as accuracy_percentage
      FROM questions q
      LEFT JOIN attempt_answers aa ON aa.question_id = q.id
      WHERE q.quiz_id = ?
      GROUP BY q.id
      ORDER BY accuracy_percentage ASC, total_attempts DESC;
    `, [quizId]);

    res.json({ success: true, data: analytics });
  } catch (err) {
    next(err);
  }
});

// Interactive Study / Practice Mode: Immediate answer check with explanation
router.post('/quizzes/:id/practice-check', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quizId = Number(req.params.id);
    const { questionId, selectedOptionId } = req.body;

    if (!questionId) {
      return res.status(400).json({ success: false, error: 'Question ID is required.' });
    }

    const question = await get<any>(
      'SELECT id, quiz_id, question_text, explanation, points FROM questions WHERE id = ? AND quiz_id = ?;',
      [questionId, quizId]
    );

    if (!question) {
      return res.status(404).json({ success: false, error: 'Question not found.' });
    }

    const correctOption = await get<any>(
      'SELECT id, option_text FROM question_options WHERE question_id = ? AND is_correct = 1;',
      [questionId]
    );

    const isCorrect = correctOption ? Number(selectedOptionId) === Number(correctOption.id) : false;

    res.json({
      success: true,
      data: {
        questionId,
        selectedOptionId,
        isCorrect,
        correctOptionId: correctOption?.id,
        correctOptionText: correctOption?.option_text,
        explanation: question.explanation || 'Review the core concept thoroughly to understand why this option is correct.',
        points: question.points,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Admin: Proctoring Audit Logs and Attempt Surveillance
router.get('/admin/proctoring-logs', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const attempts = await query<any>(`
      SELECT 
        qa.id, qa.session_token, qa.user_name, qa.user_email, qa.status,
        qa.tab_switches_count, qa.score, qa.max_score, qa.percentage, qa.passed,
        qa.started_at, qa.completed_at, qa.time_taken_seconds,
        q.title as quiz_title
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      ORDER BY qa.tab_switches_count DESC, qa.id DESC
      LIMIT 100;
    `);

    const totalFlagged = attempts.filter((a: any) => (a.tab_switches_count || 0) > 0).length;

    res.json({
      success: true,
      data: {
        attempts,
        totalFlagged,
        totalMonitored: attempts.length,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Admin: Export student examination attempts as CSV
router.get('/admin/export/attempts-csv', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const attempts = await query<any>(`
      SELECT 
        qa.id, qa.user_name, qa.user_email, q.title as quiz_title,
        qa.status, qa.score, qa.max_score, qa.percentage,
        CASE WHEN qa.passed = 1 THEN 'PASSED' ELSE 'FAILED' END as result,
        qa.tab_switches_count,
        ROUND(COALESCE(qa.time_taken_seconds, 0)) as duration_seconds,
        qa.certificate_code,
        datetime(qa.started_at / 1000, 'unixepoch') as started_date,
        datetime(qa.completed_at / 1000, 'unixepoch') as completed_date
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      ORDER BY qa.id DESC;
    `);

    const headers = [
      'Attempt ID',
      'Student Name',
      'Email',
      'Quiz Title',
      'Status',
      'Score',
      'Max Score',
      'Percentage',
      'Result',
      'Tab Switches (Proctor Flags)',
      'Duration (Seconds)',
      'Certificate Code',
      'Started At',
      'Completed At'
    ];

    const rows = attempts.map((a: any) => [
      a.id,
      `"${(a.user_name || '').replace(/"/g, '""')}"`,
      `"${(a.user_email || '').replace(/"/g, '""')}"`,
      `"${(a.quiz_title || '').replace(/"/g, '""')}"`,
      a.status,
      a.score ?? 0,
      a.max_score ?? 0,
      `${a.percentage ?? 0}%`,
      a.result,
      a.tab_switches_count || 0,
      a.duration_seconds || 0,
      a.certificate_code || 'N/A',
      a.started_date || '',
      a.completed_date || ''
    ].join(','));

    const csvContent = [headers.join(','), ...rows].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="quizpulse_attempts_export.csv"');
    res.status(200).send(csvContent);
  } catch (err) {
    next(err);
  }
});

// Admin: Export leaderboard as CSV
router.get('/admin/export/leaderboard-csv', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const leaderboard = await query<any>(`
      SELECT 
        qa.id, qa.user_name, q.title as quiz_title,
        qa.score, qa.max_score, qa.percentage,
        qa.time_taken_seconds,
        datetime(qa.completed_at / 1000, 'unixepoch') as completion_date
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      WHERE qa.status = 'completed' AND qa.passed = 1
      ORDER BY qa.score DESC, qa.time_taken_seconds ASC;
    `);

    const headers = ['Rank', 'Student Name', 'Quiz Title', 'Score', 'Max Score', 'Percentage', 'Time Taken (s)', 'Completion Date'];
    const rows = leaderboard.map((row: any, idx: number) => [
      idx + 1,
      `"${(row.user_name || '').replace(/"/g, '""')}"`,
      `"${(row.quiz_title || '').replace(/"/g, '""')}"`,
      row.score ?? 0,
      row.max_score ?? 0,
      `${row.percentage ?? 0}%`,
      row.time_taken_seconds ?? 0,
      row.completion_date || ''
    ].join(','));

    const csvContent = [headers.join(','), ...rows].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="quizpulse_leaderboard_export.csv"');
    res.status(200).send(csvContent);
  } catch (err) {
    next(err);
  }
});


// Admin: SQL Query Explorer & Schema Inspector
router.post('/admin/sql-console', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sql } = req.body;
    if (!sql || typeof sql !== 'string') {
      return res.status(400).json({ success: false, error: 'SQL query string is required' });
    }

    const trimmed = sql.trim();
    // Safety check: allow SELECT, PRAGMA, EXPLAIN queries
    const isReadOnly = /^(SELECT|PRAGMA|EXPLAIN)\s+/i.test(trimmed);

    if (!isReadOnly) {
      return res.status(403).json({
        success: false,
        error: 'The interactive SQL Console supports read-only queries (SELECT, PRAGMA, EXPLAIN) for relational database inspection.',
      });
    }

    const startTime = Date.now();
    const rows = await query(trimmed);
    const executionTimeMs = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        rows,
        rowCount: rows.length,
        executionTimeMs,
      },
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err.message || 'SQL Execution error',
    });
  }
});

// Admin: Reset / Re-seed database to pristine state
router.post('/admin/seed-reset', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // Drop tables and re-seed
    await run('DROP TABLE IF EXISTS audit_logs;');
    await run('DROP TABLE IF EXISTS attempt_answers;');
    await run('DROP TABLE IF EXISTS quiz_attempts;');
    await run('DROP TABLE IF EXISTS question_options;');
    await run('DROP TABLE IF EXISTS questions;');
    await run('DROP TABLE IF EXISTS quizzes;');
    await run('DROP TABLE IF EXISTS categories;');

    await seedInitialData();

    res.json({ success: true, message: 'Database reset and seeded with initial curriculum.' });
  } catch (err) {
    next(err);
  }
});

export default router;
