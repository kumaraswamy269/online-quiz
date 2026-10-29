import { Request, Response } from 'express';
import { authService } from '../services/auth.service.ts';
import { asyncHandler } from '../utils/asyncHandler.ts';

const setTokenCookie = (res: Response, token: string) => {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  });
};

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password, role } = req.body;
  const result = await authService.register(name, email, password, role || 'student');

  setTokenCookie(res, result.token);

  res.status(201).json({
    success: true,
    message: 'Registration successful.',
    data: result,
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password);

  setTokenCookie(res, result.token);

  res.status(200).json({
    success: true,
    message: 'Login successful.',
    data: result,
  });
});

export const logout = asyncHandler(async (_req: Request, res: Response) => {
  res.clearCookie('token');
  res.status(200).json({
    success: true,
    message: 'Logged out successfully.',
  });
});

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.getMe(req.user!.id);
  res.status(200).json({
    success: true,
    data: user,
  });
});
