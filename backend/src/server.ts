import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import 'express-async-errors';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';

import { config } from '@/config';
import { logger } from '@/utils/logger';
import { errorHandler } from '@/middleware/errorHandler';
import { rateLimiter } from '@/middleware/rateLimit';
import { authMiddleware } from '@/middleware/auth';
import { validateRequest } from '@/middleware/validation';

// Route imports
import authRoutes from '@/routes/auth';
import notebookRoutes from '@/routes/notebooks';
import pageRoutes from '@/routes/pages';
import userRoutes from '@/routes/users';
import searchRoutes from '@/routes/search';
import graphRoutes from '@/routes/graph';
import canvasRoutes from '@/routes/canvas';
import voiceRoutes from '@/routes/voice';
import ingestRoutes from '@/routes/ingest';
import collaborationRoutes from '@/routes/collaboration';

// Service imports
import { DatabaseService } from '@/services/database';
import { RedisService } from '@/services/redis';
// import { CollaborationService } from '@/services/collaboration';

class Server {
  private app: express.Application;
  private httpServer: any;
  private io: SocketServer;
  private databaseService: DatabaseService;
  private redisService: RedisService;
  // private _collaborationService: CollaborationService;

  constructor() {
    this.app = express();
    this.httpServer = createServer(this.app);
    this.io = new SocketServer(this.httpServer, {
      cors: {
        origin: config.cors.origin,
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.databaseService = DatabaseService.getInstance();
    this.redisService = RedisService.getInstance();
    // this._collaborationService = new CollaborationService(this.io);

    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
    this.initializeWebSocket();
  }

  private initializeMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "ws:", "wss:"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"]
        }
      },
      crossOriginEmbedderPolicy: false
    }));

    // CORS configuration
    this.app.use(cors({
      origin: config.cors.origin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));

    // Compression and parsing middleware
    this.app.use(compression());
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    // Logging middleware
    this.app.use(morgan('combined', {
      stream: {
        write: (message: string) => logger.info(message.trim())
      }
    }));

    // Rate limiting
    this.app.use('/api', rateLimiter);

    // Request validation middleware
    this.app.use(validateRequest);
  }

  private initializeRoutes(): void {    // Health check
    this.app.get('/health', (_req, res) => {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env['npm_package_version'] || '1.0.0',
        uptime: process.uptime()
      });
    });

    // API routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/notebooks', authMiddleware, notebookRoutes);
    this.app.use('/api/pages', authMiddleware, pageRoutes);
    this.app.use('/api/users', authMiddleware, userRoutes);
    this.app.use('/api/search', authMiddleware, searchRoutes);
    this.app.use('/api/graph', authMiddleware, graphRoutes);
    this.app.use('/api/canvas', authMiddleware, canvasRoutes);
    this.app.use('/api/voice', authMiddleware, voiceRoutes);
    this.app.use('/api/ingest', authMiddleware, ingestRoutes);
    this.app.use('/api/collaboration', authMiddleware, collaborationRoutes);

    // API documentation
    if (config.env === 'development') {
      const swaggerUi = require('swagger-ui-express');
      const swaggerSpec = require('@/utils/swagger');
      this.app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
    }

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: 'Route not found',
        message: `Cannot ${req.method} ${req.originalUrl}`
      });
    });
  }

  private initializeErrorHandling(): void {
    this.app.use(errorHandler);
  }

  private initializeWebSocket(): void {
    // CollaborationService is already initialized in constructor
    logger.info('WebSocket server initialized');
  }

  public async start(): Promise<void> {
    try {
      // Initialize database connections
      await this.databaseService.connect();
      await this.redisService.connect();

      // Start HTTP server
      this.httpServer.listen(config.port, () => {
        logger.info(`Server running on port ${config.port}`);
        logger.info(`Environment: ${config.env}`);
        logger.info(`Database: ${config.database.url ? 'Connected' : 'Not configured'}`);
        logger.info(`Redis: ${config.redis.url ? 'Connected' : 'Not configured'}`);
        
        if (config.env === 'development') {
          logger.info(`API Documentation: http://localhost:${config.port}/api/docs`);
        }
      });

      // Graceful shutdown handling
      this.setupGracefulShutdown();

    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  private setupGracefulShutdown(): void {
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);

      try {
        // Close HTTP server
        await new Promise<void>((resolve, reject) => {
          this.httpServer.close((err: any) => {
            if (err) reject(err);
            else resolve();
          });
        });

        // Close WebSocket server
        this.io.close();

        // Close database connections
        await this.databaseService.disconnect();
        await this.redisService.disconnect();

        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      gracefulShutdown('UNHANDLED_REJECTION');
    });
  }

  public getApp(): express.Application {
    return this.app;
  }

  public getHttpServer(): any {
    return this.httpServer;
  }

  public getIO(): SocketServer {
    return this.io;
  }
}

// Start server if this file is run directly
if (require.main === module) {
  const server = new Server();
  server.start();
}

export { Server };
export default Server;
