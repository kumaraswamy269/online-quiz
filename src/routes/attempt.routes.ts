import { Router } from 'express';
import * as attemptController from '../controllers/attempt.controller.ts';
import { authenticate } from '../middleware/auth.ts';

const router = Router();

// Public certificate verification route
router.get('/certificates/verify/:code', attemptController.verifyCertificate);

// Protected student attempt routes
router.post('/quizzes/:id/start', authenticate, attemptController.startQuizAttempt);
router.get('/attempts/:id', authenticate, attemptController.getAttempt);
router.put('/attempts/:id/answers', authenticate, attemptController.saveAnswer);
router.post('/attempts/:id/submit', authenticate, attemptController.submitAttempt);
router.get('/attempts/:id/result', authenticate, attemptController.getAttemptResult);
router.get('/my-results', authenticate, attemptController.getMyResults);
router.post('/attempts/:id/proctor-event', authenticate, attemptController.recordProctorEvent);

export default router;

