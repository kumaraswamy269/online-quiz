import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError.ts';

export const authorize = (...roles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('You are not authenticated.', 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('Forbidden: You do not have permission to perform this administrative action.', 403)
      );
    }

    next();
  };
};
