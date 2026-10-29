import { Request, Response } from 'express';
import { attemptService } from '../services/attempt.service.ts';
import { scoringService } from '../services/scoring.service.ts';
import { asyncHandler } from '../utils/asyncHandler.ts';

export const startQuizAttempt = asyncHandler(async (req: Request, res: Response) => {
  const quizId = Number(req.params.id);
  const userId = req.user!.id;
  const attempt = await attemptService.startAttempt(userId, quizId);
  res.status(201).json({
    success: true,
    message: 'Quiz examination session initialized.',
    data: attempt,
  });
});

export const getAttempt = asyncHandler(async (req: Request, res: Response) => {
  const attemptId = Number(req.params.id);
  const userId = req.user!.id;
  const attempt = await attemptService.getAttempt(attemptId, userId);
  res.status(200).json({
    success: true,
    data: attempt,
  });
});

export const saveAnswer = asyncHandler(async (req: Request, res: Response) => {
  const attemptId = Number(req.params.id);
  const userId = req.user!.id;
  const { questionId, selectedOptionId } = req.body;
  const result = await attemptService.saveAnswer(attemptId, questionId, selectedOptionId, userId);
  res.status(200).json({
    success: true,
    data: result,
  });
});

export const submitAttempt = asyncHandler(async (req: Request, res: Response) => {
  const attemptId = Number(req.params.id);
  const userId = req.user!.id;
  const { answers } = req.body;
  const result = await scoringService.submitAttempt(attemptId, userId, answers);
  res.status(200).json({
    success: true,
    message: 'Quiz submitted and graded successfully.',
    data: result,
  });
});

export const getAttemptResult = asyncHandler(async (req: Request, res: Response) => {
  const attemptId = Number(req.params.id);
  const userId = req.user!.id;
  const isAdmin = req.user!.role === 'admin';
  const result = await scoringService.getResult(attemptId, userId, isAdmin);
  res.status(200).json({
    success: true,
    data: result,
  });
});

export const getMyResults = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const results = await scoringService.getStudentHistory(userId);
  res.status(200).json({
    success: true,
    data: results,
  });
});

export const recordProctorEvent = asyncHandler(async (req: Request, res: Response) => {
  const attemptId = Number(req.params.id);
  const userId = req.user!.id;
  const result = await scoringService.recordTabSwitch(attemptId, userId);
  res.status(200).json({
    success: true,
    message: 'Proctoring security event recorded.',
    data: result,
  });
});

export const verifyCertificate = asyncHandler(async (req: Request, res: Response) => {
  const code = String(req.params.code);
  const cert = await scoringService.verifyCertificate(code);
  res.status(200).json({
    success: true,
    message: 'Certificate successfully verified against institutional registry.',
    data: cert,
  });
});

