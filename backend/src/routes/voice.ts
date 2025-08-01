import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '@/middleware/auth';
import { DatabaseService } from '@/services/database';
import { FileStorageService } from '@/services/fileStorage';
import { AIServiceClient } from '@/services/aiService';
import { logger } from '@/utils/logger';
import { upload } from '@/middleware/upload';

const router = Router();
const db = DatabaseService.getInstance();
const fileStorage = new FileStorageService();
const aiService = new AIServiceClient();

// Validation schemas
const createVoiceNoteSchema = z.object({
  notebookId: z.string().uuid(),
  pageId: z.string().uuid().optional(),
  title: z.string().min(1).max(200).optional(),
  duration: z.number().min(0.1).max(3600), // 1 hour max
  autoTranscribe: z.boolean().default(true),
});

const updateVoiceNoteSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  transcription: z.string().optional(),
  summary: z.string().max(1000).optional(),
  keywords: z.array(z.string()).optional(),
  isPublic: z.boolean().optional(),
});

// const voiceCommandSchema = z.object({
//   command: z.string().min(1),
//   context: z.object({
//     notebookId: z.string().uuid().optional(),
//     pageId: z.string().uuid().optional(),
//     selection: z.string().optional(),
//   }).optional(),
// });

// POST /api/voice/upload - Upload voice recording
router.post('/upload', authMiddleware, upload.single('audio'), async (req, res) => {
  try {
    const userId = req.user!.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No audio file uploaded'
      });
    }

    // Validate audio file type
    if (!file.mimetype.startsWith('audio/')) {
      return res.status(400).json({
        success: false,
        error: 'File must be an audio file'
      });
    }

    const { notebookId, pageId, title, duration, autoTranscribe = true } = createVoiceNoteSchema.parse(req.body);

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

    // If pageId provided, verify page access
    if (pageId) {
      const page = await db.client.page.findFirst({
        where: {
          id: pageId,
          notebookId
        }
      });

      if (!page) {
        return res.status(404).json({
          success: false,
          error: 'Page not found'
        });
      }
    }

    // Upload audio file
    const audioUrl = await fileStorage.uploadFile(
      file,
      userId,
      {
        folder: 'voice',
        makePublic: false
      }
    );

    // Create voice note record
    const voiceNote = await db.client.voiceNote.create({
      data: {
        title: title || `Voice Note ${new Date().toLocaleDateString()}`,
        audioUrl,
        duration,
        fileSize: file.size,
        mimeType: file.mimetype,
        notebookId,
        pageId,
        userId,
        status: 'PROCESSING'
      }
    });

    // Process with AI service
    let transcriptionResult = null;
    let entities = null;
    
    if (autoTranscribe) {
      try {
        // Transcribe audio using AI service
        transcriptionResult = await aiService.transcribeAudio(
          file.buffer, 
          file.originalname,
          { wordTimestamps: true }
        );

        // Extract entities for calendar integration
        if (transcriptionResult.text) {
          entities = await aiService.extractEntities(transcriptionResult.text);
        }

        // Update voice note with transcription
        await db.client.voiceNote.update({
          where: { id: voiceNote.id },
          data: {
            transcription: transcriptionResult.text,
            confidence: transcriptionResult.confidence,
            language: transcriptionResult.language,
            status: 'COMPLETED',
            metadata: {
              segments: transcriptionResult.segments,
              wordTimestamps: transcriptionResult.word_timestamps,
              entities: entities || []
            }
          }
        });

        // Ingest voice note into vector database for semantic search
        await aiService.ingestVoiceNote(
          file.buffer,
          file.originalname,
          {
            title: voiceNote.title,
            transcribe: false // Already transcribed
          }
        );

        logger.info(`Voice note transcribed: ${voiceNote.id}`);
      } catch (transcriptionError) {
        logger.error('Transcription failed:', transcriptionError);
        // Update status to failed but still return the voice note
        await db.client.voiceNote.update({
          where: { id: voiceNote.id },
          data: { status: 'FAILED' }
        });
      }
    }

    logger.info(`Voice note uploaded: ${voiceNote.id} by user: ${userId}`);

    return res.json({
      success: true,
      data: {
        ...voiceNote,
        transcription: transcriptionResult?.text,
        confidence: transcriptionResult?.confidence,
        language: transcriptionResult?.language,
        entities
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

    logger.error('Upload voice note error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to upload voice note'
    });
  }
});

// GET /api/voice/notes - Get user's voice notes
router.get('/notes', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query["page"] as string) || 1;
    const limit = Math.min(parseInt(req.query["limit"] as string) || 20, 100);
    const offset = (page - 1) * limit;
    const notebookId = req.query["notebookId"] as string;
    const status = req.query["status"] as string;

    const where: any = { userId };

    if (notebookId) {
      where.notebookId = notebookId;
    }

    if (status) {
      where.status = status;
    }

    const voiceNotes = await db.client.voiceNote.findMany({
      where,
      include: {
        notebook: {
          select: { id: true, title: true }
        },
        page: {
          select: { id: true, title: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    });

    const total = await db.client.voiceNote.count({ where });

    return res.json({
      success: true,
      data: {
        voiceNotes,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get voice notes error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get voice notes'
    });
  }
});

// GET /api/voice/notes/:id - Get voice note by ID
router.get('/notes/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const voiceNote = await db.client.voiceNote.findFirst({
      where: { id, userId },
      include: {
        notebook: {
          select: { id: true, title: true }
        },
        page: {
          select: { id: true, title: true }
        }
      }
    });

    if (!voiceNote) {
      return res.status(404).json({
        success: false,
        error: 'Voice note not found'
      });
    }

    return res.json({
      success: true,
      data: voiceNote
    });
  } catch (error) {
    logger.error('Get voice note error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get voice note'
    });
  }
});

// PUT /api/voice/notes/:id - Update voice note
router.put('/notes/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const validatedData = updateVoiceNoteSchema.parse(req.body);

    const existingNote = await db.client.voiceNote.findFirst({
      where: { id, userId }
    });

    if (!existingNote) {
      return res.status(404).json({
        success: false,
        error: 'Voice note not found'
      });
    }

    const updatedNote = await db.client.voiceNote.update({
      where: { id },
      data: validatedData,
      include: {
        notebook: {
          select: { id: true, title: true }
        },
        page: {
          select: { id: true, title: true }
        }
      }
    });

    logger.info(`Voice note updated: ${id}`);

    return res.json({
      success: true,
      data: updatedNote
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }

    logger.error('Update voice note error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update voice note'
    });
  }
});

// DELETE /api/voice/notes/:id - Delete voice note
router.delete('/notes/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const voiceNote = await db.client.voiceNote.findFirst({
      where: { id, userId }
    });

    if (!voiceNote) {
      return res.status(404).json({
        success: false,
        error: 'Voice note not found'
      });
    }

    // Delete from storage
    // TODO: Implement file deletion from storage

    // Delete from database
    await db.client.voiceNote.delete({
      where: { id }
    });

    logger.info(`Voice note deleted: ${id}`);

    return res.json({
      success: true,
      message: 'Voice note deleted successfully'
    });
  } catch (error) {
    logger.error('Delete voice note error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete voice note'
    });
  }
});

// POST /api/voice/transcribe/:id - Manually trigger transcription
router.post('/transcribe/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const voiceNote = await db.client.voiceNote.findFirst({
      where: { id, userId }
    });

    if (!voiceNote) {
      return res.status(404).json({
        success: false,
        error: 'Voice note not found'
      });
    }

    if (voiceNote.status === 'PROCESSING') {
      return res.status(400).json({
        success: false,
        error: 'Transcription already in progress'
      });
    }

    // Update status to processing
    await db.client.voiceNote.update({
      where: { id },
      data: { status: 'PROCESSING' }
    });

    try {
      // Download audio file for processing
      const audioBuffer = await fileStorage.downloadFile(voiceNote.audioUrl);
      
      // Transcribe using AI service
      const transcriptionResult = await aiService.transcribeAudio(
        audioBuffer,
        `voice-note-${id}`,
        { wordTimestamps: true }
      );

      // Extract entities
      const entities = await aiService.extractEntities(transcriptionResult.text);

      // Update voice note with results
      const updatedNote = await db.client.voiceNote.update({
        where: { id },
        data: {
          transcription: transcriptionResult.text,
          confidence: transcriptionResult.confidence,
          language: transcriptionResult.language,
          status: 'COMPLETED',
          metadata: {
            segments: transcriptionResult.segments,
            wordTimestamps: transcriptionResult.word_timestamps,
            entities
          }
        }
      });

      logger.info(`Voice note transcribed: ${id}`);

      return res.json({
        success: true,
        data: {
          transcription: transcriptionResult.text,
          confidence: transcriptionResult.confidence,
          language: transcriptionResult.language,
          entities
        }
      });
    } catch (transcriptionError) {
      logger.error('Transcription failed:', transcriptionError);
      
      // Update status to failed
      await db.client.voiceNote.update({
        where: { id },
        data: { status: 'FAILED' }
      });

      return res.status(500).json({
        success: false,
        error: 'Transcription failed'
      });
    }
  } catch (error) {
    logger.error('Trigger transcription error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to trigger transcription'
    });
  }
});

// POST /api/voice/transcribe - Real-time transcription
router.post('/transcribe', authMiddleware, upload.single('audio'), async (req, res) => {
  try {
    const userId = req.user!.id;
    const file = req.file;
    const { language, task = 'transcribe', wordTimestamps = true } = req.body;

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No audio file uploaded'
      });
    }

    // Validate audio file type
    if (!file.mimetype.startsWith('audio/')) {
      return res.status(400).json({
        success: false,
        error: 'File must be an audio file'
      });
    }

    try {
      // Transcribe using AI service
      const transcriptionResult = await aiService.transcribeAudio(
        file.buffer,
        file.originalname,
        { 
          language,
          task: task as 'transcribe' | 'translate',
          wordTimestamps: Boolean(wordTimestamps)
        }
      );

      logger.info(`Real-time transcription completed for user: ${userId}`);

      return res.json({
        success: true,
        data: transcriptionResult
      });
    } catch (aiError) {
      logger.error('Transcription failed:', aiError);
      return res.status(500).json({
        success: false,
        error: 'Transcription failed'
      });
    }
  } catch (error) {
    logger.error('Real-time transcription error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to process transcription'
    });
  }
});

// POST /api/voice/detect-language - Detect language from audio
router.post('/detect-language', authMiddleware, upload.single('audio'), async (req, res) => {
  try {
    const userId = req.user!.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No audio file uploaded'
      });
    }

    // Validate audio file type
    if (!file.mimetype.startsWith('audio/')) {
      return res.status(400).json({
        success: false,
        error: 'File must be an audio file'
      });
    }

    try {
      // Use transcription service to detect language
      const transcriptionResult = await aiService.transcribeAudio(
        file.buffer,
        file.originalname,
        { wordTimestamps: false }
      );

      return res.json({
        success: true,
        data: {
          language: transcriptionResult.language,
          confidence: transcriptionResult.confidence
        }
      });
    } catch (aiError) {
      logger.error('Language detection failed:', aiError);
      return res.status(500).json({
        success: false,
        error: 'Language detection failed'
      });
    }
  } catch (error) {
    logger.error('Language detection error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to detect language'
    });
  }
});

// GET /api/voice/supported-languages - Get supported languages
router.get('/supported-languages', async (req, res) => {
  try {
    // This would come from the AI service configuration
    const supportedLanguages = [
      { code: 'en', name: 'English', nativeName: 'English' },
      { code: 'es', name: 'Spanish', nativeName: 'Español' },
      { code: 'fr', name: 'French', nativeName: 'Français' },
      { code: 'de', name: 'German', nativeName: 'Deutsch' },
      { code: 'it', name: 'Italian', nativeName: 'Italiano' },
      { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
      { code: 'ru', name: 'Russian', nativeName: 'Русский' },
      { code: 'ja', name: 'Japanese', nativeName: '日本語' },
      { code: 'ko', name: 'Korean', nativeName: '한국어' },
      { code: 'zh', name: 'Chinese', nativeName: '中文' }
    ];

    return res.json({
      success: true,
      data: supportedLanguages
    });
  } catch (error) {
    logger.error('Get supported languages error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get supported languages'
    });
  }
});

// POST /api/voice/command - Process voice command
router.post('/command', authMiddleware, upload.single('audio'), async (req, res) => {
  try {
    const userId = req.user!.id;
    const file = req.file;
    const { context } = req.body;

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No audio file uploaded'
      });
    }

    // Validate audio file type
    if (!file.mimetype.startsWith('audio/')) {
      return res.status(400).json({
        success: false,
        error: 'File must be an audio file'
      });
    }

    try {
      // Transcribe audio
      const transcriptionResult = await aiService.transcribeAudio(
        file.buffer,
        file.originalname,
        { wordTimestamps: false }
      );

      // Process voice command
      const commandText = transcriptionResult.text.toLowerCase().trim();
      let actionResult = null;

      // Simple command parsing - could be expanded with more sophisticated NLP
      if (commandText.includes('create note') || commandText.includes('new note')) {
        const title = commandText.replace(/(create|new) note/i, '').trim() || 'Voice Note';
        actionResult = {
          type: 'create_note',
          title,
          notebookId: context?.notebookId
        };
      } else if (commandText.includes('search') || commandText.includes('find')) {
        const query = commandText.replace(/(search|find)/i, '').trim();
        actionResult = {
          type: 'search',
          query,
          context: context
        };
      } else if (commandText.includes('open') || commandText.includes('navigate')) {
        const target = commandText.replace(/(open|navigate)/i, '').trim();
        actionResult = {
          type: 'navigate',
          target,
          context: context
        };
      }

      // Extract action items if this is a command with tasks
      const actionItems = await aiService.extractActionItems(transcriptionResult.text);

      const response = {
        transcript: transcriptionResult.text,
        confidence: transcriptionResult.confidence,
        language: transcriptionResult.language,
        command: commandText,
        action: actionResult,
        actionItems,
        executed: false // Commands would be executed by frontend
      };

      logger.info(`Voice command processed for user: ${userId}`);

      return res.json({
        success: true,
        data: response
      });
    } catch (aiError) {
      logger.error('AI processing failed:', aiError);
      return res.status(500).json({
        success: false,
        error: 'Failed to process voice command'
      });
    }
  } catch (error) {
    logger.error('Process voice command error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to process voice command'
    });
  }
});

// POST /api/voice/text-to-speech - Convert text to speech
router.post('/text-to-speech', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { text, voice, speed, pitch } = z.object({
      text: z.string().min(1).max(5000),
      voice: z.string().default('default'),
      speed: z.number().min(0.5).max(2).default(1),
      pitch: z.number().min(0.5).max(2).default(1),
    }).parse(req.body);

    // TODO: Implement text-to-speech
    // This would integrate with TTS service (Google TTS, Azure Speech, etc.)

    const mockAudioUrl = 'https://example.com/generated-audio.mp3';

    logger.info(`Text-to-speech requested by user: ${userId}`);

    return res.json({
      success: true,
      data: {
        audioUrl: mockAudioUrl,
        duration: Math.ceil(text.length / 150), // Approximate duration
        voice,
        speed,
        pitch
      },
      message: 'Text-to-speech feature coming soon'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }

    logger.error('Text-to-speech error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate speech'
    });
  }
});

// GET /api/voice/settings - Get voice settings
router.get('/settings', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;

    // Get user settings
    const user = await db.client.user.findUnique({
      where: { id: userId },
      select: { settings: true }
    });

    const voiceSettings = user?.settings?.voice || {
      autoTranscribe: true,
      transcriptionLanguage: 'en-US',
      voiceCommandsEnabled: true,
      defaultVoice: 'default',
      speechSpeed: 1,
      speechPitch: 1,
      wakeWord: 'hey knowledge',
      wakeWordEnabled: false
    };

    return res.json({
      success: true,
      data: voiceSettings
    });
  } catch (error) {
    logger.error('Get voice settings error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get voice settings'
    });
  }
});

// PUT /api/voice/settings - Update voice settings
router.put('/settings', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const voiceSettings = z.object({
      autoTranscribe: z.boolean().optional(),
      transcriptionLanguage: z.string().optional(),
      voiceCommandsEnabled: z.boolean().optional(),
      defaultVoice: z.string().optional(),
      speechSpeed: z.number().min(0.5).max(2).optional(),
      speechPitch: z.number().min(0.5).max(2).optional(),
      wakeWord: z.string().optional(),
      wakeWordEnabled: z.boolean().optional(),
    }).parse(req.body);

    // Get current settings
    const user = await db.client.user.findUnique({
      where: { id: userId },
      select: { settings: true }
    });

    const currentSettings = user?.settings || {};
    const updatedSettings = {
      ...currentSettings,
      voice: {
        ...currentSettings.voice,
        ...voiceSettings
      }
    };

    // Update user settings
    await db.client.user.update({
      where: { id: userId },
      data: { settings: updatedSettings }
    });

    logger.info(`Voice settings updated for user: ${userId}`);

    return res.json({
      success: true,
      data: updatedSettings.voice
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }

    logger.error('Update voice settings error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update voice settings'
    });
  }
});

// GET /api/voice/statistics - Get voice usage statistics
router.get('/statistics', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;

    const [totalNotes, totalDuration, recentNotes] = await Promise.all([
      db.client.voiceNote.count({ where: { userId } }),
      db.client.voiceNote.aggregate({
        where: { userId },
        _sum: { duration: true }
      }),
      db.client.voiceNote.count({
        where: {
          userId,
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
          }
        }
      })
    ]);

    const stats = {
      totalVoiceNotes: totalNotes,
      totalDuration: totalDuration._sum.duration || 0,
      recentNotes: recentNotes,
      averageDuration: totalNotes > 0 ? (totalDuration._sum.duration || 0) / totalNotes : 0
    };

    return res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Get voice statistics error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get voice statistics'
    });
  }
});

export default router;
