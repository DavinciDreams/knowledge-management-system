import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { validateBody, validateQuery, schemas } from '../middleware/validation';
import { generalRateLimit } from '../middleware/rateLimit';
import { logger } from '../utils/logger';
import { db } from '../services/database';

const router = Router();

// Create new page
router.post('/',
  authMiddleware,
  generalRateLimit,
  validateBody(schemas.createPage),
  async (req: Request, res: Response) => {
    try {
      const { notebookId, title, type, parentId, content, settings } = req.body;
      const userId = req.user!.id;

      // Verify user has access to the notebook
      const notebook = await db.notebook.findFirst({
        where: {
          id: notebookId,
          OR: [
            { userId },
            {
              collaborators: {
                some: {
                  userId,
                  status: 'ACCEPTED',
                  role: { in: ['EDITOR', 'ADMIN'] }
                }
              }
            }
          ]
        }
      });

      if (!notebook) {
        return res.status(403).json({ error: 'Access denied to notebook' });
      }

      // Get next position for the page
      const lastPage = await db.page.findFirst({
        where: {
          notebookId,
          parentId: parentId || null
        },
        orderBy: { position: 'desc' },
        select: { position: true }
      });

      const position = (lastPage?.position || 0) + 1;

      const page = await db.page.create({
        data: {
          title,
          type,
          content: content || {},
          settings: settings || {},
          position,
          notebookId,
          parentId: parentId || null,
          userId
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              avatar: true
            }
          },
          children: {
            select: {
              id: true,
              title: true,
              type: true,
              position: true,
              createdAt: true,
              updatedAt: true
            },
            orderBy: { position: 'asc' }
          },
          _count: {
            select: {
              children: true,
              comments: true
            }
          }
        }
      });

      logger.info(`Created page ${page.id} in notebook ${notebookId}`);
      
    return res.status(201).json({
        message: 'Page created successfully',
        page
      });
    } catch (error) {
      logger.error('Failed to create page:', error);
    return res.status(500).json({ error: 'Failed to create page' });
    }
  }
);

// Get pages for a notebook
router.get('/notebook/:notebookId',
  authMiddleware,
  generalRateLimit,
  validateQuery(schemas.getPages),
  async (req: Request, res: Response) => {
    try {
      const notebookId = req.params["notebookId"];
      const userId = req.user!.id;
      const { 
        page = 1, 
        limit = 20, 
        search, 
        type, 
        parentId,
        includeContent = false 
      } = req.query;

      // Verify access to notebook
      const notebook = await db.notebook.findFirst({
        where: {
          id: notebookId,
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
      });

      if (!notebook) {
        return res.status(403).json({ error: 'Access denied to notebook' });
      }

      const offset = (Number(page) - 1) * Number(limit);
      
      const where: any = {
        notebookId
      };

      if (parentId !== undefined) {
        where.parentId = parentId === 'null' ? null : parentId;
      }

      if (search) {
        where.OR = [
          { title: { contains: search as string, mode: 'insensitive' } }
        ];
      }

      if (type) {
        where.type = type;
      }

      const [pages, total] = await Promise.all([
        db.page.findMany({
          where,
          select: {
            id: true,
            title: true,
            type: true,
            position: true,
            parentId: true,
            createdAt: true,
            updatedAt: true,
            ...(includeContent && { content: true, settings: true }),
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
                children: true,
                comments: true
              }
            }
          },
          orderBy: [
            { position: 'asc' },
            { createdAt: 'desc' }
          ],
          skip: offset,
          take: Number(limit)
        }),
        db.page.count({ where })
      ]);

    return res.json({
        pages,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      });
    } catch (error) {
      logger.error('Failed to get pages:', error);
    return res.status(500).json({ error: 'Failed to get pages' });
    }
  }
);

// Get specific page
router.get('/:id',
  authMiddleware,
  generalRateLimit,
  async (req: Request, res: Response) => {
    try {
      const pageId = req.params["id"];
      const userId = req.user!.id;

      const page = await db.page.findFirst({
        where: {
          id: pageId,
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
        },
        include: {
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
              userId: true
            }
          },
          parent: {
            select: {
              id: true,
              title: true,
              type: true
            }
          },
          children: {
            select: {
              id: true,
              title: true,
              type: true,
              position: true,
              createdAt: true,
              updatedAt: true
            },
            orderBy: { position: 'asc' }
          },
          comments: {
            where: {
              parentId: null
            },
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  firstName: true,
                  lastName: true,
                  avatar: true
                }
              },
              replies: {
                include: {
                  user: {
                    select: {
                      id: true,
                      username: true,
                      firstName: true,
                      lastName: true,
                      avatar: true
                    }
                  }
                },
                orderBy: { createdAt: 'asc' }
              }
            },
            orderBy: { createdAt: 'desc' },
            take: 10
          },
          _count: {
            select: {
              children: true,
              comments: true
            }
          }
        }
      });

      if (!page) {
        return res.status(404).json({ error: 'Page not found' });
      }

    return res.json({ page });
    } catch (error) {
      logger.error('Failed to get page:', error);
    return res.status(500).json({ error: 'Failed to get page' });
    }
  }
);

// Update page
router.patch('/:id',
  authMiddleware,
  generalRateLimit,
  validateBody(schemas.updatePage),
  async (req: Request, res: Response) => {
    try {
      const pageId = req.params["id"];
      const userId = req.user!.id;
      const { title, content, settings, position, parentId } = req.body;

      // Verify user has edit access to the page
      const existingPage = await db.page.findFirst({
        where: {
          id: pageId,
          notebook: {
            OR: [
              { userId },
              {
                collaborators: {
                  some: {
                    userId,
                    status: 'ACCEPTED',
                    role: { in: ['EDITOR', 'ADMIN'] }
                  }
                }
              }
            ]
          }
        }
      });

      if (!existingPage) {
        return res.status(403).json({ error: 'Access denied to page' });
      }

      const page = await db.page.update({
        where: { id: pageId },
        data: {
          ...(title && { title }),
          ...(content && { content }),
          ...(settings && { settings }),
          ...(position !== undefined && { position }),
          ...(parentId !== undefined && { parentId: parentId || null })
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              avatar: true
            }
          },
          children: {
            select: {
              id: true,
              title: true,
              type: true,
              position: true,
              createdAt: true,
              updatedAt: true
            },
            orderBy: { position: 'asc' }
          },
          _count: {
            select: {
              children: true,
              comments: true
            }
          }
        }
      });

      logger.info(`Updated page ${pageId}`);
      
    return res.json({
        message: 'Page updated successfully',
        page
      });
    } catch (error) {
      logger.error('Failed to update page:', error);
    return res.status(500).json({ error: 'Failed to update page' });
    }
  }
);

// Delete page
router.delete('/:id',
  authMiddleware,
  generalRateLimit,
  async (req: Request, res: Response) => {
    try {
      const pageId = req.params["id"];
      const userId = req.user!.id;

      // Verify user has edit access to the page
      const page = await db.page.findFirst({
        where: {
          id: pageId,
          notebook: {
            OR: [
              { userId },
              {
                collaborators: {
                  some: {
                    userId,
                    status: 'ACCEPTED',
                    role: { in: ['EDITOR', 'ADMIN'] }
                  }
                }
              }
            ]
          }
        }
      });

      if (!page) {
        return res.status(403).json({ error: 'Access denied to page' });
      }

      // Delete page and all related data (cascading deletes)
      await db.page.delete({
        where: { id: pageId }
      });

      logger.info(`Deleted page ${pageId}`);
      
    return res.json({ message: 'Page deleted successfully' });
    } catch (error) {
      logger.error('Failed to delete page:', error);
    return res.status(500).json({ error: 'Failed to delete page' });
    }
  }
);

// Duplicate page
router.post('/:id/duplicate',
  authMiddleware,
  generalRateLimit,
  validateBody(z.object({
    title: z.string().optional(),
    notebookId: z.string().optional()
  })),
  async (req: Request, res: Response) => {
    try {
      const pageId = req.params["id"];
      const userId = req.user!.id;
      const { title, notebookId } = req.body;

      // Get the original page
      const originalPage = await db.page.findFirst({
        where: {
          id: pageId,
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
        }
      });

      if (!originalPage) {
        return res.status(404).json({ error: 'Page not found' });
      }

      const targetNotebookId = notebookId || originalPage.notebookId;

      // Verify access to target notebook
      const targetNotebook = await db.notebook.findFirst({
        where: {
          id: targetNotebookId,
          OR: [
            { userId },
            {
              collaborators: {
                some: {
                  userId,
                  status: 'ACCEPTED',
                  role: { in: ['EDITOR', 'ADMIN'] }
                }
              }
            }
          ]
        }
      });

      if (!targetNotebook) {
        return res.status(403).json({ error: 'Access denied to target notebook' });
      }

      // Get next position
      const lastPage = await db.page.findFirst({
        where: {
          notebookId: targetNotebookId,
          parentId: null
        },
        orderBy: { position: 'desc' },
        select: { position: true }
      });

      const position = (lastPage?.position || 0) + 1;

      // Create duplicate
      const duplicatedPage = await db.page.create({
        data: {
          title: title || `${originalPage.title} (Copy)`,
          type: originalPage.type,
          content: originalPage.content,
          settings: originalPage.settings,
          position,
          notebookId: targetNotebookId,
          userId
        },
        include: {
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
              children: true,
              comments: true
            }
          }
        }
      });

      logger.info(`Duplicated page ${pageId} to ${duplicatedPage.id}`);
      
    return res.status(201).json({
        message: 'Page duplicated successfully',
        page: duplicatedPage
      });
    } catch (error) {
      logger.error('Failed to duplicate page:', error);
    return res.status(500).json({ error: 'Failed to duplicate page' });
    }
  }
);

// Move page
router.post('/:id/move',
  authMiddleware,
  generalRateLimit,
  validateBody(z.object({
    notebookId: z.string().optional(),
    parentId: z.string().optional(),
    position: z.number().optional()
  })),
  async (req: Request, res: Response) => {
    try {
      const pageId = req.params["id"];
      const userId = req.user!.id;
      const { notebookId, parentId, position } = req.body;

      // Get the page
      const page = await db.page.findFirst({
        where: {
          id: pageId,
          notebook: {
            OR: [
              { userId },
              {
                collaborators: {
                  some: {
                    userId,
                    status: 'ACCEPTED',
                    role: { in: ['EDITOR', 'ADMIN'] }
                  }
                }
              }
            ]
          }
        }
      });

      if (!page) {
        return res.status(403).json({ error: 'Access denied to page' });
      }

      const targetNotebookId = notebookId || page.notebookId;

      // If moving to different notebook, verify access
      if (targetNotebookId !== page.notebookId) {
        const targetNotebook = await db.notebook.findFirst({
          where: {
            id: targetNotebookId,
            OR: [
              { userId },
              {
                collaborators: {
                  some: {
                    userId,
                    status: 'ACCEPTED',
                    role: { in: ['EDITOR', 'ADMIN'] }
                  }
                }
              }
            ]
          }
        });

        if (!targetNotebook) {
          return res.status(403).json({ error: 'Access denied to target notebook' });
        }
      }

      let newPosition = position;
      if (newPosition === undefined) {
        const lastPage = await db.page.findFirst({
          where: {
            notebookId: targetNotebookId,
            parentId: parentId || null
          },
          orderBy: { position: 'desc' },
          select: { position: true }
        });
        newPosition = (lastPage?.position || 0) + 1;
      }

      // Update page
      const updatedPage = await db.page.update({
        where: { id: pageId },
        data: {
          notebookId: targetNotebookId,
          parentId: parentId || null,
          position: newPosition
        },
        include: {
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
              children: true,
              comments: true
            }
          }
        }
      });

      logger.info(`Moved page ${pageId} to notebook ${targetNotebookId}`);
      
    return res.json({
        message: 'Page moved successfully',
        page: updatedPage
      });
    } catch (error) {
      logger.error('Failed to move page:', error);
    return res.status(500).json({ error: 'Failed to move page' });
    }
  }
);

// Get page history/versions
router.get('/:id/history',
  authMiddleware,
  generalRateLimit,
  async (req: Request, res: Response) => {
    try {
      const pageId = req.params["id"];
      const userId = req.user!.id;

      // Verify access to page
      const page = await db.page.findFirst({
        where: {
          id: pageId,
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
        }
      });

      if (!page) {
        return res.status(404).json({ error: 'Page not found' });
      }

      // Get activity history for the page
      const activities = await db.activity.findMany({
        where: {
          entityType: 'PAGE',
          entityId: pageId
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              avatar: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 50
      });

    return res.json({ activities });
    } catch (error) {
      logger.error('Failed to get page history:', error);
    return res.status(500).json({ error: 'Failed to get page history' });
    }
  }
);

export default router;
