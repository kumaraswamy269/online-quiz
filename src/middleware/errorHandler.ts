import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError.ts';

export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Handle specific MySQL errors
  if (err.code === 'ER_DUP_ENTRY' || err.message?.includes('UNIQUE constraint failed')) {
    statusCode = 409;
    message = 'A record with this unique value already exists.';
  }

  if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.message?.includes('FOREIGN KEY constraint failed')) {
    statusCode = 400;
    message = 'Referenced relational record does not exist or violates foreign key integrity.';
  }

  if (err.name === 'ValidationError') {
    statusCode = 422;
  }

  // Log error on server without leaking secrets to users
  if (statusCode >= 500) {
    console.error('Server Uncaught Exception:', err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    details: err.details || undefined,
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
};
