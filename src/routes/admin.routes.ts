import { Router } from 'express';
import * as adminController from '../controllers/admin.controller.ts';
import { authenticate } from '../middleware/auth.ts';
import { authorize } from '../middleware/authorize.ts';
import { createQuizValidator, questionValidator } from '../validators/quiz.validator.ts';
import { validate } from '../middleware/validate.ts';

const router = Router();

// Strict RBAC: All admin routes mandate role === 'admin'
router.use(authenticate, authorize('admin'));

router.get('/dashboard', adminController.getDashboardStats);
router.get('/quizzes', adminController.getAllQuizzes);
router.get('/quizzes/:id', adminController.getQuizDetail);
router.post('/quizzes', createQuizValidator, validate, adminController.createQuiz);
router.put('/quizzes/:id', createQuizValidator, validate, adminController.updateQuiz);
router.delete('/quizzes/:id', adminController.deleteQuiz);
router.patch('/quizzes/:id/publish', adminController.togglePublish);

router.post('/quizzes/:id/questions', questionValidator, validate, adminController.addQuestion);
router.delete('/questions/:id', adminController.deleteQuestion);
router.get('/quizzes/:id/export', adminController.exportQuizQuestions);
router.post('/quizzes/:id/import', adminController.importQuizQuestions);

router.get('/results', adminController.getAllResults);
router.get('/students', adminController.getAllStudents);

export default router;
