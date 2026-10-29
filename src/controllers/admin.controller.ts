import { Request, Response } from 'express';
import { quizService } from '../services/quiz.service.ts';
import { get, query, run, transaction } from '../config/db.ts';
import { asyncHandler } from '../utils/asyncHandler.ts';

export const getDashboardStats = asyncHandler(async (_req: Request, res: Response) => {
  const counts = await get<{
    total_quizzes: number;
    total_questions: number;
    total_students: number;
    total_attempts: number;
    passed_attempts: number;
  }>(`
    SELECT 
      (SELECT COUNT(*) FROM quizzes) AS total_quizzes,
      (SELECT COUNT(*) FROM questions) AS total_questions,
      (SELECT COUNT(*) FROM users WHERE role = 'student') AS total_students,
      (SELECT COUNT(*) FROM quiz_attempts WHERE status = 'submitted') AS total_attempts,
      (SELECT COUNT(*) FROM quiz_results WHERE passed = 1) AS passed_attempts;
  `);

  // Performance breakdown per quiz
  const quizPerformance = await query(`
    SELECT 
      q.id, q.title, q.duration_minutes, q.passing_percentage,
      COUNT(DISTINCT qa.id) AS total_attempts,
      COALESCE(ROUND(AVG(qr.percentage), 1), 0) AS average_score,
      COALESCE(ROUND(AVG(qr.passed) * 100, 1), 0) AS pass_percentage_actual
    FROM quizzes q
    LEFT JOIN quiz_attempts qa ON qa.quiz_id = q.id AND qa.status = 'submitted'
    LEFT JOIN quiz_results qr ON qr.attempt_id = qa.id
    GROUP BY q.id;
  `);

  // Item Difficulty / Accuracy rates (Rule: identify questions with high incorrect-answer rates)
  const questionDifficulty = await query(`
    SELECT 
      q.id AS question_id,
      q.question_text,
      qz.title AS quiz_title,
      COUNT(aa.id) AS total_answers,
      SUM(CASE WHEN aa.selected_option_id = cor_opt.id THEN 1 ELSE 0 END) AS correct_answers,
      COUNT(aa.id) - SUM(CASE WHEN aa.selected_option_id = cor_opt.id THEN 1 ELSE 0 END) AS incorrect_answers,
      ROUND(AVG(CASE WHEN aa.selected_option_id = cor_opt.id THEN 1.0 ELSE 0.0 END) * 100, 1) AS accuracy_rate
    FROM questions q
    JOIN quizzes qz ON q.quiz_id = qz.id
    LEFT JOIN attempt_answers aa ON aa.question_id = q.id
    LEFT JOIN answer_options cor_opt ON cor_opt.question_id = q.id AND cor_opt.is_correct = 1
    GROUP BY q.id
    ORDER BY accuracy_rate ASC, total_answers DESC
    LIMIT 10;
  `);

  res.status(200).json({
    success: true,
    data: {
      stats: {
        ...counts,
        pass_rate: counts && counts.total_attempts > 0
          ? Number(((counts.passed_attempts / counts.total_attempts) * 100).toFixed(1))
          : 0,
      },
      quizPerformance,
      questionDifficulty,
    },
  });
});

export const getAllQuizzes = asyncHandler(async (_req: Request, res: Response) => {
  const quizzes = await quizService.getAdminQuizzes();
  res.status(200).json({
    success: true,
    data: quizzes,
  });
});

export const getQuizDetail = asyncHandler(async (req: Request, res: Response) => {
  const quizId = Number(req.params.id);
  const quiz = await quizService.getAdminQuizDetail(quizId);
  res.status(200).json({
    success: true,
    data: quiz,
  });
});

export const createQuiz = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const result = await quizService.createQuiz(req.body, userId);
  res.status(201).json({
    success: true,
    message: 'Quiz created successfully.',
    data: result,
  });
});

export const updateQuiz = asyncHandler(async (req: Request, res: Response) => {
  const quizId = Number(req.params.id);
  await quizService.updateQuiz(quizId, req.body);
  res.status(200).json({
    success: true,
    message: 'Quiz updated successfully.',
  });
});

export const deleteQuiz = asyncHandler(async (req: Request, res: Response) => {
  const quizId = Number(req.params.id);
  await quizService.deleteQuiz(quizId);
  res.status(200).json({
    success: true,
    message: 'Quiz deleted successfully.',
  });
});

export const togglePublish = asyncHandler(async (req: Request, res: Response) => {
  const quizId = Number(req.params.id);
  const { is_published } = req.body;
  await quizService.togglePublish(quizId, Boolean(is_published));
  res.status(200).json({
    success: true,
    message: `Quiz ${is_published ? 'published' : 'unpublished'} successfully.`,
  });
});

export const addQuestion = asyncHandler(async (req: Request, res: Response) => {
  const quizId = Number(req.params.id);
  const result = await quizService.addQuestion(quizId, req.body);
  res.status(201).json({
    success: true,
    message: 'Question added successfully.',
    data: result,
  });
});

export const deleteQuestion = asyncHandler(async (req: Request, res: Response) => {
  const questionId = Number(req.params.id);
  await quizService.deleteQuestion(questionId);
  res.status(200).json({
    success: true,
    message: 'Question deleted successfully.',
  });
});

// Admin: Filtered results report
export const getAllResults = asyncHandler(async (req: Request, res: Response) => {
  const { quizId, studentId, search } = req.query;

  let sql = `
    SELECT 
      qr.id AS result_id,
      qa.id AS attempt_id,
      qa.started_at,
      qa.submitted_at,
      qa.status,
      u.id AS user_id,
      u.name AS student_name,
      u.email AS student_email,
      q.id AS quiz_id,
      q.title AS quiz_title,
      q.duration_minutes,
      q.passing_percentage,
      qr.total_questions,
      qr.correct_answers,
      qr.incorrect_answers,
      qr.unanswered_questions,
      qr.total_marks,
      qr.marks_obtained,
      qr.percentage,
      qr.passed,
      ROUND((qa.submitted_at - qa.started_at) / 1000) AS time_taken_seconds
    FROM quiz_results qr
    JOIN quiz_attempts qa ON qr.attempt_id = qa.id
    JOIN users u ON qa.user_id = u.id
    JOIN quizzes q ON qa.quiz_id = q.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (quizId) {
    sql += ' AND q.id = ?';
    params.push(Number(quizId));
  }
  if (studentId) {
    sql += ' AND u.id = ?';
    params.push(Number(studentId));
  }
  if (search) {
    sql += ' AND (u.name LIKE ? OR u.email LIKE ? OR q.title LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  sql += ' ORDER BY qr.calculated_at DESC;';

  const results = await query(sql, params);
  res.status(200).json({
    success: true,
    data: results,
  });
});

// Admin: Student management view
export const getAllStudents = asyncHandler(async (_req: Request, res: Response) => {
  const students = await query(`
    SELECT 
      u.id, u.name, u.email, u.role, u.created_at,
      COUNT(DISTINCT qa.id) AS total_attempts,
      COUNT(DISTINCT CASE WHEN qr.passed = 1 THEN qr.id ELSE NULL END) AS passed_quizzes,
      COALESCE(ROUND(AVG(qr.percentage), 1), 0) AS average_score
    FROM users u
    LEFT JOIN quiz_attempts qa ON qa.user_id = u.id AND qa.status = 'submitted'
    LEFT JOIN quiz_results qr ON qr.attempt_id = qa.id
    WHERE u.role = 'student'
    GROUP BY u.id
    ORDER BY u.created_at DESC;
  `);

  res.status(200).json({
    success: true,
    data: students,
  });
});

export const exportQuizQuestions = asyncHandler(async (req: Request, res: Response) => {
  const quizId = Number(req.params.id);
  const quiz = await get<{ id: number; title: string }>('SELECT id, title FROM quizzes WHERE id = ?;', [quizId]);
  if (!quiz) {
    return res.status(404).json({ success: false, error: 'Quiz not found.' });
  }

  const questions = await query<any>(
    'SELECT id, question_text, explanation, marks, question_order FROM questions WHERE quiz_id = ? ORDER BY question_order ASC;',
    [quizId]
  );

  const questionIds = questions.map((q) => q.id);
  let options: any[] = [];
  if (questionIds.length > 0) {
    options = await query<any>(
      `SELECT id, question_id, option_text, is_correct, option_order 
       FROM answer_options 
       WHERE question_id IN (${questionIds.map(() => '?').join(',')}) 
       ORDER BY option_order ASC;`,
      questionIds
    );
  }

  const exportPayload = {
    quizTitle: quiz.title,
    exportedAt: new Date().toISOString(),
    questions: questions.map((q) => ({
      question_text: q.question_text,
      explanation: q.explanation,
      marks: q.marks,
      options: options
        .filter((opt) => opt.question_id === q.id)
        .map((opt) => ({
          option_text: opt.option_text,
          is_correct: Boolean(opt.is_correct),
        })),
    })),
  };

  res.setHeader('Content-Disposition', `attachment; filename="quiz_${quizId}_questions.json"`);
  res.status(200).json({ success: true, data: exportPayload });
});

export const importQuizQuestions = asyncHandler(async (req: Request, res: Response) => {
  const quizId = Number(req.params.id);
  const quiz = await get<{ id: number }>('SELECT id FROM quizzes WHERE id = ?;', [quizId]);
  if (!quiz) {
    return res.status(404).json({ success: false, error: 'Quiz not found.' });
  }

  const { questions } = req.body;
  if (!Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ success: false, error: 'Payload must contain a non-empty array of questions.' });
  }

  const currentMaxOrderRes = await get<{ max_order: number }>(
    'SELECT COALESCE(MAX(question_order), 0) AS max_order FROM questions WHERE quiz_id = ?;',
    [quizId]
  );
  let nextOrder = (currentMaxOrderRes?.max_order || 0) + 1;

  let importedCount = 0;

  await transaction(async () => {
    for (const q of questions) {
      if (!q.question_text?.trim() || !Array.isArray(q.options) || q.options.length < 2) {
        throw new Error('Invalid question format: Each question requires text and at least 2 options.');
      }

      const hasCorrect = q.options.some((opt: any) => Boolean(opt.is_correct));
      if (!hasCorrect) {
        throw new Error(`Question "${q.question_text.slice(0, 30)}..." must specify at least one correct option.`);
      }

      const qResult = await run(
        'INSERT INTO questions (quiz_id, question_text, explanation, marks, question_order) VALUES (?, ?, ?, ?, ?);',
        [quizId, q.question_text.trim(), q.explanation?.trim() || null, Number(q.marks) || 1, nextOrder++]
      );

      const questionId = qResult.insertId;
      for (let i = 0; i < q.options.length; i++) {
        const opt = q.options[i];
        await run(
          'INSERT INTO answer_options (question_id, option_text, is_correct, option_order) VALUES (?, ?, ?, ?);',
          [questionId, opt.option_text.trim(), opt.is_correct ? 1 : 0, i + 1]
        );
      }
      importedCount++;
    }
  });

  res.status(201).json({
    success: true,
    message: `Successfully imported ${importedCount} questions into quiz bank.`,
    data: { count: importedCount },
  });
});

