import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

// Singleton pattern for Prisma client to avoid multiple instances
class DatabaseService {
  private static instance: DatabaseService;
  private prisma: PrismaClient;

  private constructor() {
    this.prisma = new PrismaClient({
      log: [
        {
          emit: 'event',
          level: 'query',
        },
        {
          emit: 'event',
          level: 'error',
        },
        {
          emit: 'event',
          level: 'warn',
        },
      ],
    });

    // Log queries in development
    if (process.env['NODE_ENV'] === 'development') {
      // Type assertion needed due to Prisma event types
      (this.prisma as any).$on('query', (e: any) => {
        logger.debug(`Query: ${e.query} - Params: ${e.params} - Duration: ${e.duration}ms`);
      });
    }

    (this.prisma as any).$on('error', (e: any) => {
      logger.error('Database error:', e);
    });

    (this.prisma as any).$on('warn', (e: any) => {
      logger.warn('Database warning:', e);
    });
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }
  public getClient(): PrismaClient {
    return this.prisma;
  }

  public get client(): PrismaClient {
    return this.prisma;
  }

  public async connect(): Promise<void> {
    try {
      await this.prisma.$connect();
      logger.info('Connected to database');
    } catch (error) {
      logger.error('Failed to connect to database:', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await this.prisma.$disconnect();
      logger.info('Disconnected from database');
    } catch (error) {
      logger.error('Failed to disconnect from database:', error);
      throw error;
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      logger.error('Database health check failed:', error);
      return false;
    }
  }
}

// Export the singleton instance and client for backward compatibility
export const databaseService = DatabaseService.getInstance();
export const db = databaseService.getClient();
export { DatabaseService };
export default db;
