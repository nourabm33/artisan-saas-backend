import winston from 'winston';

export type Logger = winston.Logger;

export const createLogger = (level: string, nodeEnv: string): Logger => {
  const transports: winston.transport[] = [new winston.transports.Console()];

  // Containers ship stdout to the log collector; local files only help in development.
  if (nodeEnv === 'development') {
    transports.push(
      new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
      new winston.transports.File({ filename: 'logs/combined.log' })
    );
  }

  return winston.createLogger({
    level,
    silent: nodeEnv === 'test',
    format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
    transports,
  });
};
