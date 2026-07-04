import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { config } from '../config';

const { combine, timestamp, errors, json, colorize, simple } = winston.format;

const fileTransport = new DailyRotateFile({
  filename: 'logs/app-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
  format: combine(timestamp(), errors({ stack: true }), json()),
});

const errorFileTransport = new DailyRotateFile({
  filename: 'logs/error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d',
  level: 'error',
  format: combine(timestamp(), errors({ stack: true }), json()),
});

const consoleTransport = new winston.transports.Console({
  format:
    config.NODE_ENV === 'production'
      ? combine(timestamp(), errors({ stack: true }), json())
      : combine(colorize(), simple()),
});

export const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  defaultMeta: { service: 'djs-backend' },
  transports: [consoleTransport, fileTransport, errorFileTransport],
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' }),
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log' }),
  ],
});
