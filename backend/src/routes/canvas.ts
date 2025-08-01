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
const createCanvasSchema = z.object({
  pageId: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  width: z.number().min(100).max(50000).default(2000),
  height: z.number().min(100).max(50000).default(2000),
  backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#ffffff'),
});

const updateCanvasSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  width: z.number().min(100).max(50000).optional(),
  height: z.number().min(100).max(50000).optional(),
  backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

const addElementSchema = z.object({
  type: z.enum(['rectangle', 'circle', 'line', 'arrow', 'text', 'image', 'pen', 'sticky']),
  x: z.number(),
  y: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
  properties: z.object({
    strokeColor: z.string().optional(),
    fillColor: z.string().optional(),
    strokeWidth: z.number().optional(),
    text: z.string().optional(),
    fontSize: z.number().optional(),
    fontFamily: z.string().optional(),
    opacity: z.number().min(0).max(1).optional(),
    rotation: z.number().optional(),
    points: z.array(z.object({
      x: z.number(),
      y: z.number(),
      pressure: z.number().min(0).max(1).optional(),
    })).optional(),
    imageUrl: z.string().url().optional(),
  }),
  zIndex: z.number().default(0),
});

const updateElementSchema = z.object({
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  properties: z.object({
    strokeColor: z.string().optional(),
    fillColor: z.string().optional(),
    strokeWidth: z.number().optional(),
    text: z.string().optional(),
    fontSize: z.number().optional(),
    fontFamily: z.string().optional(),
    opacity: z.number().min(0).max(1).optional(),
    rotation: z.number().optional(),
    points: z.array(z.object({
      x: z.number(),
      y: z.number(),
      pressure: z.number().min(0).max(1).optional(),
    })).optional(),
    imageUrl: z.string().url().optional(),
  }).optional(),
  zIndex: z.number().optional(),
});

const penStrokeSchema = z.object({
  points: z.array(z.object({
    x: z.number(),
    y: z.number(),
    pressure: z.number().min(0).max(1).optional(),
    timestamp: z.number(),
  })).min(1),
  properties: z.object({
    strokeColor: z.string().default('#000000'),
    strokeWidth: z.number().min(1).max(50).default(2),
    opacity: z.number().min(0).max(1).default(1),
    brushType: z.enum(['pen', 'highlighter', 'eraser']).default('pen'),
  }),
});

// GET /api/canvas/:pageId - Get canvas for page
router.get('/:pageId', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { pageId } = req.params;

    if (!pageId) {
      return res.status(400).json({
        success: false,
        error: 'Page ID is required'
      });
    }

    // Verify page access
    const page = await db.client.page.findFirst({
      where: {
        id: pageId,
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

    if (!page) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to page'
      });
    }

    // Get or create canvas
    let canvas = await db.client.canvas.findUnique({
      where: { pageId },
      include: {
        elements: {
          orderBy: { zIndex: 'asc' }
        }
      }
    });

    if (!canvas) {
      canvas = await db.client.canvas.create({
        data: {
          pageId,
          width: 2000,
          height: 2000,
          backgroundColor: '#ffffff',
        },
        include: {
          elements: {
            orderBy: { zIndex: 'asc' }
          }
        }
      });
    }

    return res.json({
      success: true,
      data: canvas
    });
  } catch (error) {
    logger.error('Get canvas error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get canvas'
    });
  }
});

// POST /api/canvas - Create canvas
router.post('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { pageId, title, width, height, backgroundColor } = createCanvasSchema.parse(req.body);

    if (!pageId) {
      return res.status(400).json({
        success: false,
        error: 'Page ID is required'
      });
    }

    // Verify page access and ownership
    const page = await db.client.page.findFirst({
      where: {
        id: pageId,
        OR: [
          { authorId: userId },
          {
            notebook: {
              OR: [
                { ownerId: userId },
                {
                  collaborators: {
                    some: {
                      userId,
                      role: { in: ['EDITOR', 'ADMIN'] }
                    }
                  }
                }
              ]
            }
          }
        ]
      }
    });

    if (!page) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to page'
      });
    }

    // Check if canvas already exists
    const existingCanvas = await db.client.canvas.findUnique({
      where: { pageId }
    });

    if (existingCanvas) {
      return res.status(400).json({
        success: false,
        error: 'Canvas already exists for this page'
      });
    }

    const canvas = await db.client.canvas.create({
      data: {
        pageId,
        title: title || 'Untitled Canvas',
        width,
        height,
        backgroundColor,
      },
      include: {
        elements: true
      }
    });

    logger.info(`Canvas created: ${canvas.id} for page: ${pageId}`);

    return res.json({
      success: true,
      data: canvas
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }

    logger.error('Create canvas error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create canvas'
    });
  }
});

// PUT /api/canvas/:id - Update canvas
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const validatedData = updateCanvasSchema.parse(req.body);

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Canvas ID is required'
      });
    }

    // Verify canvas access
    const canvas = await db.client.canvas.findFirst({
      where: {
        id,
        page: {
          OR: [
            { authorId: userId },
            {
              notebook: {
                OR: [
                  { ownerId: userId },
                  {
                    collaborators: {
                      some: {
                        userId,
                        role: { in: ['EDITOR', 'ADMIN'] }
                      }
                    }
                  }
                ]
              }
            }
          ]
        }
      }
    });

    if (!canvas) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to canvas'
      });
    }    const updatedCanvas = await db.client.canvas.update({
      where: { id },
      data: {
        ...(validatedData.title !== undefined && { title: validatedData.title }),
        ...(validatedData.width !== undefined && { width: validatedData.width }),
        ...(validatedData.height !== undefined && { height: validatedData.height }),
        ...(validatedData.backgroundColor !== undefined && { backgroundColor: validatedData.backgroundColor })
      },
      include: {
        elements: {
          orderBy: { zIndex: 'asc' }
        }
      }
    });

    // Broadcast update to collaborators
    await redis.getPublisher().publish(`canvas:${id}:update`, JSON.stringify({
      type: 'canvas_updated',
      canvasId: id,
      userId,
      data: validatedData,
      timestamp: new Date().toISOString()
    }));

    logger.info(`Canvas updated: ${id}`);

    return res.json({
      success: true,
      data: updatedCanvas
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }

    logger.error('Update canvas error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update canvas'
    });
  }
});

// POST /api/canvas/:id/elements - Add element to canvas
router.post('/:id/elements', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id: canvasId } = req.params;
    const validatedData = addElementSchema.parse(req.body);

    // Verify canvas access
    const canvas = await db.client.canvas.findFirst({
      where: {
        id: canvasId,
        page: {
          OR: [
            { authorId: userId },
            {
              notebook: {
                OR: [
                  { ownerId: userId },
                  {
                    collaborators: {
                      some: {
                        userId,
                        role: { in: ['EDITOR', 'ADMIN'] }
                      }
                    }
                  }
                ]
              }
            }
          ]
        }
      }
    });

    if (!canvas) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to canvas'
      });
    }    const element = await db.client.canvasElement.create({
      data: {
        canvasId,
        type: validatedData.type,
        x: validatedData.x,
        y: validatedData.y,
        width: validatedData.width || 100,
        height: validatedData.height || 100,
        properties: validatedData.properties,
        zIndex: validatedData.zIndex,
      }
    });

    // Broadcast element addition to collaborators
    await redis.getPublisher().publish(`canvas:${canvasId}:update`, JSON.stringify({
      type: 'element_added',
      canvasId,
      userId,
      element,
      timestamp: new Date().toISOString()
    }));

    logger.info(`Element added to canvas: ${canvasId}`);

    return res.json({
      success: true,
      data: element
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }

    logger.error('Add canvas element error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to add element'
    });
  }
});

// PUT /api/canvas/:canvasId/elements/:elementId - Update canvas element
router.put('/:canvasId/elements/:elementId', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { canvasId, elementId } = req.params;
    const validatedData = updateElementSchema.parse(req.body);

    if (!canvasId || !elementId) {
      return res.status(400).json({
        success: false,
        error: 'Canvas ID and Element ID are required'
      });
    }

    // Verify canvas access
    const canvas = await db.client.canvas.findFirst({
      where: {
        id: canvasId,
        page: {
          OR: [
            { authorId: userId },
            {
              notebook: {
                OR: [
                  { ownerId: userId },
                  {
                    collaborators: {
                      some: {
                        userId,
                        role: { in: ['EDITOR', 'ADMIN'] }
                      }
                    }
                  }
                ]
              }
            }
          ]
        }
      }
    });

    if (!canvas) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to canvas'
      });
    }

    const updatedElement = await db.client.canvasElement.update({
      where: { id: elementId },
      data: {
        ...(validatedData.x !== undefined && { x: validatedData.x }),
        ...(validatedData.y !== undefined && { y: validatedData.y }),
        ...(validatedData.width !== undefined && { width: validatedData.width }),
        ...(validatedData.height !== undefined && { height: validatedData.height }),
        ...(validatedData.zIndex !== undefined && { zIndex: validatedData.zIndex }),
        ...(validatedData.properties !== undefined && { properties: validatedData.properties }),
      }
    });

    // Broadcast element update to collaborators
    await redis.getPublisher().publish(`canvas:${canvasId}:update`, JSON.stringify({
      type: 'element_updated',
      canvasId,
      userId,
      element: updatedElement,
      timestamp: new Date().toISOString()
    }));

    return res.json({
      success: true,
      data: updatedElement
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }

    logger.error('Update canvas element error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update element'
    });
  }
});

// DELETE /api/canvas/:canvasId/elements/:elementId - Delete canvas element
router.delete('/:canvasId/elements/:elementId', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { canvasId, elementId } = req.params;

    if (!canvasId || !elementId) {
      return res.status(400).json({
        success: false,
        error: 'Canvas ID and Element ID are required'
      });
    }

    // Verify canvas access
    const canvas = await db.client.canvas.findFirst({
      where: {
        id: canvasId,
        page: {
          OR: [
            { authorId: userId },
            {
              notebook: {
                OR: [
                  { ownerId: userId },
                  {
                    collaborators: {
                      some: {
                        userId,
                        role: { in: ['EDITOR', 'ADMIN'] }
                      }
                    }
                  }
                ]
              }
            }
          ]
        }
      }
    });

    if (!canvas) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to canvas'
      });
    }

    await db.client.canvasElement.delete({
      where: { id: elementId }
    });

    // Broadcast element deletion to collaborators
    await redis.getPublisher().publish(`canvas:${canvasId}:update`, JSON.stringify({
      type: 'element_deleted',
      canvasId,
      userId,
      elementId,
      timestamp: new Date().toISOString()
    }));

    logger.info(`Element deleted from canvas: ${canvasId}`);

    return res.json({
      success: true,
      message: 'Element deleted successfully'
    });
  } catch (error) {
    logger.error('Delete canvas element error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete element'
    });
  }
});

// POST /api/canvas/:id/pen-stroke - Add pen stroke
router.post('/:id/pen-stroke', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id: canvasId } = req.params;
    const { points, properties } = penStrokeSchema.parse(req.body);

    // Verify canvas access
    const canvas = await db.client.canvas.findFirst({
      where: {
        id: canvasId,
        page: {
          OR: [
            { authorId: userId },
            {
              notebook: {
                OR: [
                  { ownerId: userId },
                  {
                    collaborators: {
                      some: {
                        userId,
                        role: { in: ['EDITOR', 'ADMIN'] }
                      }
                    }
                  }
                ]
              }
            }
          ]
        }
      }
    });

    if (!canvas) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to canvas'
      });
    }

    // Calculate bounding box for the stroke
    const minX = Math.min(...points.map(p => p.x));
    const maxX = Math.max(...points.map(p => p.x));
    const minY = Math.min(...points.map(p => p.y));
    const maxY = Math.max(...points.map(p => p.y));

    const element = await db.client.canvasElement.create({
      data: {
        canvasId,
        type: 'pen',
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        properties: {
          ...properties,
          points
        },
        zIndex: 0,
        createdBy: userId,
      }
    });

    // Broadcast pen stroke to collaborators
    await redis.getPublisher().publish(`canvas:${canvasId}:update`, JSON.stringify({
      type: 'pen_stroke_added',
      canvasId,
      userId,
      element,
      timestamp: new Date().toISOString()
    }));

    return res.json({
      success: true,
      data: element
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }

    logger.error('Add pen stroke error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to add pen stroke'
    });
  }
});

// GET /api/canvas/:id/export - Export canvas
router.get('/:id/export', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const format = req.query["format"] as string || 'json';

    // Verify canvas access
    const canvas = await db.client.canvas.findFirst({
      where: {
        id,
        page: {
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
      },
      include: {
        elements: {
          orderBy: { zIndex: 'asc' }
        }
      }
    });

    if (!canvas) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to canvas'
      });
    }

    if (format === 'json') {
    return res.json({
        success: true,
        data: canvas
      });
    } else if (format === 'svg') {
      // TODO: Implement SVG export
    return res.status(501).json({
        success: false,
        error: 'SVG export not yet implemented'
      });
    } else if (format === 'png') {
      // TODO: Implement PNG export
    return res.status(501).json({
        success: false,
        error: 'PNG export not yet implemented'
      });
    } else {
    return res.status(400).json({
        success: false,
        error: 'Unsupported export format'
      });
    }
  } catch (error) {
    logger.error('Export canvas error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to export canvas'
    });
  }
});

// POST /api/canvas/:id/clear - Clear canvas
router.post('/:id/clear', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id: canvasId } = req.params;

    if (!canvasId) {
      return res.status(400).json({
        success: false,
        error: 'Canvas ID is required'
      });
    }

    // Verify canvas access
    const canvas = await db.client.canvas.findFirst({
      where: {
        id: canvasId,
        page: {
          OR: [
            { authorId: userId },
            {
              notebook: {
                OR: [
                  { ownerId: userId },
                  {
                    collaborators: {
                      some: {
                        userId,
                        role: { in: ['EDITOR', 'ADMIN'] }
                      }
                    }
                  }
                ]
              }
            }
          ]
        }
      }
    });

    if (!canvas) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to canvas'
      });
    }

    // Delete all elements
    await db.client.canvasElement.deleteMany({
      where: { canvasId }
    });

    // Broadcast canvas clear to collaborators
    await redis.getPublisher().publish(`canvas:${canvasId}:update`, JSON.stringify({
      type: 'canvas_cleared',
      canvasId,
      userId,
      timestamp: new Date().toISOString()
    }));

    logger.info(`Canvas cleared: ${canvasId}`);

    return res.json({
      success: true,
      message: 'Canvas cleared successfully'
    });
  } catch (error) {
    logger.error('Clear canvas error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to clear canvas'
    });
  }
});

export default router;
