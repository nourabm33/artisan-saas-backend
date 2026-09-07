import { NextFunction, Request, Response } from 'express';
import { ObjectSchema, Schema } from 'joi';
import { ValidationError, ValidationErrors } from '../../../domain/errors/ValidationError';

const toErrors = (details: { path: (string | number)[]; message: string }[]): ValidationErrors => {
  const errors: ValidationErrors = {};
  for (const detail of details) {
    const key = detail.path.join('.') || 'general';
    (errors[key] ??= []).push(detail.message.replace(/"/g, ''));
  }
  return errors;
};

export const validateUuidParam =
  (name: string, schema: Schema) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const { error } = schema.label(name).validate(req.params[name]);
    if (error) {
      next(new ValidationError(toErrors(error.details)));
      return;
    }
    next();
  };

export const validateQuery =
  <T>(schema: ObjectSchema<T>) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const { value, error } = schema.validate(req.query ?? {}, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      next(new ValidationError(toErrors(error.details)));
      return;
    }
    Object.defineProperty(req, 'query', { value, writable: true, configurable: true });
    next();
  };
