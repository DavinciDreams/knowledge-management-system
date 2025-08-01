import { Request, Response, NextFunction } from 'express';
import { redis } from '../services/redis';
import { logger } from '../utils/logger';

export interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (req: Request) => string;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export const createRateLimit = (options: RateLimitOptions) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes default
    maxRequests = 100,
    keyGenerator = (req) => req.ip || 'unknown',
    message = 'Too many requests, please try again later',
    skipSuccessfulRequests = false,
    skipFailedRequests = false
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const key = `rate_limit:${keyGenerator(req)}`;
      const windowInSeconds = Math.ceil(windowMs / 1000);

      // Check current rate limit status
      const { allowed, remaining, resetTime } = await redis.checkRateLimit(
        key,
        maxRequests,
        windowInSeconds
      );

      // Set rate limit headers
      res.set({
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': new Date(resetTime).toISOString()
      });

      if (!allowed) {
        res.status(429).json({
          error: message,
          retryAfter: Math.ceil((resetTime - Date.now()) / 1000)
        });
        return;
      }

      // Continue to next middleware
      next();

      // Optionally skip counting on response
      res.on('finish', () => {
        const statusCode = res.statusCode;
        const isSuccessful = statusCode >= 200 && statusCode < 300;
        const isFailed = statusCode >= 400;

        if (
          (skipSuccessfulRequests && isSuccessful) ||
          (skipFailedRequests && isFailed)
        ) {
          // Remove the request from count
          redis.getClient().zrem(key, `${Date.now()}-${Math.random()}`);
        }
      });

    } catch (error) {
      logger.error('Rate limiting error:', error);
      // Continue on rate limit errors to avoid blocking requests
      next();
    }
  };
};

// Predefined rate limiters
export const authRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 auth attempts per window
  keyGenerator: (req) => `auth:${req.ip}`,
  message: 'Too many authentication attempts, please try again later'
});

export const apiRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 1000, // 1000 API calls per window
  keyGenerator: (req) => `api:${req.ip}`,
  message: 'API rate limit exceeded'
});

export const uploadRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 100, // 100 uploads per hour
  keyGenerator: (req) => `upload:${req.ip}`,
  message: 'Upload rate limit exceeded'
});

export const searchRateLimit = createRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60, // 60 searches per minute
  keyGenerator: (req) => `search:${req.ip}`,
  message: 'Search rate limit exceeded'
});

export const collaborationRateLimit = createRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 1000, // 1000 collaboration events per minute
  keyGenerator: (req) => `collab:${req.ip}`,
  message: 'Collaboration rate limit exceeded'
});

// User-specific rate limiting
export const createUserRateLimit = (options: Omit<RateLimitOptions, 'keyGenerator'>) => {
  return createRateLimit({
    ...options,
    keyGenerator: (req: any) => {
      const userId = req.user?.id;
      return userId ? `user:${userId}` : `ip:${req.ip}`;
    }
  });
};

// Aggressive rate limiting for specific endpoints
export const strictRateLimit = createRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 requests per minute
  message: 'Rate limit exceeded for this endpoint'
});

// Rate limiting for password reset
export const passwordResetRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 3, // 3 password reset attempts per hour
  keyGenerator: (req) => `password_reset:${req.ip}`,
  message: 'Too many password reset attempts, please try again later'
});

// Rate limiting for email verification
export const emailVerificationRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 5, // 5 verification emails per hour
  keyGenerator: (req) => `email_verification:${req.ip}`,
  message: 'Too many verification email requests, please try again later'
});

// Dynamic rate limiting based on user tier
export const createTieredRateLimit = (tiers: Record<string, RateLimitOptions>) => {
  return async (req: any, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Determine user tier (default to 'free' if not authenticated)
      const userTier = req.user?.settings?.tier || 'free';
      const tierOptions = tiers[userTier] || tiers['free'];

      if (!tierOptions) {
        next();
        return;
      }

      // Apply tier-specific rate limiting
      const rateLimiter = createRateLimit(tierOptions);
      await rateLimiter(req, res, next);
    } catch (error) {
      logger.error('Tiered rate limiting error:', error);
      next();
    }
  };
};

// Example tiered rate limits
export const tieredApiRateLimit = createTieredRateLimit({
  free: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    message: 'Free tier API rate limit exceeded. Upgrade for higher limits.'
  },
  pro: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 1000,
    message: 'Pro tier API rate limit exceeded.'
  },
  enterprise: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10000,
    message: 'Enterprise tier API rate limit exceeded.'
  }
});

// Rate limiting with custom logic
export const customRateLimit = (
  checkFunction: (req: Request) => Promise<{ allowed: boolean; message?: string }>
) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { allowed, message = 'Rate limit exceeded' } = await checkFunction(req);

      if (!allowed) {
        res.status(429).json({ error: message });
        return;
      }

      next();
    } catch (error) {
      logger.error('Custom rate limiting error:', error);
      next();
    }
  };
};

// Distributed rate limiting (for multiple server instances)
export const distributedRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  maxRequests: 100,
  keyGenerator: (req) => `distributed:${req.ip}:${process.env['NODE_ENV']}`
});

// Rate limiting bypass for trusted IPs
export const createBypassableRateLimit = (
  options: RateLimitOptions,
  trustedIPs: string[] = []
) => {
  const rateLimiter = createRateLimit(options);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Skip rate limiting for trusted IPs
    if (trustedIPs.includes(req.ip || '')) {
      next();
      return;
    }

    await rateLimiter(req, res, next);
  };
};

// Default rate limiter for general API use
export const rateLimiter = apiRateLimit;
export const generalRateLimit = apiRateLimit;

// Export default for easier imports
export default rateLimiter;
