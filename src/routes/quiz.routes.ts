import { Router } from 'express';
import * as quizController from '../controllers/quiz.controller.ts';

const router = Router();

// Public routes for student quiz browsing
router.get('/', quizController.getQuizzes);
router.get('/:id', quizController.getQuizById);

export default router;
