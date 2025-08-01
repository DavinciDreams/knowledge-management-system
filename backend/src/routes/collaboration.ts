import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '@/middleware/auth';
import { DatabaseService } from '@/services/database';
import { RedisService } from '@/services/redis';
import { logger } from '@/utils/logger';

const router = Router();
const db = DatabaseService.getInstance();
const redis = RedisService.getInstance();

// Validation schemas
const joinSessionSchema = z.object({
  resourceId: z.string().uuid(),
  resourceType: z.enum(['notebook', 'page', 'canvas']),
});

const leaveSessionSchema = z.object({
  sessionId: z.string(),
});

const sendCursorSchema = z.object({
  sessionId: z.string(),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  selection: z.object({
    start: z.number(),
    end: z.number(),
  }).optional(),
});

const sendOperationSchema = z.object({
  sessionId: z.string(),
  operation: z.object({
    type: z.enum(['insert', 'delete', 'retain', 'format']),
    position: z.number(),
    content: z.string().optional(),
    attributes: z.record(z.any()).optional(),
    length: z.number().optional(),
  }),
});

const shareResourceSchema = z.object({
  resourceId: z.string().uuid(),
  resourceType: z.enum(['notebook', 'page', 'canvas']),
  emails: z.array(z.string().email()).min(1).max(10),
  role: z.enum(['VIEWER', 'EDITOR', 'ADMIN']).default('EDITOR'),
  message: z.string().max(500).optional(),
});

// GET /api/collaboration/sessions - Get active collaboration sessions
router.get('/sessions', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    
    // Get active sessions from Redis
    const sessionKeys = await redis.getClient().keys(`collaboration:session:*`);
    const sessions = [];

    for (const key of sessionKeys) {
      const sessionData = await redis.getClient().get(key);
      if (sessionData) {
        const session = JSON.parse(sessionData);
        if (session.participants.some((p: any) => p.userId === userId)) {
          sessions.push(session);
        }
      }
    }

    return res.json({
      success: true,
      data: sessions
    });
  } catch (error) {
    logger.error('Get collaboration sessions error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get collaboration sessions'
    });
  }
});

// POST /api/collaboration/sessions/join - Join a collaboration session
router.post('/sessions/join', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { resourceId, resourceType } = joinSessionSchema.parse(req.body);

    // Check if user has access to the resource
    let hasAccess = false;
    
    if (resourceType === 'notebook') {
      const notebook = await db.client.notebook.findFirst({
        where: {
          id: resourceId,
          OR: [
            { ownerId: userId },
            { 
              collaborators: {
                some: { userId }
              }
            },
            { visibility: 'PUBLIC' }
          ]
        }
      });
      hasAccess = !!notebook;
    } else if (resourceType === 'page') {
      const page = await db.client.page.findFirst({
        where: {
          id: resourceId,
          OR: [
            { authorId: userId },
            {
              notebook: {
                OR: [
                  { ownerId: userId },
                  { 
                    collaborators: {
                      some: { userId }
                    }
                  },
                  { visibility: 'PUBLIC' }
                ]
              }
            }
          ]
        }
      });
      hasAccess = !!page;
    }

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to resource'
      });
    }

    // Create or join session
    const sessionId = `${resourceType}:${resourceId}`;
    const sessionKey = `collaboration:session:${sessionId}`;
    
    let session = await redis.getClient().get(sessionKey);
    let sessionData;

    if (session) {
      sessionData = JSON.parse(session);
      
      // Add user to participants if not already present
      if (!sessionData.participants.some((p: any) => p.userId === userId)) {
        sessionData.participants.push({
          userId,
          joinedAt: new Date().toISOString(),
          cursor: { x: 0, y: 0 },
          selection: null
        });
      }
    } else {
      // Create new session
      sessionData = {
        id: sessionId,
        resourceId,
        resourceType,
        createdAt: new Date().toISOString(),
        participants: [{
          userId,
          joinedAt: new Date().toISOString(),
          cursor: { x: 0, y: 0 },
          selection: null
        }],
        operations: []
      };
    }

    // Save session to Redis with TTL
    await redis.getClient().setex(sessionKey, 3600, JSON.stringify(sessionData));

    // Get user info for the response
    const user = await db.client.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        avatar: true
      }
    });

    logger.info(`User ${userId} joined collaboration session: ${sessionId}`);

    return res.json({
      success: true,
      data: {
        sessionId,
        user,
        participants: sessionData.participants.length
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }

    logger.error('Join collaboration session error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to join collaboration session'
    });
  }
});

// POST /api/collaboration/sessions/leave - Leave a collaboration session
router.post('/sessions/leave', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { sessionId } = leaveSessionSchema.parse(req.body);

    const sessionKey = `collaboration:session:${sessionId}`;
    const session = await redis.getClient().get(sessionKey);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    const sessionData = JSON.parse(session);
    
    // Remove user from participants
    sessionData.participants = sessionData.participants.filter(
      (p: any) => p.userId !== userId
    );

    if (sessionData.participants.length === 0) {
      // Delete session if no participants left
      await redis.getClient().del(sessionKey);
    } else {
      // Update session
      await redis.getClient().setex(sessionKey, 3600, JSON.stringify(sessionData));
    }

    logger.info(`User ${userId} left collaboration session: ${sessionId}`);

    return res.json({
      success: true,
      message: 'Left session successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }

    logger.error('Leave collaboration session error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to leave collaboration session'
    });
  }
});

// GET /api/collaboration/sessions/:sessionId - Get session details
router.get('/sessions/:sessionId', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { sessionId } = req.params;

    const sessionKey = `collaboration:session:${sessionId}`;
    const session = await redis.getClient().get(sessionKey);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    const sessionData = JSON.parse(session);
    
    // Check if user is participant
    const isParticipant = sessionData.participants.some(
      (p: any) => p.userId === userId
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to session'
      });
    }

    // Get participant user info
    const participantIds = sessionData.participants.map((p: any) => p.userId);
    const users = await db.client.user.findMany({
      where: { id: { in: participantIds } },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        avatar: true
      }
    });

    const participantsWithInfo = sessionData.participants.map((p: any) => ({
      ...p,
      user: users.find((u: any) => u.id === p.userId)
    }));

    return res.json({
      success: true,
      data: {
        ...sessionData,
        participants: participantsWithInfo
      }
    });
  } catch (error) {
    logger.error('Get session details error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get session details'
    });
  }
});

// POST /api/collaboration/cursor - Update cursor position
router.post('/cursor', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { sessionId, position, selection } = sendCursorSchema.parse(req.body);

    const sessionKey = `collaboration:session:${sessionId}`;
    const session = await redis.getClient().get(sessionKey);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    const sessionData = JSON.parse(session);
    
    // Update user's cursor position
    const participant = sessionData.participants.find((p: any) => p.userId === userId);
    if (participant) {
      participant.cursor = position;
      participant.selection = selection || null;
      participant.lastActive = new Date().toISOString();

      // Save updated session
      await redis.getClient().setex(sessionKey, 3600, JSON.stringify(sessionData));

      // Broadcast cursor update to other participants
      // This would be handled by WebSocket in a real implementation
      await redis.getClient().publish(`session:${sessionId}:cursor`, JSON.stringify({
        userId,
        position,
        selection,
        timestamp: new Date().toISOString()
      }));
    }

    return res.json({
      success: true,
      message: 'Cursor position updated'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }

    logger.error('Update cursor position error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update cursor position'
    });
  }
});

// POST /api/collaboration/operation - Send collaborative operation
router.post('/operation', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { sessionId, operation } = sendOperationSchema.parse(req.body);

    const sessionKey = `collaboration:session:${sessionId}`;
    const session = await redis.getClient().get(sessionKey);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    const sessionData = JSON.parse(session);
    
    // Add operation to session
    const operationWithMetadata = {
      ...operation,
      id: `${Date.now()}-${userId}`,
      userId,
      timestamp: new Date().toISOString()
    };

    sessionData.operations.push(operationWithMetadata);

    // Keep only last 1000 operations
    if (sessionData.operations.length > 1000) {
      sessionData.operations = sessionData.operations.slice(-1000);
    }

    // Save updated session
    await redis.getClient().setex(sessionKey, 3600, JSON.stringify(sessionData));

    // Broadcast operation to other participants
    await redis.getClient().publish(`session:${sessionId}:operation`, JSON.stringify(operationWithMetadata));

    return res.json({
      success: true,
      data: operationWithMetadata
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }

    logger.error('Send operation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to send operation'
    });
  }
});

// POST /api/collaboration/share - Share resource for collaboration
router.post('/share', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { resourceId, resourceType, emails, role } = shareResourceSchema.parse(req.body);

    // Verify ownership of resource
    let isOwner = false;
    
    if (resourceType === 'notebook') {
      const notebook = await db.client.notebook.findFirst({
        where: { id: resourceId, ownerId: userId }
      });
      isOwner = !!notebook;
    } else if (resourceType === 'page') {
      const page = await db.client.page.findFirst({
        where: { 
          id: resourceId,
          OR: [
            { authorId: userId },
            {
              notebook: { ownerId: userId }
            }
          ]
        }
      });
      isOwner = !!page;
    }

    if (!isOwner) {
      return res.status(403).json({
        success: false,
        error: 'Only resource owners can share'
      });
    }

    // Find users by email
    const users = await db.client.user.findMany({
      where: { email: { in: emails } },
      select: { id: true, email: true, username: true, firstName: true, lastName: true }
    });

    const foundEmails = users.map((u: any) => u.email);
    const notFoundEmails = emails.filter(e => !foundEmails.includes(e));

    // Create collaborations for found users
    const collaborations = [];
    
    if (resourceType === 'notebook') {
      for (const user of users) {
        try {
          const collaboration = await db.client.notebookCollaborator.create({
            data: {
              notebookId: resourceId,
              userId: user.id,
              role,
              invitedBy: userId,
            },
            include: {
              user: {
                select: { id: true, email: true, username: true, firstName: true, lastName: true }
              }
            }
          });
          collaborations.push(collaboration);
        } catch (error) {
          // Handle duplicate collaboration (user already has access)
          logger.warn(`User ${user.email} already has access to notebook ${resourceId}`);
        }
      }
    }

    // TODO: Send invitation emails for notFoundEmails
    // TODO: Send notification emails for existing users

    logger.info(`Resource shared: ${resourceType}:${resourceId} with ${emails.join(', ')}`);

    return res.json({
      success: true,
      data: {
        collaborations,
        invited: foundEmails,
        notFound: notFoundEmails
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }

    logger.error('Share resource error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to share resource'
    });
  }
});

// GET /api/collaboration/history/:resourceId - Get collaboration history
router.get('/history/:resourceId', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { resourceId } = req.params;
    const resourceType = req.query["type"] as string;

    if (!resourceType || !['notebook', 'page', 'canvas'].includes(resourceType)) {
      return res.status(400).json({
        success: false,
        error: 'Valid resource type is required'
      });
    }

    // Check access to resource
    let hasAccess = false;
    
    if (resourceType === 'notebook') {
      const notebook = await db.client.notebook.findFirst({
        where: {
          id: resourceId,
          OR: [
            { ownerId: userId },
            { 
              collaborators: {
                some: { userId }
              }
            }
          ]
        }
      });
      hasAccess = !!notebook;
    } else if (resourceType === 'page') {
      const page = await db.client.page.findFirst({
        where: {
          id: resourceId,
          OR: [
            { authorId: userId },
            {
              notebook: {
                OR: [
                  { ownerId: userId },
                  { 
                    collaborators: {
                      some: { userId }
                    }
                  }
                ]
              }
            }
          ]
        }
      });
      hasAccess = !!page;
    }

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to resource'
      });
    }

    // Get session history from Redis
    const sessionId = `${resourceType}:${resourceId}`;
    const sessionKey = `collaboration:session:${sessionId}`;
    const session = await redis.getClient().get(sessionKey);

    let operations = [];
    if (session) {
      const sessionData = JSON.parse(session);
      operations = sessionData.operations || [];
    }

    return res.json({
      success: true,
      data: {
        resourceId,
        resourceType,
        operations
      }
    });
  } catch (error) {
    logger.error('Get collaboration history error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get collaboration history'
    });
  }
});

export default router;
