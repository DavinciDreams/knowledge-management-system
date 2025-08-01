import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware, verifyOwnership } from '../middleware/auth';
import { validateBody, validateQuery, schemas } from '../middleware/validation';
import { generalRateLimit } from '../middleware/rateLimit';
import { logger } from '../utils/logger';
import { db } from '../services/database';

const router = Router();

// Create new notebook
router.post('/',
  authMiddleware,
  generalRateLimit,
  validateBody(schemas.createNotebook),
  async (req: Request, res: Response) => {
    try {
      const { title, description, tags, isPublic } = req.body;
      const userId = req.user!.id;

      const notebook = await db.notebook.create({
        data: {
          title,
          description,
          tags: tags || [],
          isPublic: isPublic || false,
          userId,
          settings: {}
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
              pages: true,
              collaborators: true
            }
          }
        }
      });

      logger.info(`Created notebook ${notebook.id} for user ${userId}`);
      
    return res.status(201).json({
        message: 'Notebook created successfully',
        notebook
      });
    } catch (error) {
      logger.error('Failed to create notebook:', error);
    return res.status(500).json({ error: 'Failed to create notebook' });
    }
  }
);

// Get user's notebooks
router.get('/',
  authMiddleware,
  generalRateLimit,
  validateQuery(schemas.getNotebooks),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { 
        page = 1, 
        limit = 10, 
        search, 
        tags, 
        sortBy = 'updatedAt', 
        sortOrder = 'desc',
        includePublic = false 
      } = req.query;

      const offset = (Number(page) - 1) * Number(limit);
      
      const where: any = {
        OR: [
          { userId },
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

      if (includePublic) {
        where.OR.push({ isPublic: true });
      }

      if (search) {
        where.AND = [
          {
            OR: [
              { title: { contains: search as string, mode: 'insensitive' } },
              { description: { contains: search as string, mode: 'insensitive' } }
            ]
          }
        ];
      }

      if (tags && Array.isArray(tags)) {
        where.tags = {
          hasEvery: tags
        };
      }

      const [notebooks, total] = await Promise.all([
        db.notebook.findMany({
          where,
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
                pages: true,
                collaborators: true
              }
            }
          },
          orderBy: {
            [sortBy as string]: sortOrder
          },
          skip: offset,
          take: Number(limit)
        }),
        db.notebook.count({ where })
      ]);

    return res.json({
        notebooks,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      });
    } catch (error) {
      logger.error('Failed to get notebooks:', error);
    return res.status(500).json({ error: 'Failed to get notebooks' });
    }
  }
);

// Get specific notebook
router.get('/:id',
  authMiddleware,
  generalRateLimit,
  async (req: Request, res: Response) => {
    try {
      const notebookId = req.params["id"];
      const userId = req.user!.id;

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
          pages: {
            select: {
              id: true,
              title: true,
              type: true,
              createdAt: true,
              updatedAt: true,
              parentId: true,
              position: true
            },
            orderBy: {
              position: 'asc'
            }
          },
          collaborators: {
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
            }
          },
          _count: {
            select: {
              pages: true,
              collaborators: true
            }
          }
        }
      });

      if (!notebook) {
        return res.status(404).json({ error: 'Notebook not found' });
      }

    return res.json({ notebook });
    } catch (error) {
      logger.error('Failed to get notebook:', error);
    return res.status(500).json({ error: 'Failed to get notebook' });
    }
  }
);

// Update notebook
router.patch('/:id',
  authMiddleware,
  generalRateLimit,
  verifyOwnership('notebook'),
  validateBody(schemas.updateNotebook),
  async (req: Request, res: Response) => {
    try {
      const notebookId = req.params["id"];
      const { title, description, tags, isPublic, settings } = req.body;

      const notebook = await db.notebook.update({
        where: { id: notebookId },
        data: {
          ...(title && { title }),
          ...(description !== undefined && { description }),
          ...(tags && { tags }),
          ...(isPublic !== undefined && { isPublic }),
          ...(settings && { settings })
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
              pages: true,
              collaborators: true
            }
          }
        }
      });

      logger.info(`Updated notebook ${notebookId}`);
      
    return res.json({
        message: 'Notebook updated successfully',
        notebook
      });
    } catch (error) {
      logger.error('Failed to update notebook:', error);
    return res.status(500).json({ error: 'Failed to update notebook' });
    }
  }
);

// Delete notebook
router.delete('/:id',
  authMiddleware,
  generalRateLimit,
  verifyOwnership('notebook'),
  async (req: Request, res: Response) => {
    try {
      const notebookId = req.params["id"];

      // Delete notebook and all related data (cascading deletes)
      await db.notebook.delete({
        where: { id: notebookId }
      });

      logger.info(`Deleted notebook ${notebookId}`);
      
    return res.json({ message: 'Notebook deleted successfully' });
    } catch (error) {
      logger.error('Failed to delete notebook:', error);
    return res.status(500).json({ error: 'Failed to delete notebook' });
    }
  }
);

// Share notebook
router.post('/:id/share',
  authMiddleware,
  generalRateLimit,
  verifyOwnership('notebook'),
  validateBody(z.object({
    email: z.string().email(),
    role: z.enum(['VIEWER', 'EDITOR', 'ADMIN']).default('VIEWER'),
    message: z.string().optional()
  })),
  async (req: Request, res: Response) => {
    try {
      const notebookId = req.params["id"];
      const { email, role, message } = req.body;
      const ownerId = req.user!.id;

      // Find target user
      const targetUser = await db.user.findUnique({
        where: { email },
        select: { id: true, username: true, email: true }
      });

      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if already shared
      const existingCollaboration = await db.collaboration.findFirst({
        where: {
          notebookId,
          userId: targetUser.id
        }
      });

      if (existingCollaboration) {
        return res.status(409).json({ error: 'Notebook already shared with this user' });
      }

      // Create collaboration
      const collaboration = await db.collaboration.create({
        data: {
          notebookId,
          userId: targetUser.id,
          role,
          status: 'PENDING',
          invitedBy: ownerId,
          message
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              avatar: true,
              email: true
            }
          }
        }
      });

      // TODO: Send invitation email

      logger.info(`Shared notebook ${notebookId} with user ${targetUser.id}`);
      
    return res.status(201).json({
        message: 'Notebook shared successfully',
        collaboration
      });
    } catch (error) {
      logger.error('Failed to share notebook:', error);
    return res.status(500).json({ error: 'Failed to share notebook' });
    }
  }
);

// Update collaboration
router.patch('/:notebookId/collaborators/:userId',
  authMiddleware,
  generalRateLimit,
  verifyOwnership('notebook'),
  validateBody(z.object({
    role: z.enum(['VIEWER', 'EDITOR', 'ADMIN']).optional(),
    status: z.enum(['PENDING', 'ACCEPTED', 'DECLINED']).optional()
  })),
  async (req: Request, res: Response) => {
    try {
      const { notebookId, userId } = req.params;
      const { role, status } = req.body;

      const collaboration = await db.collaboration.update({
        where: {
          notebookId_userId: {
            notebookId,
            userId
          }
        },
        data: {
          ...(role && { role }),
          ...(status && { status })
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              avatar: true,
              email: true
            }
          }
        }
      });

      logger.info(`Updated collaboration for notebook ${notebookId} and user ${userId}`);
      
    return res.json({
        message: 'Collaboration updated successfully',
        collaboration
      });
    } catch (error) {
      logger.error('Failed to update collaboration:', error);
    return res.status(500).json({ error: 'Failed to update collaboration' });
    }
  }
);

// Remove collaborator
router.delete('/:notebookId/collaborators/:userId',
  authMiddleware,
  generalRateLimit,
  verifyOwnership('notebook'),
  async (req: Request, res: Response) => {
    try {
      const { notebookId, userId } = req.params;

      await db.collaboration.delete({
        where: {
          notebookId_userId: {
            notebookId,
            userId
          }
        }
      });

      logger.info(`Removed collaborator ${userId} from notebook ${notebookId}`);
      
    return res.json({ message: 'Collaborator removed successfully' });
    } catch (error) {
      logger.error('Failed to remove collaborator:', error);
    return res.status(500).json({ error: 'Failed to remove collaborator' });
    }
  }
);

// Accept/decline collaboration invitation
router.patch('/collaborations/:id',
  authMiddleware,
  generalRateLimit,
  validateBody(z.object({
    status: z.enum(['ACCEPTED', 'DECLINED'])
  })),
  async (req: Request, res: Response) => {
    try {
      const collaborationId = req.params["id"];
      const { status } = req.body;
      const userId = req.user!.id;

      const collaboration = await db.collaboration.update({
        where: {
          id: collaborationId,
          userId
        },
        data: { status },
        include: {
          notebook: {
            select: {
              id: true,
              title: true,
              description: true
            }
          },
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              avatar: true
            }
          }
        }
      });

      logger.info(`User ${userId} ${status.toLowerCase()} collaboration ${collaborationId}`);
      
    return res.json({
        message: `Collaboration ${status.toLowerCase()} successfully`,
        collaboration
      });
    } catch (error) {
      logger.error('Failed to update collaboration status:', error);
    return res.status(500).json({ error: 'Failed to update collaboration status' });
    }
  }
);

// Get user's collaboration invitations
router.get('/collaborations/invitations',
  authMiddleware,
  generalRateLimit,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;

      const invitations = await db.collaboration.findMany({
        where: {
          userId,
          status: 'PENDING'
        },
        include: {
          notebook: {
            select: {
              id: true,
              title: true,
              description: true,
              user: {
                select: {
                  username: true,
                  firstName: true,
                  lastName: true,
                  avatar: true
                }
              }
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

    return res.json({ invitations });
    } catch (error) {
      logger.error('Failed to get collaboration invitations:', error);
    return res.status(500).json({ error: 'Failed to get collaboration invitations' });
    }
  }
);

export default router;
