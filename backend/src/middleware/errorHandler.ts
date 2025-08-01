import { Request, Response, NextFunction } from 'express';
import { 
  PrismaClientKnownRequestError,
  PrismaClientUnknownRequestError,
  PrismaClientRustPanicError,
  PrismaClientInitializationError,
  PrismaClientValidationError
} from '@prisma/client/runtime/library';
import { ZodError } from 'zod';
import { logger } from '@/utils/logger';
import { config } from '@/config';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export class CustomError extends Error implements AppError {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

export const createError = (message: string, statusCode: number = 500): CustomError => {
  return new CustomError(message, statusCode);
};

export const errorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Internal server error';
  let details: any = undefined;

  // Handle different error types
  if (error instanceof CustomError) {
    statusCode = error.statusCode;
    message = error.message;
  } else if (error instanceof ZodError) {
    statusCode = 400;
    message = 'Validation error';
    details = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code
    }));  } else if (error instanceof PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        statusCode = 409;
        message = 'Resource already exists';
        details = { field: error.meta?.['target'] };
        break;
      case 'P2025':
        statusCode = 404;
        message = 'Resource not found';
        break;
      case 'P2003':
        statusCode = 400;
        message = 'Foreign key constraint failed';
        break;
      case 'P2004':
        statusCode = 400;
        message = 'Database constraint failed';
        break;
      default:
        statusCode = 500;
        message = 'Database error';
        break;
    }
  } else if (error instanceof PrismaClientUnknownRequestError) {
    statusCode = 500;
    message = 'Unknown database error';
  } else if (error instanceof PrismaClientRustPanicError) {
    statusCode = 500;
    message = 'Database connection error';
  } else if (error instanceof PrismaClientInitializationError) {
    statusCode = 500;
    message = 'Database initialization error';
  } else if (error instanceof PrismaClientValidationError) {
    statusCode = 400;
    message = 'Database validation error';
  } else if (error.name === 'ValidationError') {
    statusCode = 400;
    message = error.message;
  } else if (error.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid data format';
  } else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token expired';
  } else if (error.name === 'MulterError') {
    statusCode = 400;
    switch ((error as any).code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File size too large';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected file field';
        break;
      default:
        message = 'File upload error';
        break;
    }
  } else if ((error as AppError).statusCode) {
    statusCode = (error as AppError).statusCode!;
    message = error.message;
  }

  // Log error details
  const errorLog = {
    message: error.message,
    stack: error.stack,
    statusCode,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: (req as any).user?.id,
    timestamp: new Date().toISOString(),
    ...(details && { details })
  };

  if (statusCode >= 500) {
    logger.error('Server Error:', errorLog);
  } else {
    logger.warn('Client Error:', errorLog);
  }

  // Prepare response
  const response: any = {
    success: false,
    error: message,
    statusCode,
    timestamp: new Date().toISOString()
  };

  // Include additional details in development
  if (config.env === 'development') {
    response.stack = error.stack;
    if (details) {
      response.details = details;
    }
  }

  // Include validation details for client errors
  if (statusCode < 500 && details) {
    response.details = details;
  }

  res.status(statusCode).json(response);
};

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Not found handler
export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  const error = new CustomError(`Route ${req.originalUrl} not found`, 404);
  next(error);
};

// Validation error helper
export const validationError = (message: string, field?: string): CustomError => {
  const error = new CustomError(message, 400);
  if (field) {
    (error as any).field = field;
  }
  return error;
};

// Authentication error helper
export const authError = (message: string = 'Authentication required'): CustomError => {
  return new CustomError(message, 401);
};

// Authorization error helper
export const authorizationError = (message: string = 'Insufficient permissions'): CustomError => {
  return new CustomError(message, 403);
};

// Not found error helper
export const notFoundError = (resource: string = 'Resource'): CustomError => {
  return new CustomError(`${resource} not found`, 404);
};

// Conflict error helper
export const conflictError = (message: string): CustomError => {
  return new CustomError(message, 409);
};

// Rate limit error helper
export const rateLimitError = (message: string = 'Too many requests'): CustomError => {
  return new CustomError(message, 429);
};

export default errorHandler;
