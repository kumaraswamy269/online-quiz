import { get, query, run } from '../config/db.ts';
import { AppError } from '../utils/AppError.ts';

export const quizService = {
  // Public / Student: List published quizzes
  async getPublishedQuizzes(search?: string) {
    let sql = `
      SELECT 
        q.id, q.title, q.description, q.duration_minutes, q.passing_percentage,
        q.is_published, q.created_at,
        u.name AS created_by_name,
        COUNT(DISTINCT qu.id) AS total_questions,
        COALESCE(SUM(qu.marks), 0) AS total_marks,
        COUNT(DISTINCT qa.id) AS total_attempts,
        ROUND(AVG(CASE WHEN qr.id IS NOT NULL THEN qr.percentage ELSE NULL END), 1) AS avg_score,
        ROUND(AVG(CASE WHEN qr.id IS NOT NULL THEN qr.passed ELSE NULL END) * 100, 1) AS pass_rate
      FROM quizzes q
      JOIN users u ON q.created_by = u.id
      LEFT JOIN questions qu ON qu.quiz_id = q.id
      LEFT JOIN quiz_attempts qa ON qa.quiz_id = q.id
      LEFT JOIN quiz_results qr ON qr.attempt_id = qa.id
      WHERE q.is_published = 1
    `;
    const params: any[] = [];

    if (search) {
      sql += ' AND (q.title LIKE ? OR q.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ' GROUP BY q.id ORDER BY q.created_at DESC;';
    return await query(sql, params);
  },

  // Student / Public: Get single quiz instructions
  async getQuizById(id: number) {
    const quiz = await get(`
      SELECT 
        q.id, q.title, q.description, q.duration_minutes, q.passing_percentage,
        q.is_published, q.created_at,
        u.name AS created_by_name,
        COUNT(DISTINCT qu.id) AS total_questions,
        COALESCE(SUM(qu.marks), 0) AS total_marks
      FROM quizzes q
      JOIN users u ON q.created_by = u.id
      LEFT JOIN questions qu ON qu.quiz_id = q.id
      WHERE q.id = ?
      GROUP BY q.id;
    `, [id]);

    if (!quiz) {
      throw new AppError('Quiz not found.', 404);
    }

    // Top leaderboard for this quiz
    const leaderboard = await query(`
      SELECT 
        u.name AS student_name,
        qr.marks_obtained,
        qr.total_marks,
        qr.percentage,
        ROUND((qa.submitted_at - qa.started_at) / 1000) AS time_taken_seconds,
        qa.submitted_at
      FROM quiz_results qr
      JOIN quiz_attempts qa ON qr.attempt_id = qa.id
      JOIN users u ON qa.user_id = u.id
      WHERE qa.quiz_id = ? AND qa.status = 'submitted'
      ORDER BY qr.marks_obtained DESC, time_taken_seconds ASC
      LIMIT 10;
    `, [id]);

    return { ...quiz, leaderboard };
  },

  // Admin: Get all quizzes
  async getAdminQuizzes() {
    return await query(`
      SELECT 
        q.id, q.title, q.description, q.duration_minutes, q.passing_percentage,
        q.is_published, q.created_at, q.updated_at,
        u.name AS created_by_name,
        COUNT(DISTINCT qu.id) AS total_questions,
        COALESCE(SUM(qu.marks), 0) AS total_marks,
        COUNT(DISTINCT qa.id) AS total_attempts,
        ROUND(AVG(qr.percentage), 1) AS avg_percentage
      FROM quizzes q
      JOIN users u ON q.created_by = u.id
      LEFT JOIN questions qu ON qu.quiz_id = q.id
      LEFT JOIN quiz_attempts qa ON qa.quiz_id = q.id
      LEFT JOIN quiz_results qr ON qr.attempt_id = qa.id
      GROUP BY q.id
      ORDER BY q.id DESC;
    `);
  },

  // Admin: Get single quiz with questions and answer keys
  async getAdminQuizDetail(id: number) {
    const quiz = await get('SELECT * FROM quizzes WHERE id = ?;', [id]);
    if (!quiz) {
      throw new AppError('Quiz not found.', 404);
    }

    const questions = await query(
      'SELECT * FROM questions WHERE quiz_id = ? ORDER BY question_order ASC;',
      [id]
    );

    const questionIds = questions.map((q) => q.id);
    let options: any[] = [];
    if (questionIds.length > 0) {
      options = await query(
        `SELECT * FROM answer_options WHERE question_id IN (${questionIds.map(() => '?').join(',')}) ORDER BY option_order ASC;`,
        questionIds
      );
    }

    const questionsWithOptions = questions.map((q) => ({
      ...q,
      options: options.filter((opt) => opt.question_id === q.id),
    }));

    return { ...quiz, questions: questionsWithOptions };
  },

  // Admin: Create quiz
  async createQuiz(data: any, userId: number) {
    const result = await run(
      `INSERT INTO quizzes (title, description, duration_minutes, passing_percentage, is_published, created_by)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [
        data.title.trim(),
        data.description?.trim() || null,
        Number(data.duration_minutes) || 10,
        Number(data.passing_percentage) || 70.0,
        data.is_published ? 1 : 0,
        userId,
      ]
    );
    return { id: result.insertId };
  },

  // Admin: Update quiz
  async updateQuiz(id: number, data: any) {
    const quiz = await get('SELECT id FROM quizzes WHERE id = ?;', [id]);
    if (!quiz) {
      throw new AppError('Quiz not found.', 404);
    }

    await run(
      `UPDATE quizzes SET
        title = ?,
        description = ?,
        duration_minutes = ?,
        passing_percentage = ?,
        is_published = ?
       WHERE id = ?;`,
      [
        data.title.trim(),
        data.description?.trim() || null,
        Number(data.duration_minutes) || 10,
        Number(data.passing_percentage) || 70.0,
        data.is_published ? 1 : 0,
        id,
      ]
    );
  },

  // Admin: Delete quiz
  async deleteQuiz(id: number) {
    const quiz = await get('SELECT id FROM quizzes WHERE id = ?;', [id]);
    if (!quiz) {
      throw new AppError('Quiz not found.', 404);
    }
    await run('DELETE FROM quizzes WHERE id = ?;', [id]);
  },

  // Admin: Publish / Unpublish quiz with validation
  async togglePublish(id: number, isPublished: boolean) {
    const quiz = await get('SELECT id, title FROM quizzes WHERE id = ?;', [id]);
    if (!quiz) {
      throw new AppError('Quiz not found.', 404);
    }

    if (isPublished) {
      // Rule 7.6: Ensure every question has at least one valid correct answer before publishing
      const questionsWithoutCorrect = await query(`
        SELECT q.id, q.question_text
        FROM questions q
        LEFT JOIN answer_options ao ON ao.question_id = q.id AND ao.is_correct = 1
        WHERE q.quiz_id = ?
        GROUP BY q.id
        HAVING COUNT(ao.id) = 0;
      `, [id]);

      if (questionsWithoutCorrect.length > 0) {
        throw new AppError(
          `Cannot publish quiz. Question "${questionsWithoutCorrect[0].question_text}" has no correct answer configured.`,
          400
        );
      }
    }

    await run('UPDATE quizzes SET is_published = ? WHERE id = ?;', [isPublished ? 1 : 0, id]);
  },

  // Admin: Add Question with options
  async addQuestion(quizId: number, data: any) {
    const quiz = await get('SELECT id FROM quizzes WHERE id = ?;', [quizId]);
    if (!quiz) {
      throw new AppError('Quiz not found.', 404);
    }

    // Get max question_order
    const maxOrder = await get<{ max_order: number }>(
      'SELECT COALESCE(MAX(question_order), 0) AS max_order FROM questions WHERE quiz_id = ?;',
      [quizId]
    );
    const nextOrder = (maxOrder?.max_order || 0) + 1;

    const qRes = await run(
      'INSERT INTO questions (quiz_id, question_text, explanation, marks, question_order) VALUES (?, ?, ?, ?, ?);',
      [quizId, data.question_text.trim(), data.explanation?.trim() || null, Number(data.marks) || 1, nextOrder]
    );

    const questionId = qRes.insertId;

    for (let i = 0; i < data.options.length; i++) {
      const opt = data.options[i];
      await run(
        'INSERT INTO answer_options (question_id, option_text, is_correct, option_order) VALUES (?, ?, ?, ?);',
        [questionId, opt.option_text.trim(), opt.is_correct ? 1 : 0, i + 1]
      );
    }

    return { questionId };
  },

  // Admin: Delete Question
  async deleteQuestion(questionId: number) {
    await run('DELETE FROM questions WHERE id = ?;', [questionId]);
  },
};
