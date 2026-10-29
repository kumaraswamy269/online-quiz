/**
 * Score Calculation and Transaction Integrity Test Suite
 * Tests atomic grading transactions, idempotency, and pass/fail determination
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeDatabase, get, query } from '../src/config/db.ts';
import { attemptService } from '../src/services/attempt.service.ts';
import { scoringService } from '../src/services/scoring.service.ts';

test('Score Calculation & Transaction Test Suite', async (t) => {
  await initializeDatabase();

  await t.test('1. Accurate server-side score calculation and transaction persistence', async () => {
    // Start attempt for Marcus (student 2, id: 3) on Quiz 2 (Node.js, passing mark 70%, 5 questions, 2 marks each = 10 total)
    const session = await attemptService.startAttempt(3, 2);

    // Fetch correct options directly from database to test scoring
    const correctOptions = await query<{ question_id: number; correct_id: number }>(`
      SELECT q.id AS question_id, ao.id AS correct_id
      FROM questions q
      JOIN answer_options ao ON ao.question_id = q.id AND ao.is_correct = 1
      WHERE q.quiz_id = 2;
    `);

    // Prepare answers: 4 correct, 1 incorrect
    const answers: Record<number, number> = {};
    for (let i = 0; i < correctOptions.length; i++) {
      if (i < 4) {
        answers[correctOptions[i].question_id] = correctOptions[i].correct_id; // Correct
      } else {
        // Pick an incorrect option for the 5th question
        const wrongOpt = await get<{ id: number }>(
          'SELECT id FROM answer_options WHERE question_id = ? AND is_correct = 0 LIMIT 1;',
          [correctOptions[i].question_id]
        );
        answers[correctOptions[i].question_id] = wrongOpt!.id;
      }
    }

    // Submit attempt
    const result = await scoringService.submitAttempt(session.attemptId, 3, answers);

    assert.equal(result.total_questions, 5, 'Total questions must match');
    assert.equal(result.correct_answers, 4, 'Correct answers count must equal 4');
    assert.equal(result.incorrect_answers, 1, 'Incorrect answers count must equal 1');
    assert.equal(result.unanswered_questions, 0, 'Unanswered count must be 0');
    assert.equal(result.marks_obtained, 8, 'Marks obtained must be 8 (4 * 2 marks)');
    assert.equal(result.total_marks, 10, 'Total marks must be 10');
    assert.equal(result.percentage, 80.0, 'Percentage must be 80.0%');
    assert.equal(result.passed, true, '80% >= 70% passing threshold -> Passed');

    // Verify record in quiz_results table
    const storedResult = await get<any>('SELECT * FROM quiz_results WHERE attempt_id = ?;', [session.attemptId]);
    assert.ok(storedResult, 'Result record must be persisted in MySQL quiz_results table');
    assert.equal(storedResult.marks_obtained, 8);

    // Verify quiz_attempts status is updated
    const updatedAttempt = await get<any>('SELECT status, submitted_at FROM quiz_attempts WHERE id = ?;', [session.attemptId]);
    assert.equal(updatedAttempt.status, 'submitted');
    assert.ok(updatedAttempt.submitted_at > 0);
  });

  await t.test('2. Idempotent submission: repeated requests return same result without double scoring', async () => {
    // Re-submit the same attempt
    const attempts = await query<any>('SELECT id, user_id FROM quiz_attempts WHERE status = "submitted" LIMIT 1;');
    assert.ok(attempts.length > 0);

    const firstSubmit = await scoringService.submitAttempt(attempts[0].id, attempts[0].user_id);
    const secondSubmit = await scoringService.submitAttempt(attempts[0].id, attempts[0].user_id);

    assert.equal(firstSubmit.marks_obtained, secondSubmit.marks_obtained, 'Marks must be idempotent');

    // Ensure no duplicate rows in quiz_results for this attempt
    const resultsCount = await get<{ count: number }>(
      'SELECT COUNT(*) as count FROM quiz_results WHERE attempt_id = ?;',
      [attempts[0].id]
    );
    assert.equal(resultsCount!.count, 1, 'Exactly one result record must exist per attempt (UNIQUE constraint enforced)');
  });
});
