import { get, query, run, transaction } from '../config/db.ts';
import { AppError } from '../utils/AppError.ts';

export const scoringService = {
  // Idempotent submit & grading within a database transaction
  async submitAttempt(attemptId: number, userId: number, answersMap?: Record<number, number>) {
    return await transaction(async () => {
      // 1. Verify attempt
      const attempt = await get<any>(
        `SELECT qa.id, qa.user_id, qa.quiz_id, qa.status, qa.started_at, qa.expires_at, qa.tab_switches_count,
                q.title AS quiz_title, q.passing_percentage, COALESCE(q.negative_marking_rate, 0.0) AS negative_marking_rate
         FROM quiz_attempts qa
         JOIN quizzes q ON qa.quiz_id = q.id
         WHERE qa.id = ?;`,
        [attemptId]
      );

      if (!attempt) {
        throw new AppError('Attempt not found.', 404);
      }

      if (attempt.user_id !== userId) {
        throw new AppError('Forbidden: Cannot submit another student\'s attempt.', 403);
      }

      // 2. Check if already submitted (Idempotency guarantee)
      if (attempt.status === 'submitted') {
        const existingResult = await get('SELECT * FROM quiz_results WHERE attempt_id = ?;', [attemptId]);
        if (existingResult) {
          return existingResult;
        }
      }

      const now = Date.now();
      const isPastDeadline = now > attempt.expires_at + 5000; // 5s latency grace period

      // 3. Upsert bulk answers if supplied in submit payload
      if (answersMap && typeof answersMap === 'object') {
        for (const [qIdStr, optId] of Object.entries(answersMap)) {
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

      // 4. Fetch all questions and their correct answers from database
      const questions = await query<{
        question_id: number;
        marks: number;
        correct_option_id: number;
      }>(
        `SELECT q.id AS question_id, q.marks, ao.id AS correct_option_id
         FROM questions q
         JOIN answer_options ao ON ao.question_id = q.id AND ao.is_correct = 1
         WHERE q.quiz_id = ?;`,
        [attempt.quiz_id]
      );

      // 5. Fetch student answers from attempt_answers
      const studentAnswers = await query<{
        question_id: number;
        selected_option_id: number | null;
      }>(
        'SELECT question_id, selected_option_id FROM attempt_answers WHERE attempt_id = ?;',
        [attempt.id]
      );

      const studentAnswerMap = new Map<number, number | null>();
      studentAnswers.forEach((sa) => {
        studentAnswerMap.set(sa.question_id, sa.selected_option_id);
      });

      // 6. Calculate score
      let totalQuestions = questions.length;
      let totalMarks = 0;
      let rawMarks = 0;
      let correctAnswers = 0;
      let incorrectAnswers = 0;
      let unansweredQuestions = 0;

      for (const q of questions) {
        totalMarks += q.marks;
        const selected = studentAnswerMap.get(q.question_id);

        if (selected === undefined || selected === null) {
          unansweredQuestions++;
        } else if (selected === q.correct_option_id) {
          correctAnswers++;
          rawMarks += q.marks;
        } else {
          incorrectAnswers++;
        }
      }

      // Negative marking deduction
      const penaltyRate = Number(attempt.negative_marking_rate) || 0.0;
      const avgMarkPerQ = totalQuestions > 0 ? totalMarks / totalQuestions : 1;
      const negativePenalties = Math.round(incorrectAnswers * penaltyRate * avgMarkPerQ * 100) / 100;
      const marksObtained = Math.max(0, Math.round((rawMarks - negativePenalties) * 100) / 100);

      const percentage = totalMarks > 0 ? Number(((marksObtained / totalMarks) * 100).toFixed(2)) : 0.0;
      const passed = percentage >= attempt.passing_percentage ? 1 : 0;
      const targetStatus = isPastDeadline ? 'expired' : 'submitted';

      // Generate verifiable certificate code on passing
      const certificateCode = passed === 1
        ? `QP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
        : null;

      // 7. Insert into quiz_results (Enforcing UNIQUE attempt_id)
      const resultRes = await run(
        `INSERT INTO quiz_results (
          attempt_id, total_questions, correct_answers, incorrect_answers,
          unanswered_questions, total_marks, marks_obtained, negative_penalties, percentage, passed, certificate_code, calculated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(attempt_id)
        DO UPDATE SET
          correct_answers = excluded.correct_answers,
          marks_obtained = excluded.marks_obtained,
          negative_penalties = excluded.negative_penalties,
          percentage = excluded.percentage,
          passed = excluded.passed,
          certificate_code = COALESCE(quiz_results.certificate_code, excluded.certificate_code),
          calculated_at = excluded.calculated_at;`,
        [
          attempt.id,
          totalQuestions,
          correctAnswers,
          incorrectAnswers,
          unansweredQuestions,
          totalMarks,
          marksObtained,
          negativePenalties,
          percentage,
          passed,
          certificateCode,
          now,
        ]
      );

      // 8. Update quiz_attempts status
      await run(
        'UPDATE quiz_attempts SET status = ?, submitted_at = ? WHERE id = ?;',
        [targetStatus, now, attempt.id]
      );

      return {
        id: resultRes.insertId,
        attempt_id: attempt.id,
        quiz_title: attempt.quiz_title,
        status: targetStatus,
        total_questions: totalQuestions,
        correct_answers: correctAnswers,
        incorrect_answers: incorrectAnswers,
        unanswered_questions: unansweredQuestions,
        total_marks: totalMarks,
        marks_obtained: marksObtained,
        negative_penalties: negativePenalties,
        percentage,
        passed: Boolean(passed),
        certificate_code: certificateCode,
        passing_percentage: attempt.passing_percentage,
        time_taken_seconds: Math.max(1, Math.round((Math.min(now, attempt.expires_at) - attempt.started_at) / 1000)),
        tab_switches_count: attempt.tab_switches_count || 0,
      };
    });
  },

  // Finalize expired attempts automatically
  async finalizeAttempt(attemptId: number, status: 'expired' | 'submitted' = 'expired') {
    const attempt = await get<any>('SELECT user_id FROM quiz_attempts WHERE id = ?;', [attemptId]);
    if (!attempt) return null;
    return await this.submitAttempt(attemptId, attempt.user_id);
  },

  // Record proctoring tab switch / blur event
  async recordTabSwitch(attemptId: number, userId: number) {
    const attempt = await get<any>('SELECT id, user_id, status FROM quiz_attempts WHERE id = ?;', [attemptId]);
    if (!attempt || attempt.user_id !== userId || attempt.status !== 'in_progress') {
      return { recorded: false };
    }

    await run('UPDATE quiz_attempts SET tab_switches_count = tab_switches_count + 1 WHERE id = ?;', [attemptId]);
    const updated = await get<{ tab_switches_count: number }>('SELECT tab_switches_count FROM quiz_attempts WHERE id = ?;', [attemptId]);
    return { recorded: true, count: updated?.tab_switches_count || 1 };
  },

  // Verify certificate by unique verification code
  async verifyCertificate(code: string) {
    const cert = await get<any>(
      `SELECT 
        qr.certificate_code, qr.marks_obtained, qr.total_marks, qr.percentage, qr.passed, qr.calculated_at,
        qa.started_at, qa.submitted_at, qa.tab_switches_count,
        q.title AS quiz_title, q.description AS quiz_description, q.duration_minutes, q.passing_percentage,
        u.name AS student_name, u.email AS student_email
      FROM quiz_results qr
      JOIN quiz_attempts qa ON qr.attempt_id = qa.id
      JOIN quizzes q ON qa.quiz_id = q.id
      JOIN users u ON qa.user_id = u.id
      WHERE qr.certificate_code = ? AND qr.passed = 1;`,
      [code.trim().toUpperCase()]
    );

    if (!cert) {
      throw new AppError('Certificate verification failed. No authentic record found for this credential ID.', 404);
    }

    return cert;
  },

  // Get full question breakdown result with SQL JOINs
  async getResult(attemptId: number, userId: number, isAdmin = false) {
    const attempt = await get<any>(
      `SELECT 
        qa.id, qa.user_id, qa.quiz_id, qa.started_at, qa.submitted_at, qa.status, qa.tab_switches_count,
        q.title AS quiz_title, q.description AS quiz_description, q.duration_minutes, q.passing_percentage,
        COALESCE(q.negative_marking_rate, 0.0) AS negative_marking_rate,
        u.name AS student_name, u.email AS student_email,
        qr.total_questions, qr.correct_answers, qr.incorrect_answers, qr.unanswered_questions,
        qr.total_marks, qr.marks_obtained, qr.negative_penalties, qr.percentage, qr.passed,
        qr.certificate_code, qr.calculated_at
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      JOIN users u ON qa.user_id = u.id
      JOIN quiz_results qr ON qr.attempt_id = qa.id
      WHERE qa.id = ?;`,
      [attemptId]
    );

    if (!attempt) {
      throw new AppError('Result not found or assessment has not yet been submitted.', 404);
    }

    if (!isAdmin && attempt.user_id !== userId) {
      throw new AppError('Forbidden: You cannot view results belonging to another student.', 403);
    }

    // Detailed question and option comparison using multi-table JOINs
    const questionsBreakdown = await query<any>(
      `SELECT 
        q.id AS question_id,
        q.question_text,
        q.explanation,
        q.marks,
        q.question_order,
        aa.selected_option_id,
        sel_opt.option_text AS selected_option_text,
        cor_opt.id AS correct_option_id,
        cor_opt.option_text AS correct_option_text,
        CASE WHEN aa.selected_option_id = cor_opt.id THEN 1 ELSE 0 END AS is_correct
      FROM questions q
      LEFT JOIN attempt_answers aa ON aa.question_id = q.id AND aa.attempt_id = ?
      LEFT JOIN answer_options sel_opt ON aa.selected_option_id = sel_opt.id
      JOIN answer_options cor_opt ON cor_opt.question_id = q.id AND cor_opt.is_correct = 1
      WHERE q.quiz_id = ?
      ORDER BY q.question_order ASC;`,
      [attempt.id, attempt.quiz_id]
    );

    // Fetch all options for review
    const questionIds = questionsBreakdown.map((q) => q.question_id);
    let allOptions: any[] = [];
    if (questionIds.length > 0) {
      allOptions = await query(
        `SELECT id, question_id, option_text, is_correct, option_order
         FROM answer_options
         WHERE question_id IN (${questionIds.map(() => '?').join(',')})
         ORDER BY option_order ASC;`,
        questionIds
      );
    }

    const questionsWithChoices = questionsBreakdown.map((q) => ({
      ...q,
      is_correct: Boolean(q.is_correct),
      options: allOptions.filter((opt) => opt.question_id === q.question_id),
    }));

    const timeTakenSeconds = Math.round(((attempt.submitted_at || Date.now()) - attempt.started_at) / 1000);

    return {
      result: {
        ...attempt,
        passed: Boolean(attempt.passed),
        time_taken_seconds: Math.max(1, timeTakenSeconds),
      },
      questions: questionsWithChoices,
    };
  },

  // Student: Get my quiz results history
  async getStudentHistory(userId: number) {
    return await query(`
      SELECT 
        qa.id AS attempt_id,
        qa.quiz_id,
        q.title AS quiz_title,
        q.passing_percentage,
        qa.started_at,
        qa.submitted_at,
        qa.status,
        qa.tab_switches_count,
        qr.total_questions,
        qr.correct_answers,
        qr.incorrect_answers,
        qr.unanswered_questions,
        qr.total_marks,
        qr.marks_obtained,
        qr.negative_penalties,
        qr.percentage,
        qr.passed,
        qr.certificate_code,
        ROUND((qa.submitted_at - qa.started_at) / 1000) AS time_taken_seconds
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      JOIN quiz_results qr ON qr.attempt_id = qa.id
      WHERE qa.user_id = ?
      ORDER BY qa.id DESC;
    `, [userId]);
  },
};
