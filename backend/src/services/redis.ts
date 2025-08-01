import Redis from 'ioredis';
import { logger } from '../utils/logger';

class RedisService {
  private static instance: RedisService;
  private client: Redis;
  private subscriber: Redis;
  private publisher: Redis;
  private constructor() {
    const redisUrl = process.env['REDIS_URL'] || 'redis://localhost:6379';
    
    // Main client for general operations
    this.client = new Redis(redisUrl, {
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
      lazyConnect: true
    });

    // Dedicated clients for pub/sub
    this.subscriber = new Redis(redisUrl, {
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
      lazyConnect: true
    });

    this.publisher = new Redis(redisUrl, {
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
      lazyConnect: true
    });

    this.setupEventHandlers();
  }

  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      logger.info('Redis client connected');
    });

    this.client.on('error', (error) => {
      logger.error('Redis client error:', error);
    });

    this.subscriber.on('connect', () => {
      logger.info('Redis subscriber connected');
    });

    this.publisher.on('connect', () => {
      logger.info('Redis publisher connected');
    });
  }

  public async connect(): Promise<void> {
    try {
      await Promise.all([
        this.client.connect(),
        this.subscriber.connect(),
        this.publisher.connect()
      ]);
      logger.info('All Redis connections established');
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await Promise.all([
        this.client.disconnect(),
        this.subscriber.disconnect(),
        this.publisher.disconnect()
      ]);
      logger.info('All Redis connections closed');
    } catch (error) {
      logger.error('Error disconnecting from Redis:', error);
      throw error;
    }
  }

  public getClient(): Redis {
    return this.client;
  }

  public getSubscriber(): Redis {
    return this.subscriber;
  }

  public getPublisher(): Redis {
    return this.publisher;
  }

  // Cache operations
  public async set(
    key: string,
    value: any,
    ttl?: number
  ): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttl) {
      await this.client.setex(key, ttl, serialized);
    } else {
      await this.client.set(key, serialized);
    }
  }

  public async get<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    if (!value) return null;
    
    try {
      return JSON.parse(value);
    } catch (error) {
      logger.error('Failed to parse Redis value:', error);
      return null;
    }
  }

  public async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  public async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  public async expire(key: string, seconds: number): Promise<void> {
    await this.client.expire(key, seconds);
  }

  // Hash operations
  public async hset(
    key: string,
    field: string,
    value: any
  ): Promise<void> {
    await this.client.hset(key, field, JSON.stringify(value));
  }

  public async hget<T>(key: string, field: string): Promise<T | null> {
    const value = await this.client.hget(key, field);
    if (!value) return null;
    
    try {
      return JSON.parse(value);
    } catch (error) {
      logger.error('Failed to parse Redis hash value:', error);
      return null;
    }
  }

  public async hgetall<T>(key: string): Promise<Record<string, T>> {
    const hash = await this.client.hgetall(key);
    const result: Record<string, T> = {};
    
    for (const [field, value] of Object.entries(hash)) {
      try {
        result[field] = JSON.parse(value);
      } catch (error) {
        logger.error('Failed to parse Redis hash value:', error);
      }
    }
    
    return result;
  }

  public async hdel(key: string, field: string): Promise<void> {
    await this.client.hdel(key, field);
  }

  // Set operations
  public async sadd(key: string, members: string[]): Promise<void> {
    if (members.length > 0) {
      await this.client.sadd(key, ...members);
    }
  }

  public async srem(key: string, members: string[]): Promise<void> {
    if (members.length > 0) {
      await this.client.srem(key, ...members);
    }
  }

  public async smembers(key: string): Promise<string[]> {
    return this.client.smembers(key);
  }

  public async sismember(key: string, member: string): Promise<boolean> {
    const result = await this.client.sismember(key, member);
    return result === 1;
  }

  // List operations
  public async lpush(key: string, values: string[]): Promise<void> {
    if (values.length > 0) {
      await this.client.lpush(key, ...values);
    }
  }

  public async rpush(key: string, values: string[]): Promise<void> {
    if (values.length > 0) {
      await this.client.rpush(key, ...values);
    }
  }

  public async lrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.client.lrange(key, start, stop);
  }

  public async lrem(key: string, count: number, element: string): Promise<void> {
    await this.client.lrem(key, count, element);
  }

  // Pub/Sub operations
  public async publish(channel: string, message: any): Promise<void> {
    await this.publisher.publish(channel, JSON.stringify(message));
  }

  public async subscribe(
    channel: string,
    callback: (message: any) => void
  ): Promise<void> {
    await this.subscriber.subscribe(channel);
    this.subscriber.on('message', (receivedChannel, message) => {
      if (receivedChannel === channel) {
        try {
          const parsed = JSON.parse(message);
          callback(parsed);
        } catch (error) {
          logger.error('Failed to parse pub/sub message:', error);
        }
      }
    });
  }

  public async unsubscribe(channel: string): Promise<void> {
    await this.subscriber.unsubscribe(channel);
  }

  // Session management
  public async setSession(
    sessionId: string,
    userId: string,
    data: any,
    ttl: number = 86400 // 24 hours
  ): Promise<void> {
    const sessionData = {
      userId,
      ...data,
      createdAt: new Date().toISOString()
    };
    await this.set(`session:${sessionId}`, sessionData, ttl);
  }

  public async getSession(sessionId: string): Promise<any | null> {
    return this.get(`session:${sessionId}`);
  }

  public async deleteSession(sessionId: string): Promise<void> {
    await this.del(`session:${sessionId}`);
  }

  // Rate limiting
  public async checkRateLimit(
    key: string,
    limit: number,
    window: number
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const now = Date.now();
    const pipeline = this.client.pipeline();
    
    // Remove expired entries
    pipeline.zremrangebyscore(key, '-inf', now - window * 1000);
    
    // Count current requests
    pipeline.zcard(key);
    
    // Add current request
    pipeline.zadd(key, now, `${now}-${Math.random()}`);
    
    // Set expiration
    pipeline.expire(key, Math.ceil(window));
    
    const results = await pipeline.exec();
    const count = results?.[1]?.[1] as number || 0;
    
    const allowed = count < limit;
    const remaining = Math.max(0, limit - count - 1);
    const resetTime = now + window * 1000;
    
    return { allowed, remaining, resetTime };
  }

  // Cache with auto-refresh
  public async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = 3600
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }
    
    const fresh = await fetcher();
    await this.set(key, fresh, ttl);
    return fresh;
  }

  // Health check
  public async healthCheck(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Redis health check failed:', error);
      return false;
    }
  }

  // Pattern-based operations
  public async deletePattern(pattern: string): Promise<number> {
    const keys = await this.client.keys(pattern);
    if (keys.length === 0) return 0;
    
    await this.client.del(...keys);
    return keys.length;
  }

  public async getKeysPattern(pattern: string): Promise<string[]> {
    return this.client.keys(pattern);
  }
}

export const redis = RedisService.getInstance();
export { RedisService };
