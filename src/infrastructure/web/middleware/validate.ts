import { NextFunction, Request, Response } from 'express';
import { ObjectSchema } from 'joi';
import { ValidationError, ValidationErrors } from '../../../domain/errors/ValidationError';

export const validateBody =
  <T>(schema: ObjectSchema<T>) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const { value, error } = schema.validate(req.body ?? {}, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors: ValidationErrors = {};
      for (const detail of error.details) {
        const key = detail.path.join('.') || 'general';
        (errors[key] ??= []).push(detail.message.replace(/"/g, ''));
      }
      next(new ValidationError(errors));
      return;
    }

    req.body = value;
    next();
  };
