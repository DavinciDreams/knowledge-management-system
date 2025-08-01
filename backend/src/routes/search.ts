import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { validateQuery } from '../middleware/validation';
import { generalRateLimit } from '../middleware/rateLimit';
import { logger } from '../utils/logger';
import { db } from '../services/database';

const router = Router();

// Global search across user's content
router.get('/',
  authMiddleware,
  generalRateLimit,
  validateQuery(z.object({
    q: z.string().min(1),
    type: z.enum(['all', 'notebooks', 'pages', 'comments']).default('all'),
    scope: z.enum(['owned', 'shared', 'public', 'all']).default('all'),
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(50).default(10),
    sortBy: z.enum(['relevance', 'date', 'title']).default('relevance'),
    sortOrder: z.enum(['asc', 'desc']).default('desc')
  })),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { q, type, scope, page, limit, sortBy, sortOrder } = req.query;
      const offset = (Number(page) - 1) * Number(limit);

      const results: any = {
        query: q,
        total: 0,
        notebooks: [],
        pages: [],
        comments: []
      };

      // Base access conditions
      const getAccessConditions = () => {
        const conditions: any[] = [];
        
        if (scope === 'owned') {
          conditions.push({ userId });
        } else if (scope === 'shared') {
          conditions.push({
            collaborators: {
              some: {
                userId,
                status: 'ACCEPTED'
              }
            }
          });
        } else if (scope === 'public') {
          conditions.push({ isPublic: true });
        } else {
          // All accessible content
          conditions.push(
            { userId },
            { isPublic: true },
            {
              collaborators: {
                some: {
                  userId,
                  status: 'ACCEPTED'
                }
              }
            }
          );
        }
        
        return conditions;
      };

      // Search notebooks
      if (type === 'all' || type === 'notebooks') {
        const notebookWhere = {
          OR: [
            { title: { contains: q as string, mode: 'insensitive' as const } },
            { description: { contains: q as string, mode: 'insensitive' as const } }
          ],
          AND: {
            OR: getAccessConditions()
          }
        };

        const [notebooks, notebooksCount] = await Promise.all([
          db.notebook.findMany({
            where: notebookWhere,
            select: {
              id: true,
              title: true,
              description: true,
              tags: true,
              isPublic: true,
              createdAt: true,
              updatedAt: true,
              user: {
                select: {
                  id: true,
                  username: true,
                  firstName: true,
                  lastName: true,
                  avatar: true
                }
              },
              _count: {
                select: {
                  pages: true,
                  collaborators: true
                }
              }
            },
            ...(type === 'notebooks' && {
              skip: offset,
              take: Number(limit)
            }),
            orderBy: sortBy === 'date' ? 
              { updatedAt: sortOrder as 'asc' | 'desc' } : 
              { title: sortOrder as 'asc' | 'desc' }
          }),
          db.notebook.count({ where: notebookWhere })
        ]);

        results.notebooks = notebooks;
        if (type === 'notebooks') {
          results.total = notebooksCount;
        }
      }

      // Search pages
      if (type === 'all' || type === 'pages') {
        const pageWhere = {
          OR: [
            { title: { contains: q as string, mode: 'insensitive' as const } }
          ],
          notebook: {
            OR: getAccessConditions()
          }
        };

        const [pages, pagesCount] = await Promise.all([
          db.page.findMany({
            where: pageWhere,
            select: {
              id: true,
              title: true,
              type: true,
              parentId: true,
              createdAt: true,
              updatedAt: true,
              user: {
                select: {
                  id: true,
                  username: true,
                  firstName: true,
                  lastName: true,
                  avatar: true
                }
              },
              notebook: {
                select: {
                  id: true,
                  title: true,
                  isPublic: true
                }
              },
              _count: {
                select: {
                  children: true,
                  comments: true
                }
              }
            },
            ...(type === 'pages' && {
              skip: offset,
              take: Number(limit)
            }),
            orderBy: sortBy === 'date' ? 
              { updatedAt: sortOrder as 'asc' | 'desc' } : 
              { title: sortOrder as 'asc' | 'desc' }
          }),
          db.page.count({ where: pageWhere })
        ]);

        results.pages = pages;
        if (type === 'pages') {
          results.total = pagesCount;
        }
      }

      // Search comments
      if (type === 'all' || type === 'comments') {
        const commentWhere = {
          content: { contains: q as string, mode: 'insensitive' as const },
          page: {
            notebook: {
              OR: getAccessConditions()
            }
          }
        };

        const [comments, commentsCount] = await Promise.all([
          db.comment.findMany({
            where: commentWhere,
            select: {
              id: true,
              content: true,
              createdAt: true,
              updatedAt: true,
              user: {
                select: {
                  id: true,
                  username: true,
                  firstName: true,
                  lastName: true,
                  avatar: true
                }
              },
              page: {
                select: {
                  id: true,
                  title: true,
                  notebook: {
                    select: {
                      id: true,
                      title: true
                    }
                  }
                }
              }
            },
            ...(type === 'comments' && {
              skip: offset,
              take: Number(limit)
            }),
            orderBy: { createdAt: sortOrder as 'asc' | 'desc' }
          }),
          db.comment.count({ where: commentWhere })
        ]);

        results.comments = comments;
        if (type === 'comments') {
          results.total = commentsCount;
        }
      }

      // For 'all' type, calculate combined total
      if (type === 'all') {
        results.total = results.notebooks.length + results.pages.length + results.comments.length;
        
        // Limit results for 'all' type
        const allResults = [
          ...results.notebooks.slice(0, 3),
          ...results.pages.slice(0, 4),
          ...results.comments.slice(0, 3)
        ];
        
        if (allResults.length > Number(limit)) {
          results.notebooks = results.notebooks.slice(0, Math.ceil(Number(limit) / 3));
          results.pages = results.pages.slice(0, Math.ceil(Number(limit) / 3));
          results.comments = results.comments.slice(0, Math.ceil(Number(limit) / 3));
        }
      }

      results.pagination = {
        page: Number(page),
        limit: Number(limit),
        total: results.total,
        pages: Math.ceil(results.total / Number(limit))
      };

      logger.info(`Search performed by user ${userId}: "${q}" (${results.total} results)`);
      
    return res.json(results);
    } catch (error) {
      logger.error('Search failed:', error);
    return res.status(500).json({ error: 'Search failed' });
    }
  }
);

// Advanced search with filters
router.post('/advanced',
  authMiddleware,
  generalRateLimit,
  validateQuery(z.object({
    query: z.string().optional(),
    filters: z.object({
      type: z.enum(['notebooks', 'pages', 'comments']).optional(),
      tags: z.array(z.string()).optional(),
      dateRange: z.object({
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional()
      }).optional(),
      authors: z.array(z.string()).optional(),
      notebooks: z.array(z.string()).optional(),
      hasComments: z.boolean().optional(),
      isPublic: z.boolean().optional()
    }).optional(),
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(50).default(10),
    sortBy: z.enum(['relevance', 'date', 'title', 'author']).default('relevance'),
    sortOrder: z.enum(['asc', 'desc']).default('desc')
  })),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { query, filters = {}, page, limit, sortBy, sortOrder } = req.body;
      const offset = (Number(page) - 1) * Number(limit);

      // Build where conditions based on filters
      const buildWhereConditions = (entityType: 'notebook' | 'page' | 'comment') => {
        const baseAccess = {
          OR: [
            { userId },
            { isPublic: true },
            ...(entityType === 'notebook' ? [{
              collaborators: {
                some: {
                  userId,
                  status: 'ACCEPTED'
                }
              }
            }] : []),
            ...(entityType !== 'notebook' ? [{
              notebook: {
                OR: [
                  { userId },
                  { isPublic: true },
                  {
                    collaborators: {
                      some: {
                        userId,
                        status: 'ACCEPTED'
                      }
                    }
                  }
                ]
              }
            }] : [])
          ]
        };

        const conditions: any = {};

        // Text search
        if (query) {
          if (entityType === 'notebook') {
            conditions.OR = [
              { title: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } }
            ];
          } else if (entityType === 'page') {
            conditions.title = { contains: query, mode: 'insensitive' };
          } else if (entityType === 'comment') {
            conditions.content = { contains: query, mode: 'insensitive' };
          }
        }

        // Date range filter
        if (filters.dateRange) {
          const dateFilter: any = {};
          if (filters.dateRange.from) {
            dateFilter.gte = new Date(filters.dateRange.from);
          }
          if (filters.dateRange.to) {
            dateFilter.lte = new Date(filters.dateRange.to);
          }
          if (Object.keys(dateFilter).length > 0) {
            conditions.createdAt = dateFilter;
          }
        }

        // Tags filter (for notebooks)
        if (filters.tags && filters.tags.length > 0 && entityType === 'notebook') {
          conditions.tags = {
            hasEvery: filters.tags
          };
        }

        // Authors filter
        if (filters.authors && filters.authors.length > 0) {
          conditions.userId = {
            in: filters.authors
          };
        }

        // Notebooks filter (for pages and comments)
        if (filters.notebooks && filters.notebooks.length > 0) {
          if (entityType === 'page') {
            conditions.notebookId = {
              in: filters.notebooks
            };
          } else if (entityType === 'comment') {
            conditions.page = {
              notebookId: {
                in: filters.notebooks
              }
            };
          }
        }

        // Has comments filter (for pages)
        if (filters.hasComments !== undefined && entityType === 'page') {
          if (filters.hasComments) {
            conditions.comments = {
              some: {}
            };
          } else {
            conditions.comments = {
              none: {}
            };
          }
        }

        // Public filter
        if (filters.isPublic !== undefined) {
          if (entityType === 'notebook') {
            conditions.isPublic = filters.isPublic;
          } else {
            conditions.notebook = {
              ...conditions.notebook,
              isPublic: filters.isPublic
            };
          }
        }

        return {
          ...conditions,
          AND: entityType === 'notebook' ? baseAccess : 
               entityType === 'page' ? { notebook: baseAccess } :
               { page: { notebook: baseAccess } }
        };
      };

      const results: any = {};

      // Search based on type filter
      if (!filters.type || filters.type === 'notebooks') {
        const where = buildWhereConditions('notebook');
        const [notebooks, notebooksCount] = await Promise.all([
          db.notebook.findMany({
            where,
            select: {
              id: true,
              title: true,
              description: true,
              tags: true,
              isPublic: true,
              createdAt: true,
              updatedAt: true,
              user: {
                select: {
                  id: true,
                  username: true,
                  firstName: true,
                  lastName: true,
                  avatar: true
                }
              },
              _count: {
                select: {
                  pages: true,
                  collaborators: true
                }
              }
            },
            skip: offset,
            take: Number(limit),
            orderBy: sortBy === 'date' ? 
              { updatedAt: sortOrder as 'asc' | 'desc' } : 
              sortBy === 'author' ? 
                { user: { username: sortOrder as 'asc' | 'desc' } } :
                { title: sortOrder as 'asc' | 'desc' }
          }),
          db.notebook.count({ where })
        ]);

        results.notebooks = notebooks;
        results.total = notebooksCount;
      }

      if (!filters.type || filters.type === 'pages') {
        const where = buildWhereConditions('page');
        const [pages, pagesCount] = await Promise.all([
          db.page.findMany({
            where,
            select: {
              id: true,
              title: true,
              type: true,
              parentId: true,
              createdAt: true,
              updatedAt: true,
              user: {
                select: {
                  id: true,
                  username: true,
                  firstName: true,
                  lastName: true,
                  avatar: true
                }
              },
              notebook: {
                select: {
                  id: true,
                  title: true,
                  isPublic: true
                }
              },
              _count: {
                select: {
                  children: true,
                  comments: true
                }
              }
            },
            skip: offset,
            take: Number(limit),
            orderBy: sortBy === 'date' ? 
              { updatedAt: sortOrder as 'asc' | 'desc' } : 
              sortBy === 'author' ? 
                { user: { username: sortOrder as 'asc' | 'desc' } } :
                { title: sortOrder as 'asc' | 'desc' }
          }),
          db.page.count({ where })
        ]);

        results.pages = pages;
        if (!results.total) results.total = pagesCount;
      }

      if (!filters.type || filters.type === 'comments') {
        const where = buildWhereConditions('comment');
        const [comments, commentsCount] = await Promise.all([
          db.comment.findMany({
            where,
            select: {
              id: true,
              content: true,
              createdAt: true,
              updatedAt: true,
              user: {
                select: {
                  id: true,
                  username: true,
                  firstName: true,
                  lastName: true,
                  avatar: true
                }
              },
              page: {
                select: {
                  id: true,
                  title: true,
                  notebook: {
                    select: {
                      id: true,
                      title: true
                    }
                  }
                }
              }
            },
            skip: offset,
            take: Number(limit),
            orderBy: sortBy === 'date' ? 
              { createdAt: sortOrder as 'asc' | 'desc' } : 
              sortBy === 'author' ? 
                { user: { username: sortOrder as 'asc' | 'desc' } } :
                { createdAt: sortOrder as 'asc' | 'desc' }
          }),
          db.comment.count({ where })
        ]);

        results.comments = comments;
        if (!results.total) results.total = commentsCount;
      }

      results.pagination = {
        page: Number(page),
        limit: Number(limit),
        total: results.total || 0,
        pages: Math.ceil((results.total || 0) / Number(limit))
      };

      logger.info(`Advanced search performed by user ${userId} (${results.total} results)`);
      
    return res.json(results);
    } catch (error) {
      logger.error('Advanced search failed:', error);
    return res.status(500).json({ error: 'Advanced search failed' });
    }
  }
);

// Get search suggestions
router.get('/suggestions',
  authMiddleware,
  generalRateLimit,
  validateQuery(z.object({
    q: z.string().min(1),
    type: z.enum(['notebooks', 'pages', 'tags', 'users']).default('notebooks'),
    limit: z.coerce.number().min(1).max(10).default(5)
  })),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { q, type, limit } = req.query;

      let suggestions: any[] = [];

      const accessConditions = {
        OR: [
          { userId },
          { isPublic: true },
          {
            collaborators: {
              some: {
                userId,
                status: 'ACCEPTED'
              }
            }
          }
        ]
      };

      switch (type) {
        case 'notebooks':
          suggestions = await db.notebook.findMany({
            where: {
              title: { contains: q as string, mode: 'insensitive' },
              ...accessConditions
            },
            select: {
              id: true,
              title: true,
              description: true
            },
            take: Number(limit),
            orderBy: { title: 'asc' }
          });
          break;

        case 'pages':
          suggestions = await db.page.findMany({
            where: {
              title: { contains: q as string, mode: 'insensitive' },
              notebook: accessConditions
            },
            select: {
              id: true,
              title: true,
              type: true,
              notebook: {
                select: {
                  id: true,
                  title: true
                }
              }
            },
            take: Number(limit),
            orderBy: { title: 'asc' }
          });
          break;

        case 'tags':
          // Get distinct tags from accessible notebooks
          const notebooks = await db.notebook.findMany({
            where: accessConditions,
            select: { tags: true }
          });
          
          const allTags = notebooks.flatMap((n: any) => n.tags);
          const uniqueTags = [...new Set(allTags)]
            .filter((tag): tag is string => typeof tag === 'string' && tag.toLowerCase().includes((q as string).toLowerCase()))
            .slice(0, Number(limit));
          
          suggestions = uniqueTags.map(tag => ({ tag }));
          break;

        case 'users':
          // Search collaborators and notebook owners
          const users = await db.user.findMany({
            where: {
              OR: [
                { username: { contains: q as string, mode: 'insensitive' } },
                { firstName: { contains: q as string, mode: 'insensitive' } },
                { lastName: { contains: q as string, mode: 'insensitive' } }
              ]
            },
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              avatar: true
            },
            take: Number(limit),
            orderBy: { username: 'asc' }
          });
          
          suggestions = users;
          break;
      }

    return res.json({ suggestions });
    } catch (error) {
      logger.error('Failed to get search suggestions:', error);
    return res.status(500).json({ error: 'Failed to get search suggestions' });
    }
  }
);

// Save search query for user
router.post('/history',
  authMiddleware,
  generalRateLimit,
  validateQuery(z.object({
    query: z.string().min(1),
    filters: z.any().optional(),
    resultCount: z.number().optional()
  })),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { query, filters: _filters, resultCount } = req.body;

      // Save to user's search history (implement in database or cache)
      // For now, just log it
      logger.info(`Search history saved for user ${userId}: "${query}" (${resultCount} results)`);
      
    return res.json({ message: 'Search saved to history' });
    } catch (error) {
      logger.error('Failed to save search history:', error);
    return res.status(500).json({ error: 'Failed to save search history' });
    }
  }
);

// Get user's search history
router.get('/history',
  authMiddleware,
  generalRateLimit,
  async (_req: Request, res: Response) => {
    try {
      // const userId = req.user!.id;

      // For now, return empty array - implement actual search history storage
      const searchHistory: any[] = [];

    return res.json({ history: searchHistory });
    } catch (error) {
      logger.error('Failed to get search history:', error);
    return res.status(500).json({ error: 'Failed to get search history' });
    }
  }
);

export default router;
