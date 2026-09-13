import Joi from 'joi';

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  appUrl: string;
  databaseUrl: string;
  databasePoolSize: number;
  redisUrl: string;
  jwtSecret: string;
  jwtAccessExpiry: string;
  jwtRefreshExpiry: string;
  logLevel: string;
  corsOrigin: string[] | '*';
  twilio?: TwilioConfig;
  cloudinary?: CloudinaryConfig;
  uploadsDir: string;
  rateLimit: RateLimitConfig;
  metrics: MetricsConfig;
  sentryDsn?: string;
  release?: string;
}

export interface RateLimitConfig {
  /** Sliding window length in ms. */
  windowMs: number;
  /** Max requests per IP per window on the general API. */
  max: number;
  /** Stricter cap for credential endpoints (login/register/refresh). */
  authMax: number;
  /** Cap for unauthenticated public endpoints (request submission, webhooks). */
  publicMax: number;
}

export interface MetricsConfig {
  enabled: boolean;
  /** When set, GET /metrics requires `Authorization: Bearer <token>`. */
  token?: string;
}

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  whatsappFrom: string;
}

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

const schema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().integer().min(1).max(65535).default(3000),
  APP_URL: Joi.string().uri().default('http://localhost:3000'),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgres', 'postgresql'] })
    .required(),
  DATABASE_POOL_SIZE: Joi.number().integer().min(1).default(10),
  REDIS_URL: Joi.string()
    .uri({ scheme: ['redis', 'rediss'] })
    .default('redis://localhost:6379'),
  JWT_SECRET: Joi.string()
    .min(16)
    .required()
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.string().min(32).invalid('your_super_secret_jwt_key_change_in_production'),
    }),
  JWT_ACCESS_TOKEN_EXPIRY: Joi.string().default('15m'),
  JWT_REFRESH_TOKEN_EXPIRY: Joi.string().default('7d'),
  LOG_LEVEL: Joi.string().default('info'),
  CORS_ORIGIN: Joi.string()
    .default('*')
    .when('NODE_ENV', { is: 'production', then: Joi.string().invalid('*') }),
  TWILIO_ACCOUNT_SID: Joi.string().allow(''),
  TWILIO_AUTH_TOKEN: Joi.string().allow(''),
  TWILIO_WHATSAPP_FROM: Joi.string()
    .pattern(/^whatsapp:\+\d{6,15}$/)
    .allow(''),
  CLOUDINARY_CLOUD_NAME: Joi.string().allow(''),
  CLOUDINARY_API_KEY: Joi.string().allow(''),
  CLOUDINARY_API_SECRET: Joi.string().allow(''),
  UPLOADS_DIR: Joi.string().default('uploads'),
  RATE_LIMIT_WINDOW_MS: Joi.number().integer().min(1000).default(60_000),
  RATE_LIMIT_MAX: Joi.number().integer().min(1).default(300),
  RATE_LIMIT_AUTH_MAX: Joi.number().integer().min(1).default(20),
  RATE_LIMIT_PUBLIC_MAX: Joi.number().integer().min(1).default(30),
  METRICS_ENABLED: Joi.boolean().default(true),
  METRICS_TOKEN: Joi.string().allow(''),
  SENTRY_DSN: Joi.string().uri().allow(''),
  APP_RELEASE: Joi.string().allow(''),
})
  .unknown(true)
  .and('TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_WHATSAPP_FROM')
  .and('CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET');

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): AppConfig => {
  const { value, error } = schema.validate(env, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new Error(`Invalid environment configuration: ${error.message}`);
  }

  const corsOrigin: string[] | '*' =
    value.CORS_ORIGIN === '*'
      ? '*'
      : String(value.CORS_ORIGIN)
          .split(',')
          .map((o: string) => o.trim())
          .filter(Boolean);

  return {
    nodeEnv: value.NODE_ENV,
    port: value.PORT,
    appUrl: value.APP_URL,
    databaseUrl: value.DATABASE_URL,
    databasePoolSize: value.DATABASE_POOL_SIZE,
    redisUrl: value.REDIS_URL,
    jwtSecret: value.JWT_SECRET,
    jwtAccessExpiry: value.JWT_ACCESS_TOKEN_EXPIRY,
    jwtRefreshExpiry: value.JWT_REFRESH_TOKEN_EXPIRY,
    logLevel: value.LOG_LEVEL,
    corsOrigin,
    twilio: value.TWILIO_ACCOUNT_SID
      ? {
          accountSid: value.TWILIO_ACCOUNT_SID,
          authToken: value.TWILIO_AUTH_TOKEN,
          whatsappFrom: value.TWILIO_WHATSAPP_FROM,
        }
      : undefined,
    cloudinary: value.CLOUDINARY_CLOUD_NAME
      ? {
          cloudName: value.CLOUDINARY_CLOUD_NAME,
          apiKey: value.CLOUDINARY_API_KEY,
          apiSecret: value.CLOUDINARY_API_SECRET,
        }
      : undefined,
    uploadsDir: value.UPLOADS_DIR,
    rateLimit: {
      windowMs: value.RATE_LIMIT_WINDOW_MS,
      max: value.RATE_LIMIT_MAX,
      authMax: value.RATE_LIMIT_AUTH_MAX,
      publicMax: value.RATE_LIMIT_PUBLIC_MAX,
    },
    metrics: {
      enabled: value.METRICS_ENABLED,
      token: value.METRICS_TOKEN || undefined,
    },
    sentryDsn: value.SENTRY_DSN || undefined,
    release: value.APP_RELEASE || undefined,
  };
};
