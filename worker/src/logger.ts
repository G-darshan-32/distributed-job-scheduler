import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { config } from './config';

export const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  defaultMeta: { service: 'djs-worker' },
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format:
        config.NODE_ENV === 'production'
          ? winston.format.json()
          : winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
    new DailyRotateFile({
      filename: 'logs/worker-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
    }),
  ],
});
