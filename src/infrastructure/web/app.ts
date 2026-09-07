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
import { IClientRepository } from '../../domain/repositories/IClientRepository';
import { IServiceTemplateRepository } from '../../domain/repositories/IServiceTemplateRepository';
import { IRequestRepository } from '../../domain/repositories/IRequestRepository';
import { IQuoteRepository } from '../../domain/repositories/IQuoteRepository';
import { QuoteCalculationService } from '../../application/services/QuoteCalculationService';
import { SubmitRequestUseCase } from '../../application/use-cases/requests/SubmitRequestUseCase';
import { ListRequestsUseCase } from '../../application/use-cases/requests/ListRequestsUseCase';
import { GetRequestUseCase } from '../../application/use-cases/requests/GetRequestUseCase';
import { UpdateQuoteStatusUseCase } from '../../application/use-cases/requests/UpdateQuoteStatusUseCase';
import { ListServiceTemplatesUseCase } from '../../application/use-cases/service-templates/ListServiceTemplatesUseCase';
import { CreateServiceTemplateUseCase } from '../../application/use-cases/service-templates/CreateServiceTemplateUseCase';
import { AuthController } from './controllers/AuthController';
import { RequestController } from './controllers/RequestController';
import { ServiceTemplateController } from './controllers/ServiceTemplateController';
import { createAuthRouter } from './routes/auth';
import { createQuotesRouter, createRequestsRouter } from './routes/requests';
import { createServiceTemplatesRouter } from './routes/serviceTemplates';
import { createHealthRouter, HealthDependencies } from './routes/health';
import { requestLogger } from './middleware/requestLogger';
import { createErrorHandler, notFoundHandler } from './middleware/errorHandler';

export interface AppDependencies {
  config: Pick<AppConfig, 'corsOrigin' | 'jwtSecret' | 'jwtAccessExpiry' | 'jwtRefreshExpiry'>;
  logger: Logger;
  userRepository: IUserRepository;
  organizationRepository: IOrganizationRepository;
  clientRepository: IClientRepository;
  serviceTemplateRepository: IServiceTemplateRepository;
  requestRepository: IRequestRepository;
  quoteRepository: IQuoteRepository;
  health: HealthDependencies;
  quoteCalculation?: QuoteCalculationService;
}

export const createApp = (deps: AppDependencies): Express => {
  const {
    config,
    logger,
    userRepository,
    organizationRepository,
    clientRepository,
    serviceTemplateRepository,
    requestRepository,
    quoteRepository,
    health,
  } = deps;
  const quoteCalculation = deps.quoteCalculation ?? new QuoteCalculationService();

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

  const requestController = new RequestController(
    new SubmitRequestUseCase(
      {
        organizationRepository,
        userRepository,
        serviceTemplateRepository,
        clientRepository,
        requestRepository,
        quoteRepository,
      },
      quoteCalculation
    ),
    new ListRequestsUseCase(requestRepository),
    new GetRequestUseCase(requestRepository, clientRepository, quoteRepository),
    new UpdateQuoteStatusUseCase(quoteRepository, requestRepository)
  );

  const serviceTemplateController = new ServiceTemplateController(
    new ListServiceTemplatesUseCase(serviceTemplateRepository, organizationRepository),
    new CreateServiceTemplateUseCase(serviceTemplateRepository, organizationRepository)
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
  app.use('/api/v1/requests', createRequestsRouter(requestController, authService));
  app.use('/api/v1/quotes', createQuotesRouter(requestController, authService));
  app.use(
    '/api/v1/service-templates',
    createServiceTemplatesRouter(serviceTemplateController, authService)
  );

  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));

  return app;
};
