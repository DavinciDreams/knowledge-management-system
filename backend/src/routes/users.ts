import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { authMiddleware, optionalAuthMiddleware } from '@/middleware/auth';
import { DatabaseService } from '@/services/database';
import { FileStorageService } from '@/services/fileStorage';
import { logger } from '@/utils/logger';
import { upload } from '@/middleware/upload';

const router = Router();
const db = DatabaseService.getInstance();
const fileStorage = new FileStorageService();

// Validation schemas
const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/).optional(),
  bio: z.string().max(500).optional(),
  website: z.string().url().optional(),
  location: z.string().max(100).optional(),
  company: z.string().max(100).optional(),
  jobTitle: z.string().max(100).optional(),
});

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(6).max(100),
});

const updateSettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  language: z.string().min(2).max(5).optional(),
  timezone: z.string().optional(),
  emailNotifications: z.object({
    mentions: z.boolean().optional(),
    comments: z.boolean().optional(),
    collaboration: z.boolean().optional(),
    marketing: z.boolean().optional(),
  }).optional(),
  privacy: z.object({
    profileVisibility: z.enum(['public', 'private']).optional(),
    showEmail: z.boolean().optional(),
    showActivity: z.boolean().optional(),
  }).optional(),
  editor: z.object({
    defaultFont: z.string().optional(),
    fontSize: z.number().min(8).max(24).optional(),
    lineHeight: z.number().min(1).max(3).optional(),
    autoSave: z.boolean().optional(),
    autoSaveInterval: z.number().min(1000).max(60000).optional(),
  }).optional(),
});

// GET /api/users/me - Get current user profile
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;

    const user = await db.client.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        avatar: true,
        bio: true,
        website: true,
        location: true,
        company: true,
        jobTitle: true,
        emailVerified: true,
        settings: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            notebooks: true,
            pages: true,
            comments: true,
            collaborations: true,
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    return res.json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error('Get current user error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get user profile'
    });
  }
});

// GET /api/users/:id - Get user profile by ID
router.get('/:id', optionalAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user?.id;

    const user = await db.client.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        avatar: true,
        bio: true,
        website: true,
        location: true,
        company: true,
        jobTitle: true,
        createdAt: true,
        settings: currentUserId === id ? true : {
          select: {
            privacy: true
          }
        },
        _count: {
          select: {
            notebooks: {
              where: currentUserId === id ? {} : {
                visibility: 'PUBLIC'
              }
            },
            pages: {
              where: currentUserId === id ? {} : {
                notebook: {
                  visibility: 'PUBLIC'
                }
              }
            },
            comments: true,
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Check privacy settings
    const privacy = user.settings?.privacy || {};
    if (currentUserId !== id && privacy.profileVisibility === 'private') {
      return res.status(403).json({
        success: false,
        error: 'Profile is private'
      });
    }

    // Filter out private information based on privacy settings
    const publicProfile = {
      ...user,
      email: privacy.showEmail ? user.email : undefined,
      settings: undefined
    };

    return res.json({
      success: true,
      data: publicProfile
    });
  } catch (error) {
    logger.error('Get user profile error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get user profile'
    });
  }
});

// PUT /api/users/me - Update current user profile
router.put('/me', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const validatedData = updateProfileSchema.parse(req.body);

    // Check if username is already taken
    if (validatedData.username) {
      const existingUser = await db.client.user.findFirst({
        where: {
          username: validatedData.username,
          NOT: { id: userId }
        }
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'Username already taken'
        });
      }
    }

    const updatedUser = await db.client.user.update({
      where: { id: userId },
      data: validatedData,
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        avatar: true,
        bio: true,
        website: true,
        location: true,
        company: true,
        jobTitle: true,
        emailVerified: true,
        settings: true,
        updatedAt: true,
      }
    });

    logger.info(`User profile updated: ${userId}`);

    return res.json({
      success: true,
      data: updatedUser
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }

    logger.error('Update user profile error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update profile'
    });
  }
});

// PUT /api/users/me/password - Update password
router.put('/me/password', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { currentPassword, newPassword } = updatePasswordSchema.parse(req.body);

    // Get current user with password
    const user = await db.client.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await db.client.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    logger.info(`Password updated for user: ${userId}`);

    return res.json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }

    logger.error('Update password error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update password'
    });
  }
});

// POST /api/users/me/avatar - Upload avatar
router.post('/me/avatar', authMiddleware, upload.single('avatar'), async (req, res) => {
  try {
    const userId = req.user!.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    // Validate file type
    if (!file.mimetype.startsWith('image/')) {
      return res.status(400).json({
        success: false,
        error: 'File must be an image'
      });
    }

    // Upload to storage
    const avatarUrl = await fileStorage.uploadFile(
      file,
      userId,
      {
        folder: 'avatars',
        makePublic: true
      }
    );

    // Update user avatar
    const updatedUser = await db.client.user.update({
      where: { id: userId },
      data: { avatar: avatarUrl },
      select: {
        id: true,
        avatar: true,
        updatedAt: true,
      }
    });

    logger.info(`Avatar updated for user: ${userId}`);

    return res.json({
      success: true,
      data: updatedUser
    });
  } catch (error) {
    logger.error('Upload avatar error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to upload avatar'
    });
  }
});

// DELETE /api/users/me/avatar - Remove avatar
router.delete('/me/avatar', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;

    const updatedUser = await db.client.user.update({
      where: { id: userId },
      data: { avatar: null },
      select: {
        id: true,
        avatar: true,
        updatedAt: true,
      }
    });

    logger.info(`Avatar removed for user: ${userId}`);

    return res.json({
      success: true,
      data: updatedUser
    });
  } catch (error) {
    logger.error('Remove avatar error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to remove avatar'
    });
  }
});

// PUT /api/users/me/settings - Update user settings
router.put('/me/settings', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const validatedData = updateSettingsSchema.parse(req.body);

    // Get current settings
    const currentUser = await db.client.user.findUnique({
      where: { id: userId },
      select: { settings: true }
    });

    // Merge with existing settings
    const currentSettings = currentUser?.settings || {};
    const updatedSettings = {
      ...currentSettings,
      ...validatedData,
      emailNotifications: {
        ...currentSettings.emailNotifications,
        ...validatedData.emailNotifications,
      },
      privacy: {
        ...currentSettings.privacy,
        ...validatedData.privacy,
      },
      editor: {
        ...currentSettings.editor,
        ...validatedData.editor,
      },
    };

    const updatedUser = await db.client.user.update({
      where: { id: userId },
      data: { settings: updatedSettings },
      select: {
        id: true,
        settings: true,
        updatedAt: true,
      }
    });

    logger.info(`Settings updated for user: ${userId}`);

    return res.json({
      success: true,
      data: updatedUser
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }

    logger.error('Update settings error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update settings'
    });
  }
});

// GET /api/users/me/activity - Get user activity
router.get('/me/activity', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query["page"] as string) || 1;
    const limit = Math.min(parseInt(req.query["limit"] as string) || 20, 100);
    const offset = (page - 1) * limit;

    const activities = await db.client.userActivity.findMany({
      where: { userId },
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

    const total = await db.client.userActivity.count({
      where: { userId }
    });

    return res.json({
      success: true,
      data: {
        activities,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get user activity error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get user activity'
    });
  }
});

// DELETE /api/users/me - Delete user account
router.delete('/me', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Password is required to delete account'
      });
    }

    // Verify password
    const user = await db.client.user.findUnique({
      where: { id: userId },
      select: { password: true }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({
        success: false,
        error: 'Invalid password'
      });
    }

    // Delete user and all associated data (handled by CASCADE in schema)
    await db.client.user.delete({
      where: { id: userId }
    });

    logger.info(`User account deleted: ${userId}`);

    return res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    logger.error('Delete user account error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete account'
    });
  }
});

export default router;
