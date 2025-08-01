import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth';
import { logger } from '../utils/logger';

// Type augmentation is done globally through ../types/express.d.ts

export const authMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '') || req.cookies?.accessToken;

    if (!token) {
      _res.status(401).json({ error: 'Access token required' });
      return;
    }

    const user = await authService.verifyAccessToken(token);
    req.user = user;
    next();
  } catch (error) {
    logger.error('Authentication failed:', error);
    _res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const optionalAuthMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '') || req.cookies?.accessToken;

    if (token) {
      try {
        const user = await authService.verifyAccessToken(token);
        req.user = user;
      } catch (error) {
        // Continue without user if token is invalid
        logger.debug('Optional auth failed:', error);
      }
    }

    next();
  } catch (error) {
    logger.error('Optional authentication middleware error:', error);
    next();
  }
};

export const requireEmailVerification = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user?.emailVerified) {
    res.status(403).json({ error: 'Email verification required' });
    return;
  }
  next();
};

export const requireRole = (_roles: string[]) => {
  return (_req: Request, _res: Response, next: NextFunction): void => {
    // For now, we don't have roles in the schema
    // This is a placeholder for future role-based access control
    next();
  };
};

export const requireOwnership = (_resourceType: 'page' | 'notebook' | 'canvas') => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      // This would be implemented based on the specific resource type
      // For now, we'll just check if the user exists
      next();
    } catch (error) {
      logger.error('Ownership check failed:', error);
      res.status(500).json({ error: 'Failed to verify ownership' });
    }
  };
};

export const verifyOwnership = (_resourceType: 'page' | 'notebook' | 'canvas') => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      // This would be implemented based on the specific resource type
      // For now, we'll just check if the user exists and pass through
      // TODO: Implement proper ownership verification when database queries are available
      next();
    } catch (error) {
      logger.error('Ownership verification failed:', error);
      res.status(500).json({ error: 'Failed to verify ownership' });
    }
  };
};

export const verifyNotebookAccess = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // This would be implemented to check if the user has access to the notebook
    // For now, we'll just check if the user exists and pass through
    // TODO: Implement proper notebook access verification
    next();
  } catch (error) {
    logger.error('Notebook access verification failed:', error);
    res.status(500).json({ error: 'Failed to verify notebook access' });
  }
};
