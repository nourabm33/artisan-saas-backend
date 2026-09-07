import winston from 'winston';

export type Logger = winston.Logger;

export const createLogger = (level: string, nodeEnv: string): Logger => {
  const transports: winston.transport[] = [new winston.transports.Console()];

  if (nodeEnv !== 'test') {
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
