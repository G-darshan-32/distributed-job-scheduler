import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { globalRateLimiter } from './middleware/rateLimiter.middleware';
import { errorHandler, notFound } from './middleware/error.middleware';
import { logger } from './lib/logger';
import routes from './routes';
import { swaggerSpec } from './swagger';

export function createApp() {
  const app = express();

  // Security
  app.use(helmet());
  app.use(cors({ origin: process.env.CORS_ORIGIN ?? '*', credentials: true }));

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(compression());

  // Logging
  app.use(
    morgan('combined', {
      stream: { write: (msg) => logger.http(msg.trim()) },
      skip: (req) => req.path === '/api/v1/health',
    })
  );

  // Rate limiting
  app.use('/api', globalRateLimiter);

  // API Docs
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // API Routes
  app.use('/api/v1', routes);

  // Error handling
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
