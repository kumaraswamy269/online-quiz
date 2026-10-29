/**
 * Authentication and Security Test Suite
 * Tests registration, bcrypt password hashing, login, and JWT verification
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { authService } from '../src/services/auth.service.ts';
import { initializeDatabase, get } from '../src/config/db.ts';

test('Authentication Test Suite', async (t) => {
  await initializeDatabase();

  await t.test('1. Successful user registration and bcrypt password hashing', async () => {
    const testEmail = `test_student_${Date.now()}@quizpulse.edu`;
    const password = 'TestSecurePassword123!';

    const res = await authService.register('Test Student', testEmail, password, 'student');

    assert.ok(res.user.id, 'User ID should be assigned');
    assert.equal(res.user.email, testEmail);
    assert.equal(res.user.role, 'student');
    assert.ok(res.token, 'JWT token must be returned');

    // Verify password is NOT stored in plain text and uses bcrypt
    const dbRecord = await get<any>('SELECT password_hash FROM users WHERE id = ?;', [res.user.id]);
    assert.notEqual(dbRecord.password_hash, password, 'Password must never be stored in plaintext');
    assert.ok(dbRecord.password_hash.startsWith('$2a$') || dbRecord.password_hash.startsWith('$2b$'), 'Must be a valid bcrypt hash');

    const isMatch = await bcrypt.compare(password, dbRecord.password_hash);
    assert.equal(isMatch, true, 'bcrypt.compare must validate the plaintext password against stored hash');
  });

  await t.test('2. Prevent duplicate email registration', async () => {
    const email = 'admin@quizpulse.edu';
    await assert.rejects(
      async () => {
        await authService.register('Duplicate Admin', email, 'SomePassword123!');
      },
      (err: any) => {
        assert.equal(err.statusCode, 409);
        assert.match(err.message, /already exists/i);
        return true;
      }
    );
  });

  await t.test('3. Successful login with correct credentials', async () => {
    const res = await authService.login('admin@quizpulse.edu', 'AdminPassword123!');
    assert.ok(res.token, 'Token returned on valid login');
    assert.equal(res.user.email, 'admin@quizpulse.edu');
    assert.equal(res.user.role, 'admin');
  });

  await t.test('4. Reject login with invalid password', async () => {
    await assert.rejects(
      async () => {
        await authService.login('admin@quizpulse.edu', 'WrongPassword!');
      },
      (err: any) => {
        assert.equal(err.statusCode, 401);
        assert.match(err.message, /Invalid email or password/i);
        return true;
      }
    );
  });
});
