import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '@/middleware/auth';
import { DatabaseService } from '@/services/database';
import { FileStorageService } from '@/services/fileStorage';
import { logger } from '@/utils/logger';
import { upload } from '@/middleware/upload';
import multer from 'multer';

const router = Router();
const db = DatabaseService.getInstance();
const fileStorage = new FileStorageService();

// Configure multer for multiple file uploads
const multipleUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
    files: 50 // Maximum 50 files
  }
});

// Validation schemas
const createUploadSessionSchema = z.object({
  notebookId: z.string().uuid(),
  fileCount: z.number().min(1).max(50),
  totalSize: z.number().min(1).max(500 * 1024 * 1024), // 500MB total
});

const importFromUrlSchema = z.object({
  url: z.string().url(),
  notebookId: z.string().uuid(),
  importType: z.enum(['webpage', 'pdf', 'document', 'auto']).default('auto'),
  title: z.string().min(1).max(200).optional(),
});

const importOneNoteSchema = z.object({
  notebookId: z.string().uuid(),
  oneNoteUrl: z.string().url().optional(),
  exportFormat: z.enum(['pages', 'notebooks']).default('pages'),
});

const bulkImportSchema = z.object({
  notebookId: z.string().uuid(),
  importType: z.enum(['markdown', 'notion', 'obsidian', 'roam']),
  preserveStructure: z.boolean().default(true),
  mergeByTitle: z.boolean().default(false),
});

// POST /api/ingest/upload-session - Create upload session
router.post('/upload-session', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { notebookId, fileCount, totalSize } = createUploadSessionSchema.parse(req.body);

    // Verify notebook access
    const notebook = await db.client.notebook.findFirst({
      where: {
        id: notebookId,
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
    });

    if (!notebook) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to notebook'
      });
    }

    // Create upload session
    const uploadSession = await db.client.uploadSession.create({
      data: {
        id: `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        notebookId,
        fileCount,
        totalSize,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      }
    });

    logger.info(`Upload session created: ${uploadSession.id} for user: ${userId}`);

    return res.json({
      success: true,
      data: uploadSession
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }

    logger.error('Create upload session error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create upload session'
    });
  }
});

// POST /api/ingest/files/:sessionId - Upload files to session
router.post('/files/:sessionId', authMiddleware, multipleUpload.array('files'), async (req, res) => {
  try {
    const userId = req.user!.id;
    const { sessionId } = req.params;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      });
    }

    // Get upload session
    const session = await db.client.uploadSession.findFirst({
      where: {
        id: sessionId,
        userId,
        status: 'PENDING'
      }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Upload session not found or expired'
      });
    }

    const uploadedFiles = [];
    const errors = [];

    for (const file of files) {
      try {
        // Upload file to storage
        const fileUrl = await fileStorage.uploadFile(
          file,
          userId,
          {
            folder: `uploads/${sessionId}`,
            makePublic: false
          }
        );

        // Create file record
        const uploadedFile = await db.client.uploadedFile.create({
          data: {
            sessionId,
            originalName: file.originalname,
            fileName: file.originalname,
            fileUrl,
            mimeType: file.mimetype,
            size: file.size,
            status: 'UPLOADED'
          }
        });

        uploadedFiles.push(uploadedFile);
      } catch (error) {
        logger.error(`Failed to upload file ${file.originalname}:`, error);
        errors.push({
          fileName: file.originalname,
          error: 'Upload failed'
        });
      }
    }

    // Update session status
    const completedFiles = await db.client.uploadedFile.count({
      where: { sessionId }
    });

    if (completedFiles >= session.fileCount) {
      await db.client.uploadSession.update({
        where: { id: sessionId },
        data: { status: 'COMPLETED' }
      });
    }

    logger.info(`Files uploaded to session ${sessionId}: ${uploadedFiles.length} successful, ${errors.length} failed`);

    return res.json({
      success: true,
      data: {
        uploadedFiles,
        errors,
        sessionStatus: completedFiles >= session.fileCount ? 'COMPLETED' : 'PENDING'
      }
    });
  } catch (error) {
    logger.error('Upload files error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to upload files'
    });
  }
});

// POST /api/ingest/process/:sessionId - Process uploaded files
router.post('/process/:sessionId', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { sessionId } = req.params;

    // Get upload session with files
    const session = await db.client.uploadSession.findFirst({
      where: {
        id: sessionId,
        userId,
        status: 'COMPLETED'
      },
      include: {
        files: true,
        notebook: true
      }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Upload session not found or not ready for processing'
      });
    }

    // Update session status
    await db.client.uploadSession.update({
      where: { id: sessionId },
      data: { status: 'PROCESSING' }
    });

    const processedFiles = [];
    const errors = [];

    for (const file of session.files) {
      try {
        let content = '';
        let contentType = 'file';

        // Process different file types
        if (file.mimeType.startsWith('text/')) {
          // Handle text files
          const fileContent = await fileStorage.getFileContent(file.fileUrl);
          content = fileContent.toString();
          contentType = 'text';
        } else if (file.mimeType === 'application/pdf') {
          // Handle PDF files - would integrate with PDF processing service
          content = `[PDF File: ${file.originalName}]`;
          contentType = 'pdf';
        } else if (file.mimeType.startsWith('image/')) {
          // Handle images
          content = `[Image: ${file.originalName}]`;
          contentType = 'image';
        } else if (file.mimeType.includes('document') || file.mimeType.includes('word')) {
          // Handle documents - would integrate with document processing service
          content = `[Document: ${file.originalName}]`;
          contentType = 'document';
        }

        // Create page for each file
        const page = await db.client.page.create({
          data: {
            title: file.originalName.replace(/\.[^/.]+$/, ''), // Remove extension
            content: {
              type: contentType,
              data: content,
              metadata: {
                originalFileName: file.originalName,
                fileUrl: file.fileUrl,
                mimeType: file.mimeType,
                size: file.size,
                uploadedAt: file.createdAt
              }
            },
            contentType: contentType.toUpperCase() as any,
            notebookId: session.notebookId,
            authorId: userId,
            status: 'PUBLISHED'
          }
        });

        // Update file status
        await db.client.uploadedFile.update({
          where: { id: file.id },
          data: { 
            status: 'PROCESSED',
            pageId: page.id
          }
        });

        processedFiles.push({
          file,
          page
        });

        // Log activity
        await db.client.userActivity.create({
          data: {
            userId,
            type: 'FILE_IMPORTED',
            description: `Imported file: ${file.originalName}`,
            notebookId: session.notebookId,
            pageId: page.id,
            metadata: {
              fileName: file.originalName,
              fileType: file.mimeType
            }
          }
        });

      } catch (error) {
        logger.error(`Failed to process file ${file.originalName}:`, error);
        errors.push({
          fileName: file.originalName,
          error: 'Processing failed'
        });

        await db.client.uploadedFile.update({
          where: { id: file.id },
          data: { status: 'FAILED' }
        });
      }
    }

    // Update session status
    await db.client.uploadSession.update({
      where: { id: sessionId },
      data: { 
        status: 'FINISHED',
        processedAt: new Date()
      }
    });

    logger.info(`Session ${sessionId} processed: ${processedFiles.length} successful, ${errors.length} failed`);

    return res.json({
      success: true,
      data: {
        processedFiles: processedFiles.length,
        errors,
        sessionId
      }
    });
  } catch (error) {
    logger.error('Process files error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to process files'
    });
  }
});

// POST /api/ingest/url - Import content from URL
router.post('/url', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { url, notebookId, importType, title } = importFromUrlSchema.parse(req.body);

    // Verify notebook access
    const notebook = await db.client.notebook.findFirst({
      where: {
        id: notebookId,
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
    });

    if (!notebook) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to notebook'
      });
    }

    // TODO: Implement URL content extraction
    // This would integrate with web scraping or browser automation service
    const extractedContent = {
      title: title || `Imported from ${new URL(url).hostname}`,
      content: `Content imported from: ${url}`,
      metadata: {
        originalUrl: url,
        importType,
        importedAt: new Date()
      }
    };

    const page = await db.client.page.create({
      data: {
        title: extractedContent.title,
        content: {
          type: 'webpage',
          data: extractedContent.content,
          metadata: extractedContent.metadata
        },
        contentType: 'WEBPAGE',
        notebookId,
        authorId: userId,
        status: 'PUBLISHED'
      }
    });

    // Log activity
    await db.client.userActivity.create({
      data: {
        userId,
        type: 'URL_IMPORTED',
        description: `Imported from URL: ${url}`,
        notebookId,
        pageId: page.id,
        metadata: { url, importType }
      }
    });

    logger.info(`URL imported: ${url} to page: ${page.id}`);

    return res.json({
      success: true,
      data: page
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }

    logger.error('Import from URL error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to import from URL'
    });
  }
});

// POST /api/ingest/onenote - Import from OneNote
router.post('/onenote', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { notebookId, oneNoteUrl: _oneNoteUrl, exportFormat } = importOneNoteSchema.parse(req.body);

    // Verify notebook access
    const notebook = await db.client.notebook.findFirst({
      where: {
        id: notebookId,
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
    });

    if (!notebook) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to notebook'
      });
    }

    // TODO: Implement OneNote import via Microsoft Graph API
    // This would require OAuth authentication with Microsoft
    
    return res.json({
      success: true,
      message: 'OneNote import feature coming soon',
      data: {
        notebookId,
        exportFormat,
        status: 'pending'
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

    logger.error('OneNote import error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to import from OneNote'
    });
  }
});

// POST /api/ingest/bulk - Bulk import from archive
router.post('/bulk', authMiddleware, upload.single('archive'), async (req, res) => {
  try {
    const userId = req.user!.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No archive file uploaded'
      });
    }

    const { notebookId, importType, preserveStructure: _preserveStructure, mergeByTitle: _mergeByTitle } = bulkImportSchema.parse(req.body);

    // Verify notebook access
    const notebook = await db.client.notebook.findFirst({
      where: {
        id: notebookId,
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
    });

    if (!notebook) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to notebook'
      });
    }

    // TODO: Implement bulk import processing
    // This would extract and process files from zip/tar archives
    // Based on importType (markdown, notion, obsidian, roam)

    return res.json({
      success: true,
      message: 'Bulk import processing started',
      data: {
        notebookId,
        importType,
        fileName: file.originalname,
        size: file.size
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

    logger.error('Bulk import error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to process bulk import'
    });
  }
});

// GET /api/ingest/sessions - Get upload sessions
router.get('/sessions', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query["page"] as string) || 1;
    const limit = Math.min(parseInt(req.query["limit"] as string) || 20, 100);
    const offset = (page - 1) * limit;

    const sessions = await db.client.uploadSession.findMany({
      where: { userId },
      include: {
        notebook: {
          select: { id: true, title: true }
        },
        _count: {
          select: { files: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    });

    const total = await db.client.uploadSession.count({
      where: { userId }
    });

    return res.json({
      success: true,
      data: {
        sessions,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get upload sessions error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get upload sessions'
    });
  }
});

// GET /api/ingest/sessions/:sessionId - Get session details
router.get('/sessions/:sessionId', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { sessionId } = req.params;

    const session = await db.client.uploadSession.findFirst({
      where: {
        id: sessionId,
        userId
      },
      include: {
        files: {
          include: {
            page: {
              select: { id: true, title: true }
            }
          }
        },
        notebook: {
          select: { id: true, title: true }
        }
      }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Upload session not found'
      });
    }

    return res.json({
      success: true,
      data: session
    });
  } catch (error) {
    logger.error('Get session details error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get session details'
    });
  }
});

// DELETE /api/ingest/sessions/:sessionId - Delete upload session
router.delete('/sessions/:sessionId', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { sessionId } = req.params;

    const session = await db.client.uploadSession.findFirst({
      where: {
        id: sessionId,
        userId
      }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Upload session not found'
      });
    }

    // Delete associated files and data
    await db.client.uploadSession.delete({
      where: { id: sessionId }
    });

    logger.info(`Upload session deleted: ${sessionId}`);

    return res.json({
      success: true,
      message: 'Upload session deleted successfully'
    });
  } catch (error) {
    logger.error('Delete upload session error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete upload session'
    });
  }
});

export default router;
