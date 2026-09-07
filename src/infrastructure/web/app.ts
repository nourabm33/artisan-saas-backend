import 'express-async-errors';
import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { AppConfig } from '../../config';
import { Logger } from '../logger';
import { AuthService } from '../../application/services/AuthService';
import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { IOrganizationRepository } from '../../domain/repositories/IOrganizationRepository';
import { RegisterUseCase } from '../../application/use-cases/auth/RegisterUseCase';
import { LoginUseCase } from '../../application/use-cases/auth/LoginUseCase';
import { RefreshTokenUseCase } from '../../application/use-cases/auth/RefreshTokenUseCase';
import { GetCurrentUserUseCase } from '../../application/use-cases/auth/GetCurrentUserUseCase';
import { AuthController } from './controllers/AuthController';
import { createAuthRouter } from './routes/auth';
import { createHealthRouter, HealthDependencies } from './routes/health';
import { requestLogger } from './middleware/requestLogger';
import { createErrorHandler, notFoundHandler } from './middleware/errorHandler';

export interface AppDependencies {
  config: Pick<AppConfig, 'corsOrigin' | 'jwtSecret' | 'jwtAccessExpiry' | 'jwtRefreshExpiry'>;
  logger: Logger;
  userRepository: IUserRepository;
  organizationRepository: IOrganizationRepository;
  health: HealthDependencies;
}

export const createApp = (deps: AppDependencies): Express => {
  const { config, logger, userRepository, organizationRepository, health } = deps;

  const authService = new AuthService(
    config.jwtSecret,
    config.jwtAccessExpiry,
    config.jwtRefreshExpiry
  );

  const authController = new AuthController(
    new RegisterUseCase(authService, userRepository, organizationRepository),
    new LoginUseCase(authService, userRepository),
    new RefreshTokenUseCase(authService, userRepository),
    new GetCurrentUserUseCase(userRepository)
  );

  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin === '*' ? true : config.corsOrigin }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(requestLogger(logger));

  app.use('/api/v1/health', createHealthRouter(health));
  app.use('/api/v1/auth', createAuthRouter(authController, authService));

  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));

  return app;
};
