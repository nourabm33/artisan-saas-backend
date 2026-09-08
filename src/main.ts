import dotenv from 'dotenv';
import path from 'path';
import { Pool } from 'pg';
import { createClient } from 'redis';
import { loadConfig } from './config';
import { createLogger } from './infrastructure/logger';
import { createApp } from './infrastructure/web/app';
import {
  AppointmentRepository,
  ClientRepository,
  MediaRepository,
  OrganizationRepository,
  QuoteRepository,
  RequestRepository,
  ServiceTemplateRepository,
  UserRepository,
  WhatsAppMessageRepository,
} from './infrastructure/persistence/repositories';
import { TwilioWhatsAppGateway } from './infrastructure/whatsapp/TwilioWhatsAppGateway';
import { LoggingWhatsAppGateway } from './infrastructure/whatsapp/LoggingWhatsAppGateway';
import { CloudinaryMediaStorage } from './infrastructure/storage/CloudinaryMediaStorage';
import { LocalDiskMediaStorage } from './infrastructure/storage/LocalDiskMediaStorage';

dotenv.config();

const start = async (): Promise<void> => {
  const config = loadConfig();
  const logger = createLogger(config.logLevel, config.nodeEnv);

  const pool = new Pool({ connectionString: config.databaseUrl, max: config.databasePoolSize });
  pool.on('error', (err) => logger.error('PostgreSQL pool error', { error: err.message }));

  const redis = createClient({ url: config.redisUrl });
  redis.on('error', (err: Error) => logger.error('Redis error', { error: err.message }));

  try {
    await pool.query('SELECT 1');
    logger.info('PostgreSQL connected');

    await redis.connect();
    logger.info('Redis connected');
  } catch (error) {
    logger.error('Failed to connect to infrastructure', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }

  const whatsAppGateway = config.twilio
    ? new TwilioWhatsAppGateway(config.twilio)
    : new LoggingWhatsAppGateway(logger);
  logger.info(`WhatsApp gateway: ${config.twilio ? 'twilio' : 'logging (dev)'}`);

  const uploadsDir = path.resolve(config.uploadsDir);
  const mediaStorage = config.cloudinary
    ? new CloudinaryMediaStorage(config.cloudinary)
    : new LocalDiskMediaStorage(uploadsDir, `${config.appUrl}/uploads`);
  logger.info(`Media storage: ${config.cloudinary ? 'cloudinary' : `local disk (${uploadsDir})`}`);

  const app = createApp({
    config,
    logger,
    userRepository: new UserRepository(pool),
    organizationRepository: new OrganizationRepository(pool),
    clientRepository: new ClientRepository(pool),
    serviceTemplateRepository: new ServiceTemplateRepository(pool),
    requestRepository: new RequestRepository(pool),
    quoteRepository: new QuoteRepository(pool),
    appointmentRepository: new AppointmentRepository(pool),
    mediaRepository: new MediaRepository(pool),
    whatsAppMessageRepository: new WhatsAppMessageRepository(pool),
    whatsAppGateway,
    mediaStorage,
    uploadsDir: config.cloudinary ? undefined : uploadsDir,
    health: {
      database: async () => (await pool.query('SELECT 1')).rowCount === 1,
      redis: async () => (await redis.ping()) === 'PONG',
    },
  });

  const server = app.listen(config.port, () => {
    logger.info(`Server running on http://localhost:${config.port} (${config.nodeEnv})`);
  });

  const shutdown = (signal: string): void => {
    logger.info(`${signal} received, shutting down`);
    server.close(async () => {
      await Promise.allSettled([pool.end(), redis.quit()]);
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
};

start().catch((error) => {
  process.stderr.write(`Fatal: ${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
