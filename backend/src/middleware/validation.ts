import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { logger } from '../utils/logger';

export const validateBody = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validatedData = schema.parse(req.body);
      req.body = validatedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));
        res.status(400).json({ error: 'Validation failed', details: errors });
      } else {
        logger.error('Validation middleware error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  };
};

export const validateQuery = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validatedData = schema.parse(req.query);
      req.query = validatedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));
        res.status(400).json({ error: 'Query validation failed', details: errors });
      } else {
        logger.error('Query validation middleware error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  };
};

export const validateParams = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validatedData = schema.parse(req.params);
      req.params = validatedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));
        res.status(400).json({ error: 'Parameter validation failed', details: errors });
      } else {
        logger.error('Parameter validation middleware error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  };
};

// General request validation middleware
export const validateRequest = (_req: Request, _res: Response, next: NextFunction): void => {
  // General request validation - can be extended based on needs
  next();
};

// Common validation schemas
export const schemas = {
  // Auth schemas
  register: z.object({
    email: z.string().email('Invalid email format'),
    username: z.string()
      .min(3, 'Username must be at least 3 characters')
      .max(30, 'Username must be less than 30 characters')
      .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
    password: z.string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/(?=.*[a-z])/, 'Password must contain at least one lowercase letter')
      .regex(/(?=.*[A-Z])/, 'Password must contain at least one uppercase letter')
      .regex(/(?=.*\d)/, 'Password must contain at least one number'),
    firstName: z.string().min(1, 'First name is required').optional(),
    lastName: z.string().min(1, 'Last name is required').optional()
  }),

  login: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
    rememberMe: z.boolean().optional()
  }),

  changePassword: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/(?=.*[a-z])/, 'Password must contain at least one lowercase letter')
      .regex(/(?=.*[A-Z])/, 'Password must contain at least one uppercase letter')
      .regex(/(?=.*\d)/, 'Password must contain at least one number')
  }),

  resetPassword: z.object({
    token: z.string().min(1, 'Reset token is required'),
    newPassword: z.string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/(?=.*[a-z])/, 'Password must contain at least one lowercase letter')
      .regex(/(?=.*[A-Z])/, 'Password must contain at least one uppercase letter')
      .regex(/(?=.*\d)/, 'Password must contain at least one number')
  }),

  // Notebook schemas
  createNotebook: z.object({
    title: z.string().min(1, 'Title is required').max(255, 'Title too long'),
    description: z.string().max(1000, 'Description too long').optional(),
    color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid color format').optional(),
    icon: z.string().max(50, 'Icon name too long').optional(),
    visibility: z.enum(['PRIVATE', 'SHARED', 'PUBLIC']).optional()
  }),

  getNotebooks: z.object({
    page: z.string().transform(val => parseInt(val)).pipe(z.number().min(1)).optional(),
    limit: z.string().transform(val => parseInt(val)).pipe(z.number().min(1).max(100)).optional(),
    search: z.string().optional(),
    visibility: z.enum(['PRIVATE', 'SHARED', 'PUBLIC']).optional()
  }),

  updateNotebook: z.object({
    title: z.string().min(1, 'Title is required').max(255, 'Title too long').optional(),
    description: z.string().max(1000, 'Description too long').optional(),
    color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid color format').optional(),
    icon: z.string().max(50, 'Icon name too long').optional(),
    visibility: z.enum(['PRIVATE', 'SHARED', 'PUBLIC']).optional()
  }),

  // Page schemas
  createPage: z.object({
    title: z.string().min(1, 'Title is required').max(255, 'Title too long'),
    content: z.any().optional(),
    summary: z.string().max(500, 'Summary too long').optional(),
    type: z.enum(['NOTE', 'DOCUMENT', 'TEMPLATE', 'MEETING_NOTES', 'JOURNAL', 'TASK_LIST', 'KNOWLEDGE_BASE']).optional(),
    visibility: z.enum(['PRIVATE', 'SHARED', 'PUBLIC']).optional(),
    notebookId: z.string().uuid('Invalid notebook ID').optional(),
  }),

  getPages: z.object({
    page: z.string().transform(val => parseInt(val)).pipe(z.number().min(1)).optional(),
    limit: z.string().transform(val => parseInt(val)).pipe(z.number().min(1).max(100)).optional(),
    search: z.string().optional(),
    type: z.enum(['NOTE', 'DOCUMENT', 'TEMPLATE', 'MEETING_NOTES', 'JOURNAL', 'TASK_LIST', 'KNOWLEDGE_BASE']).optional(),
    visibility: z.enum(['PRIVATE', 'SHARED', 'PUBLIC']).optional()
  }),

  updatePage: z.object({
    title: z.string().min(1, 'Title is required').max(255, 'Title too long').optional(),
    content: z.any().optional(),
    summary: z.string().max(500, 'Summary too long').optional(),
    type: z.enum(['NOTE', 'DOCUMENT', 'TEMPLATE', 'MEETING_NOTES', 'JOURNAL', 'TASK_LIST', 'KNOWLEDGE_BASE']).optional(),
    visibility: z.enum(['PRIVATE', 'SHARED', 'PUBLIC']).optional(),
    notebookId: z.string().uuid('Invalid notebook ID').optional(),
    parentId: z.string().uuid('Invalid parent page ID').optional()
  }),

  // Canvas schemas
  createCanvas: z.object({
    title: z.string().min(1, 'Title is required').max(255, 'Title too long'),
    data: z.any().optional(),
    width: z.number().positive('Width must be positive').optional(),
    height: z.number().positive('Height must be positive').optional(),
    type: z.enum(['WHITEBOARD', 'FLOWCHART', 'MINDMAP', 'WIREFRAME', 'DIAGRAM']).optional(),
    visibility: z.enum(['PRIVATE', 'SHARED', 'PUBLIC']).optional(),
    notebookId: z.string().uuid('Invalid notebook ID').optional()
  }),

  updateCanvas: z.object({
    title: z.string().min(1, 'Title is required').max(255, 'Title too long').optional(),
    data: z.any().optional(),
    width: z.number().positive('Width must be positive').optional(),
    height: z.number().positive('Height must be positive').optional(),
    zoom: z.number().positive('Zoom must be positive').optional(),
    offsetX: z.number().optional(),
    offsetY: z.number().optional(),
    type: z.enum(['WHITEBOARD', 'FLOWCHART', 'MINDMAP', 'WIREFRAME', 'DIAGRAM']).optional(),
    visibility: z.enum(['PRIVATE', 'SHARED', 'PUBLIC']).optional(),
    notebookId: z.string().uuid('Invalid notebook ID').optional()
  }),

  // Comment schemas
  createComment: z.object({
    content: z.string().min(1, 'Comment content is required').max(2000, 'Comment too long'),
    pageId: z.string().uuid('Invalid page ID').optional(),
    parentId: z.string().uuid('Invalid parent comment ID').optional(),
    position: z.any().optional()
  }),

  updateComment: z.object({
    content: z.string().min(1, 'Comment content is required').max(2000, 'Comment too long').optional(),
    resolved: z.boolean().optional()
  }),

  // Collaboration schemas
  shareResource: z.object({
    email: z.string().email('Invalid email format'),
    role: z.enum(['OWNER', 'EDITOR', 'COMMENTER', 'VIEWER']),
    canEdit: z.boolean().optional(),
    canShare: z.boolean().optional(),
    canDelete: z.boolean().optional()
  }),

  updateCollaboration: z.object({
    role: z.enum(['OWNER', 'EDITOR', 'COMMENTER', 'VIEWER']).optional(),
    canEdit: z.boolean().optional(),
    canShare: z.boolean().optional(),
    canDelete: z.boolean().optional()
  }),

  // Search schemas
  search: z.object({
    q: z.string().min(1, 'Search query is required'),
    type: z.enum(['all', 'pages', 'notebooks', 'canvases']).optional(),
    limit: z.coerce.number().min(1).max(100).optional(),
    offset: z.coerce.number().min(0).optional(),
    sort: z.enum(['relevance', 'created', 'updated', 'title']).optional(),
    order: z.enum(['asc', 'desc']).optional()
  }),

  // Entity schemas
  createEntity: z.object({
    name: z.string().min(1, 'Entity name is required').max(255, 'Name too long'),
    type: z.enum(['PERSON', 'ORGANIZATION', 'LOCATION', 'EVENT', 'CONCEPT', 'DOCUMENT', 'PROJECT', 'TASK', 'MEETING', 'DATE', 'TIME']),
    description: z.string().max(1000, 'Description too long').optional(),
    metadata: z.any().optional(),
    confidence: z.number().min(0).max(1).optional(),
    pageId: z.string().uuid('Invalid page ID').optional()
  }),

  // Voice note schemas
  createVoiceNote: z.object({
    title: z.string().max(255, 'Title too long').optional(),
    duration: z.number().positive('Duration must be positive'),
    size: z.number().positive('Size must be positive'),
    pageId: z.string().uuid('Invalid page ID').optional()
  }),

  // Pagination schemas
  pagination: z.object({
    page: z.coerce.number().min(1).optional(),
    limit: z.coerce.number().min(1).max(100).optional(),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).optional()
  }),

  // Common parameter schemas
  id: z.object({
    id: z.string().uuid('Invalid ID format')
  }),

  slug: z.object({
    slug: z.string().min(1, 'Slug is required')
  })
};

// Helper function to validate file uploads
export const validateFileUpload = (
  maxSize: number = 100 * 1024 * 1024, // 100MB default
  allowedTypes: string[] = []
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.file && !req.files) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const files = req.files ? (Array.isArray(req.files) ? req.files : [req.file]) : [req.file];

    for (const file of files) {
      if (!file) continue;

      // Check file size
      if (file.size > maxSize) {
        res.status(400).json({ 
          error: `File too large. Maximum size is ${Math.round(maxSize / (1024 * 1024))}MB` 
        });
        return;
      }

      // Check file type if specified
      if (allowedTypes.length > 0) {
        const isAllowed = allowedTypes.some(type => {
          if (type.endsWith('/*')) {
            return file.mimetype.startsWith(type.slice(0, -2));
          }
          return file.mimetype === type;
        });

        if (!isAllowed) {
          res.status(400).json({ 
            error: `File type ${file.mimetype} not allowed. Allowed types: ${allowedTypes.join(', ')}` 
          });
          return;
        }
      }
    }

    next();
  };
};
