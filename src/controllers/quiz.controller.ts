import { Request, Response } from 'express';
import { quizService } from '../services/quiz.service.ts';
import { asyncHandler } from '../utils/asyncHandler.ts';

export const getQuizzes = asyncHandler(async (req: Request, res: Response) => {
  const { search } = req.query;
  const quizzes = await quizService.getPublishedQuizzes(search as string);
  res.status(200).json({
    success: true,
    data: quizzes,
  });
});

export const getQuizById = asyncHandler(async (req: Request, res: Response) => {
  const quizId = Number(req.params.id);
  const quiz = await quizService.getQuizById(quizId);
  res.status(200).json({
    success: true,
    data: quiz,
  });
});
