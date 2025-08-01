import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '@/middleware/auth';
import { DatabaseService } from '@/services/database';
import { logger } from '@/utils/logger';

const router = Router();
const db = DatabaseService.getInstance();

// Validation schemas
const createNodeSchema = z.object({
  label: z.string().min(1).max(200),
  type: z.enum(['concept', 'person', 'place', 'event', 'document', 'tag', 'custom']),
  properties: z.record(z.any()).optional(),
  description: z.string().max(1000).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  size: z.number().min(10).max(100).default(30),
});

const updateNodeSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  type: z.enum(['concept', 'person', 'place', 'event', 'document', 'tag', 'custom']).optional(),
  properties: z.record(z.any()).optional(),
  description: z.string().max(1000).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  size: z.number().min(10).max(100).optional(),
});

const createRelationshipSchema = z.object({
  fromNodeId: z.string().uuid(),
  toNodeId: z.string().uuid(),
  type: z.enum(['relates_to', 'part_of', 'similar_to', 'opposite_of', 'causes', 'depends_on', 'mentions', 'custom']),
  label: z.string().min(1).max(100).optional(),
  properties: z.record(z.any()).optional(),
  weight: z.number().min(0).max(1).default(0.5),
  bidirectional: z.boolean().default(false),
});

const updateRelationshipSchema = z.object({
  type: z.enum(['relates_to', 'part_of', 'similar_to', 'opposite_of', 'causes', 'depends_on', 'mentions', 'custom']).optional(),
  label: z.string().min(1).max(100).optional(),
  properties: z.record(z.any()).optional(),
  weight: z.number().min(0).max(1).optional(),
  bidirectional: z.boolean().optional(),
});

const queryGraphSchema = z.object({
  nodeTypes: z.array(z.string()).optional(),
  relationshipTypes: z.array(z.string()).optional(),
  search: z.string().optional(),
  maxDepth: z.number().min(1).max(10).default(3),
  maxNodes: z.number().min(1).max(1000).default(100),
  includeProperties: z.boolean().default(false),
});

// GET /api/graph/nodes - Get user's knowledge graph nodes
router.get('/nodes', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query["page"] as string) || 1;
    const limit = Math.min(parseInt(req.query["limit"] as string) || 50, 200);
    const offset = (page - 1) * limit;
    const search = req.query["search"] as string;
    const type = req.query["type"] as string;

    const where: any = { userId };

    if (search) {
      where.OR = [
        { label: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (type) {
      where.type = type;
    }

    const nodes = await db.client.knowledgeNode.findMany({
      where,
      include: {
        _count: {
          select: {
            fromRelationships: true,
            toRelationships: true,
          }
        }
      },
      orderBy: { updatedAt: 'desc' },
      skip: offset,
      take: limit,
    });

    const total = await db.client.knowledgeNode.count({ where });

    return res.json({
      success: true,
      data: {
        nodes,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get knowledge nodes error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get knowledge nodes'
    });
  }
});

// POST /api/graph/nodes - Create knowledge node
router.post('/nodes', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const validatedData = createNodeSchema.parse(req.body);

    // Check for duplicate node by label
    const existingNode = await db.client.knowledgeNode.findFirst({
      where: {
        userId,
        label: validatedData.label,
        type: validatedData.type
      }
    });

    if (existingNode) {
      return res.status(400).json({
        success: false,
        error: 'Node with this label already exists'
      });
    }

    const node = await db.client.knowledgeNode.create({
      data: {
        ...validatedData,
        userId,
      }
    });

    logger.info(`Knowledge node created: ${node.id} by user: ${userId}`);

    return res.json({
      success: true,
      data: node
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }

    logger.error('Create knowledge node error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create knowledge node'
    });
  }
});

// GET /api/graph/nodes/:id - Get knowledge node by ID
router.get('/nodes/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const node = await db.client.knowledgeNode.findFirst({
      where: { id, userId },
      include: {
        fromRelationships: {
          include: {
            toNode: {
              select: { id: true, label: true, type: true, color: true }
            }
          }
        },
        toRelationships: {
          include: {
            fromNode: {
              select: { id: true, label: true, type: true, color: true }
            }
          }
        }
      }
    });

    if (!node) {
      return res.status(404).json({
        success: false,
        error: 'Knowledge node not found'
      });
    }

    return res.json({
      success: true,
      data: node
    });
  } catch (error) {
    logger.error('Get knowledge node error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get knowledge node'
    });
  }
});

// PUT /api/graph/nodes/:id - Update knowledge node
router.put('/nodes/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const validatedData = updateNodeSchema.parse(req.body);

    const existingNode = await db.client.knowledgeNode.findFirst({
      where: { id, userId }
    });

    if (!existingNode) {
      return res.status(404).json({
        success: false,
        error: 'Knowledge node not found'
      });
    }

    // Check for duplicate label if updating
    if (validatedData.label && validatedData.label !== existingNode.label) {
      const duplicateNode = await db.client.knowledgeNode.findFirst({
        where: {
          userId,
          label: validatedData.label,
          type: validatedData.type || existingNode.type,
          NOT: { id }
        }
      });

      if (duplicateNode) {
        return res.status(400).json({
          success: false,
          error: 'Node with this label already exists'
        });
      }
    }

    const updatedNode = await db.client.knowledgeNode.update({
      where: { id },
      data: validatedData,
    });

    logger.info(`Knowledge node updated: ${id}`);

    return res.json({
      success: true,
      data: updatedNode
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }

    logger.error('Update knowledge node error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update knowledge node'
    });
  }
});

// DELETE /api/graph/nodes/:id - Delete knowledge node
router.delete('/nodes/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const node = await db.client.knowledgeNode.findFirst({
      where: { id, userId }
    });

    if (!node) {
      return res.status(404).json({
        success: false,
        error: 'Knowledge node not found'
      });
    }

    // Delete node and all its relationships (CASCADE)
    await db.client.knowledgeNode.delete({
      where: { id }
    });

    logger.info(`Knowledge node deleted: ${id}`);

    return res.json({
      success: true,
      message: 'Knowledge node deleted successfully'
    });
  } catch (error) {
    logger.error('Delete knowledge node error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete knowledge node'
    });
  }
});

// GET /api/graph/relationships - Get relationships
router.get('/relationships', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query["page"] as string) || 1;
    const limit = Math.min(parseInt(req.query["limit"] as string) || 50, 200);
    const offset = (page - 1) * limit;
    const type = req.query["type"] as string;

    const where: any = {
      fromNode: { userId },
      toNode: { userId }
    };

    if (type) {
      where.type = type;
    }

    const relationships = await db.client.knowledgeRelationship.findMany({
      where,
      include: {
        fromNode: {
          select: { id: true, label: true, type: true, color: true }
        },
        toNode: {
          select: { id: true, label: true, type: true, color: true }
        }
      },
      orderBy: { updatedAt: 'desc' },
      skip: offset,
      take: limit,
    });

    const total = await db.client.knowledgeRelationship.count({ where });

    return res.json({
      success: true,
      data: {
        relationships,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get relationships error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get relationships'
    });
  }
});

// POST /api/graph/relationships - Create relationship
router.post('/relationships', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { fromNodeId, toNodeId, type, label, properties, weight, bidirectional } = createRelationshipSchema.parse(req.body);

    // Verify both nodes belong to user
    const fromNode = await db.client.knowledgeNode.findFirst({
      where: { id: fromNodeId, userId }
    });

    const toNode = await db.client.knowledgeNode.findFirst({
      where: { id: toNodeId, userId }
    });

    if (!fromNode || !toNode) {
      return res.status(404).json({
        success: false,
        error: 'One or both nodes not found'
      });
    }

    if (fromNodeId === toNodeId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot create relationship to same node'
      });
    }

    // Check for existing relationship
    const existingRelationship = await db.client.knowledgeRelationship.findFirst({
      where: {
        fromNodeId,
        toNodeId,
        type
      }
    });

    if (existingRelationship) {
      return res.status(400).json({
        success: false,
        error: 'Relationship already exists'
      });
    }

    const relationship = await db.client.knowledgeRelationship.create({
      data: {
        fromNodeId,
        toNodeId,
        type,
        label,
        properties,
        weight,
        bidirectional,
      },
      include: {
        fromNode: {
          select: { id: true, label: true, type: true, color: true }
        },
        toNode: {
          select: { id: true, label: true, type: true, color: true }
        }
      }
    });

    logger.info(`Relationship created: ${relationship.id} between ${fromNodeId} and ${toNodeId}`);

    return res.json({
      success: true,
      data: relationship
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }

    logger.error('Create relationship error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create relationship'
    });
  }
});

// PUT /api/graph/relationships/:id - Update relationship
router.put('/relationships/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const validatedData = updateRelationshipSchema.parse(req.body);

    // Verify relationship belongs to user's nodes
    const relationship = await db.client.knowledgeRelationship.findFirst({
      where: {
        id,
        fromNode: { userId },
        toNode: { userId }
      }
    });

    if (!relationship) {
      return res.status(404).json({
        success: false,
        error: 'Relationship not found'
      });
    }

    const updatedRelationship = await db.client.knowledgeRelationship.update({
      where: { id },
      data: validatedData,
      include: {
        fromNode: {
          select: { id: true, label: true, type: true, color: true }
        },
        toNode: {
          select: { id: true, label: true, type: true, color: true }
        }
      }
    });

    logger.info(`Relationship updated: ${id}`);

    return res.json({
      success: true,
      data: updatedRelationship
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }

    logger.error('Update relationship error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update relationship'
    });
  }
});

// DELETE /api/graph/relationships/:id - Delete relationship
router.delete('/relationships/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    // Verify relationship belongs to user's nodes
    const relationship = await db.client.knowledgeRelationship.findFirst({
      where: {
        id,
        fromNode: { userId },
        toNode: { userId }
      }
    });

    if (!relationship) {
      return res.status(404).json({
        success: false,
        error: 'Relationship not found'
      });
    }

    await db.client.knowledgeRelationship.delete({
      where: { id }
    });

    logger.info(`Relationship deleted: ${id}`);

    return res.json({
      success: true,
      message: 'Relationship deleted successfully'
    });
  } catch (error) {
    logger.error('Delete relationship error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete relationship'
    });
  }
});

// POST /api/graph/query - Query knowledge graph
router.post('/query', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { nodeTypes, relationshipTypes, search, maxDepth, maxNodes, includeProperties } = queryGraphSchema.parse(req.body);

    // Build base query for nodes
    const nodeWhere: any = { userId };

    if (nodeTypes && nodeTypes.length > 0) {
      nodeWhere.type = { in: nodeTypes };
    }

    if (search) {
      nodeWhere.OR = [
        { label: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Get nodes with relationships
    const nodes = await db.client.knowledgeNode.findMany({
      where: nodeWhere,
      include: {
        fromRelationships: {
          where: relationshipTypes && relationshipTypes.length > 0 ? {
            type: { in: relationshipTypes }
          } : undefined,
          include: {
            toNode: {
              select: { 
                id: true, 
                label: true, 
                type: true, 
                color: true,
                ...(includeProperties && { properties: true, description: true })
              }
            }
          }
        },
        toRelationships: {
          where: relationshipTypes && relationshipTypes.length > 0 ? {
            type: { in: relationshipTypes }
          } : undefined,
          include: {
            fromNode: {
              select: { 
                id: true, 
                label: true, 
                type: true, 
                color: true,
                ...(includeProperties && { properties: true, description: true })
              }
            }
          }
        }
      },
      take: maxNodes,
    });

    // Extract all unique relationships
    const relationships = new Map();
    const allNodeIds = new Set();

    nodes.forEach((node: any) => {
      allNodeIds.add(node.id);
      
      node.fromRelationships.forEach((rel: any) => {
        relationships.set(rel.id, {
          id: rel.id,
          type: rel.type,
          label: rel.label,
          weight: rel.weight,
          bidirectional: rel.bidirectional,
          fromNodeId: rel.fromNodeId,
          toNodeId: rel.toNodeId,
          ...(includeProperties && { properties: rel.properties })
        });
        allNodeIds.add(rel.toNodeId);
      });

      node.toRelationships.forEach((rel: any) => {
        relationships.set(rel.id, {
          id: rel.id,
          type: rel.type,
          label: rel.label,
          weight: rel.weight,
          bidirectional: rel.bidirectional,
          fromNodeId: rel.fromNodeId,
          toNodeId: rel.toNodeId,
          ...(includeProperties && { properties: rel.properties })
        });
        allNodeIds.add(rel.fromNodeId);
      });
    });

    // Get any missing nodes referenced in relationships
    const missingNodeIds = Array.from(allNodeIds).filter(
      (id: unknown) => !nodes.find((n: any) => n.id === id)
    );

    const additionalNodes = missingNodeIds.length > 0 ? await db.client.knowledgeNode.findMany({
      where: {
        id: { in: missingNodeIds },
        userId
      },
      select: {
        id: true,
        label: true,
        type: true,
        color: true,
        size: true,
        ...(includeProperties && { properties: true, description: true })
      }
    }) : [];

    // Clean up node data for response
    const cleanedNodes = nodes.map((node: any) => {
      const { fromRelationships, toRelationships, ...cleanNode } = node;
      return cleanNode;
    }).concat(additionalNodes);

    const result = {
      nodes: cleanedNodes,
      relationships: Array.from(relationships.values()),
      metadata: {
        nodeCount: cleanedNodes.length,
        relationshipCount: relationships.size,
        maxDepth,
        maxNodes,
        filters: {
          nodeTypes,
          relationshipTypes,
          search
        }
      }
    };

    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }

    logger.error('Query knowledge graph error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to query knowledge graph'
    });
  }
});

// GET /api/graph/stats - Get knowledge graph statistics
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;

    const [nodeCount, relationshipCount, nodeTypes, relationshipTypes] = await Promise.all([
      db.client.knowledgeNode.count({ where: { userId } }),
      db.client.knowledgeRelationship.count({
        where: {
          fromNode: { userId },
          toNode: { userId }
        }
      }),
      db.client.knowledgeNode.groupBy({
        by: ['type'],
        where: { userId },
        _count: { type: true }
      }),
      db.client.knowledgeRelationship.groupBy({
        by: ['type'],
        where: {
          fromNode: { userId },
          toNode: { userId }
        },
        _count: { type: true }
      })
    ]);

    const stats = {
      totalNodes: nodeCount,
      totalRelationships: relationshipCount,
      nodesByType: nodeTypes.reduce((acc: any, item: any) => {
        acc[item.type] = item._count.type;
        return acc;
      }, {} as Record<string, number>),
      relationshipsByType: relationshipTypes.reduce((acc: any, item: any) => {
        acc[item.type] = item._count.type;
        return acc;
      }, {} as Record<string, number>),
      density: relationshipCount > 0 && nodeCount > 1 
        ? relationshipCount / (nodeCount * (nodeCount - 1)) 
        : 0
    };

    return res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Get graph stats error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get graph statistics'
    });
  }
});

// POST /api/graph/auto-extract - Auto-extract entities from content
router.post('/auto-extract', authMiddleware, async (_req, res) => {
  try {
    // const userId = req.user!.id;
    // const { content, pageId } = z.object({
    //   content: z.string().min(10),
    //   pageId: z.string().uuid().optional()
    // }).parse(req.body);

    // TODO: Implement AI-powered entity extraction
    // This would use NLP services to extract entities, concepts, and relationships

    const extractedEntities = {
      nodes: [],
      relationships: [],
      confidence: 0.0
    };

    return res.json({
      success: true,
      data: extractedEntities,
      message: 'Auto-extraction feature coming soon'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }

    logger.error('Auto-extract entities error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to extract entities'
    });
  }
});

export default router;
