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
import { IAppointmentRepository } from '../../domain/repositories/IAppointmentRepository';
import { IMediaRepository } from '../../domain/repositories/IMediaRepository';
import { IWhatsAppMessageRepository } from '../../domain/repositories/IWhatsAppMessageRepository';
import { IWhatsAppGateway } from '../../application/ports/IWhatsAppGateway';
import { IMediaStorage } from '../../application/ports/IMediaStorage';
import { AppointmentSchedulingService } from '../../application/services/AppointmentSchedulingService';
import { QuoteAcceptanceService } from '../../application/services/QuoteAcceptanceService';
import { WhatsAppMessageComposer } from '../../application/services/WhatsAppMessageComposer';
import { GetQuoteUseCase } from '../../application/use-cases/quotes/GetQuoteUseCase';
import { UpdateQuoteUseCase } from '../../application/use-cases/quotes/UpdateQuoteUseCase';
import { SendQuoteUseCase } from '../../application/use-cases/quotes/SendQuoteUseCase';
import { HandleInboundWhatsAppUseCase } from '../../application/use-cases/whatsapp/HandleInboundWhatsAppUseCase';
import {
  GetAppointmentUseCase,
  ListAppointmentsUseCase,
  RescheduleAppointmentUseCase,
  UpdateAppointmentStatusUseCase,
} from '../../application/use-cases/appointments/AppointmentUseCases';
import {
  DeleteRequestMediaUseCase,
  UploadRequestMediaUseCase,
} from '../../application/use-cases/media/MediaUseCases';
import { QuoteController } from './controllers/QuoteController';
import { AppointmentController } from './controllers/AppointmentController';
import { MediaController } from './controllers/MediaController';
import { WhatsAppWebhookController } from './controllers/WhatsAppWebhookController';
import { createQuotesRouter } from './routes/quotes';
import { createAppointmentsRouter } from './routes/appointments';
import { createWhatsAppRouter } from './routes/whatsapp';
import { ListServiceTemplatesUseCase } from '../../application/use-cases/service-templates/ListServiceTemplatesUseCase';
import { CreateServiceTemplateUseCase } from '../../application/use-cases/service-templates/CreateServiceTemplateUseCase';
import { AuthController } from './controllers/AuthController';
import { RequestController } from './controllers/RequestController';
import { ServiceTemplateController } from './controllers/ServiceTemplateController';
import { createAuthRouter } from './routes/auth';
import { createRequestsRouter } from './routes/requests';
import { createServiceTemplatesRouter } from './routes/serviceTemplates';
import { createHealthRouter, HealthDependencies } from './routes/health';
import { requestLogger } from './middleware/requestLogger';
import { createErrorHandler, notFoundHandler } from './middleware/errorHandler';

export interface AppDependencies {
  config: Pick<
    AppConfig,
    'corsOrigin' | 'jwtSecret' | 'jwtAccessExpiry' | 'jwtRefreshExpiry' | 'appUrl'
  >;
  logger: Logger;
  userRepository: IUserRepository;
  organizationRepository: IOrganizationRepository;
  clientRepository: IClientRepository;
  serviceTemplateRepository: IServiceTemplateRepository;
  requestRepository: IRequestRepository;
  quoteRepository: IQuoteRepository;
  appointmentRepository: IAppointmentRepository;
  mediaRepository: IMediaRepository;
  whatsAppMessageRepository: IWhatsAppMessageRepository;
  whatsAppGateway: IWhatsAppGateway;
  mediaStorage: IMediaStorage;
  /** Directory served at /uploads (LocalDiskMediaStorage). Omit when using Cloudinary. */
  uploadsDir?: string;
  health: HealthDependencies;
  quoteCalculation?: QuoteCalculationService;
  scheduling?: AppointmentSchedulingService;
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
    appointmentRepository,
    mediaRepository,
    whatsAppMessageRepository,
    whatsAppGateway,
    mediaStorage,
    health,
  } = deps;
  const quoteCalculation = deps.quoteCalculation ?? new QuoteCalculationService();
  const scheduling = deps.scheduling ?? new AppointmentSchedulingService();
  const acceptance = new QuoteAcceptanceService(
    { quoteRepository, requestRepository, appointmentRepository, userRepository },
    scheduling
  );
  const composer = new WhatsAppMessageComposer(quoteCalculation);

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
    new GetRequestUseCase({
      requestRepository,
      clientRepository,
      quoteRepository,
      appointmentRepository,
      mediaRepository,
      whatsAppMessageRepository,
    })
  );

  const quoteController = new QuoteController(
    new GetQuoteUseCase(acceptance),
    new UpdateQuoteUseCase(quoteRepository, acceptance, quoteCalculation),
    new UpdateQuoteStatusUseCase(quoteRepository, acceptance),
    new SendQuoteUseCase(
      {
        organizationRepository,
        clientRepository,
        quoteRepository,
        serviceTemplateRepository,
        whatsAppMessageRepository,
      },
      acceptance,
      composer,
      whatsAppGateway
    )
  );

  const appointmentRepos = { appointmentRepository, requestRepository, userRepository };
  const appointmentController = new AppointmentController(
    new ListAppointmentsUseCase(appointmentRepos),
    new GetAppointmentUseCase(appointmentRepos),
    new UpdateAppointmentStatusUseCase(appointmentRepos),
    new RescheduleAppointmentUseCase(appointmentRepos)
  );

  const mediaRepos = { mediaRepository, requestRepository };
  const mediaController = new MediaController(
    new UploadRequestMediaUseCase(mediaRepos, mediaStorage),
    new DeleteRequestMediaUseCase(mediaRepos, mediaStorage)
  );

  const whatsAppWebhookController = new WhatsAppWebhookController(
    new HandleInboundWhatsAppUseCase(
      {
        clientRepository,
        organizationRepository,
        requestRepository,
        quoteRepository,
        whatsAppMessageRepository,
      },
      acceptance,
      composer
    ),
    whatsAppGateway,
    config.appUrl,
    logger
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
  if (deps.uploadsDir) {
    app.use('/uploads', express.static(deps.uploadsDir, { fallthrough: false, index: false }));
  }

  app.use('/api/v1/health', createHealthRouter(health));
  app.use('/api/v1/auth', createAuthRouter(authController, authService));
  app.use(
    '/api/v1/requests',
    createRequestsRouter(requestController, mediaController, authService)
  );
  app.use('/api/v1/quotes', createQuotesRouter(quoteController, authService));
  app.use('/api/v1/appointments', createAppointmentsRouter(appointmentController, authService));
  app.use('/api/v1/whatsapp', createWhatsAppRouter(whatsAppWebhookController));
  app.use(
    '/api/v1/service-templates',
    createServiceTemplatesRouter(serviceTemplateController, authService)
  );

  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));

  return app;
};
