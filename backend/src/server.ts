import 'dotenv/config';
import http from 'http';
import { createApp } from './app';
import { config } from './config';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { connectRedis } from './lib/redis';
import { initWebSocket } from './lib/websocket';
import { SchedulerService } from './services/scheduler.service';

async function bootstrap() {
  // Validate DB and Redis connections
  await prisma.$connect();
  logger.info('Database connected');

  try {
    await connectRedis();
  } catch (err) {
    logger.warn('Redis unavailable — continuing without cache/rate-limit', { error: (err as Error).message });
  }

  const app = createApp();
  const server = http.createServer(app);

  // WebSocket
  initWebSocket(server);

  // Background scheduler
  SchedulerService.start();

  // Listen on 0.0.0.0 required for Railway/Docker environments
  server.listen(config.PORT, '0.0.0.0', () => {
    logger.info(`Server running on port ${config.PORT}`, { env: config.NODE_ENV });
    logger.info(`API Docs: http://localhost:${config.PORT}/api-docs`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully`);
    SchedulerService.stop();
    server.close(async () => {
      await prisma.$disconnect();
      logger.info('Server shut down complete');
      process.exit(0);
    });
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
