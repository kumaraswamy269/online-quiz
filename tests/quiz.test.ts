/**
 * Quiz and Session Security Test Suite
 * Tests secure delivery, option validation, attempt isolation, and server timing
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeDatabase, get } from '../src/config/db.ts';
import { quizService } from '../src/services/quiz.service.ts';
import { attemptService } from '../src/services/attempt.service.ts';

test('Quiz and Session Security Test Suite', async (t) => {
  await initializeDatabase();

  await t.test('1. List only published quizzes in student view', async () => {
    const quizzes = await quizService.getPublishedQuizzes();
    assert.ok(quizzes.length >= 4, 'Should list published curriculum quizzes');
    const hasUnpublished = quizzes.some((q: any) => q.is_published === 0);
    assert.equal(hasUnpublished, false, 'Unpublished draft quizzes must be hidden from student catalog');
  });

  await t.test('2. Secure Question Delivery: answer keys must NOT be present in student payload', async () => {
    // Start attempt for student 1 (id: 2) on quiz 1
    const session = await attemptService.startAttempt(2, 1);
    assert.ok(session.attemptId, 'Attempt ID created');
    assert.ok(session.questions.length > 0, 'Questions returned');

    // Verify questions and options do NOT expose is_correct
    session.questions.forEach((q: any) => {
      assert.equal(q.is_correct, undefined, 'Question object must not leak correct answer');
      q.options.forEach((opt: any) => {
        assert.equal(opt.is_correct, undefined, 'Option object must not contain is_correct key');
      });
    });
  });

  await t.test('3. Save and retrieve draft answers', async () => {
    const session = await attemptService.startAttempt(2, 1);
    const firstQ = session.questions[0];
    const firstOpt = firstQ.options[0];

    // Save answer
    const saveRes = await attemptService.saveAnswer(session.attemptId, firstQ.id, firstOpt.id, 2);
    assert.equal(saveRes.saved, true);

    // Retrieve attempt
    const refreshed = await attemptService.getAttempt(session.attemptId, 2);
    assert.equal(refreshed.answersMap[firstQ.id], firstOpt.id, 'Draft answer must be persisted in database');
  });

  await t.test('4. Reject invalid option not belonging to the question', async () => {
    const session = await attemptService.startAttempt(2, 1);
    const firstQ = session.questions[0];

    // Try to submit an invalid option ID (e.g. 99999)
    await assert.rejects(
      async () => {
        await attemptService.saveAnswer(session.attemptId, firstQ.id, 99999, 2);
      },
      (err: any) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /Selected option does not belong to this question/i);
        return true;
      }
    );
  });

  await t.test('5. Reject cross-user attempt access (IDOR Protection)', async () => {
    const session = await attemptService.startAttempt(2, 1);

    // Student 2 (id: 3) attempts to access student 1's attempt (id: session.attemptId)
    await assert.rejects(
      async () => {
        await attemptService.getAttempt(session.attemptId, 3);
      },
      (err: any) => {
        assert.equal(err.statusCode, 403);
        assert.match(err.message, /Forbidden: You cannot access another student/i);
        return true;
      }
    );
  });
});
