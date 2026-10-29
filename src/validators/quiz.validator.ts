import { body, param } from 'express-validator';

export const createQuizValidator = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Quiz title is required.')
    .isLength({ max: 255 })
    .withMessage('Title cannot exceed 255 characters.'),
  body('description')
    .optional()
    .trim(),
  body('duration_minutes')
    .notEmpty()
    .withMessage('Duration in minutes is required.')
    .isInt({ min: 1, max: 360 })
    .withMessage('Duration must be between 1 and 360 minutes.'),
  body('passing_percentage')
    .notEmpty()
    .withMessage('Passing percentage is required.')
    .isFloat({ min: 0, max: 100 })
    .withMessage('Passing percentage must be between 0.00 and 100.00%.'),
  body('is_published')
    .optional()
    .isIn([0, 1, true, false])
    .withMessage('is_published must be a boolean or 0/1.'),
];

export const questionValidator = [
  body('question_text')
    .trim()
    .notEmpty()
    .withMessage('Question text is required.'),
  body('marks')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Marks must be a positive integer.'),
  body('explanation')
    .optional()
    .trim(),
  body('options')
    .isArray({ min: 2 })
    .withMessage('At least 2 multiple choice options are required.'),
  body('options.*.option_text')
    .trim()
    .notEmpty()
    .withMessage('Option text cannot be empty.'),
  body('options.*.is_correct')
    .optional()
    .isIn([0, 1, true, false])
    .withMessage('is_correct must be 0 or 1.'),
];
