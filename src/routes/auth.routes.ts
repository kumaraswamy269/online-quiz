import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as authController from '../controllers/auth.controller.ts';
import { registerValidator, loginValidator } from '../validators/auth.validator.ts';
import { validate } from '../middleware/validate.ts';
import { authenticate } from '../middleware/auth.ts';

const router = Router();

// Login rate limiter: Max 10 attempts per 5 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Too many login attempts from this IP. Please try again after 5 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/register', registerValidator, validate, authController.register);
router.post('/login', loginLimiter, loginValidator, validate, authController.login);
router.post('/logout', authController.logout);
router.get('/me', authenticate, authController.getMe);

export default router;
