import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../utils/AppError.ts';
import { get } from '../config/db.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'quizpulse-super-secure-jwt-secret-key-btech-cse-2026';

export interface AuthenticatedUser {
  id: number;
  name: string;
  email: string;
  role: 'student' | 'admin';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export const authenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    let token: string | undefined;

    // 1. Check Authorization Bearer header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      // 2. Check HttpOnly cookie
      token = req.cookies.token;
    }

    if (!token) {
      return next(new AppError('Authentication required. Please log in.', 401));
    }

    // 3. Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number; role: string };

    // 4. Validate user exists in MySQL database
    const user = await get<AuthenticatedUser>(
      'SELECT id, name, email, role FROM users WHERE id = ?;',
      [decoded.id]
    );

    if (!user) {
      return next(new AppError('The user belonging to this session no longer exists.', 401));
    }

    req.user = user;
    next();
  } catch (err: any) {
    if (err.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid authentication token.', 401));
    }
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Your session has expired. Please log in again.', 401));
    }
    next(err);
  }
};
