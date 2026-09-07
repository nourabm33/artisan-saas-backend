import Joi from 'joi';

export interface RegisterCommand {
  organizationName: string;
  tradeType: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  passwordConfirm: string;
}

export interface LoginCommand {
  email: string;
  password: string;
}

export interface RefreshTokenCommand {
  refreshToken: string;
}

export interface UserDto {
  id: string;
  orgId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

export interface AuthResult {
  user: UserDto;
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

export const TRADE_TYPES = ['gommista', 'idraulico', 'elettricista', 'meccanico', 'altro'] as const;

export const registerSchema = Joi.object<RegisterCommand>({
  organizationName: Joi.string().trim().min(2).max(255).required(),
  tradeType: Joi.string()
    .trim()
    .lowercase()
    .valid(...TRADE_TYPES)
    .required(),
  firstName: Joi.string().trim().min(1).max(100).required(),
  lastName: Joi.string().trim().min(1).max(100).required(),
  email: Joi.string().trim().email().required(),
  phone: Joi.string().trim().min(9).max(20).required(),
  password: Joi.string().min(8).max(128).required(),
  passwordConfirm: Joi.string()
    .valid(Joi.ref('password'))
    .required()
    .messages({ 'any.only': 'Passwords do not match' }),
});

export const loginSchema = Joi.object<LoginCommand>({
  email: Joi.string().trim().email().required(),
  password: Joi.string().required(),
});

export const refreshTokenSchema = Joi.object<RefreshTokenCommand>({
  refreshToken: Joi.string().required(),
});
