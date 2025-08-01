import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { authService } from '../services/auth';
import { validateBody, schemas } from '../middleware/validation';
import { authRateLimit, passwordResetRateLimit, emailVerificationRateLimit } from '../middleware/rateLimit';
import { authMiddleware } from '../middleware/auth';
import { logger } from '../utils/logger';
import db from '../services/database';

const router = Router();

// Register new user
router.post('/register',
  authRateLimit,
  validateBody(schemas.register),
  async (req, res) => {
    try {
      const result = await authService.register(req.body);
      
    return res.status(201).json({
        message: 'User registered successfully',
        user: result.user,
        tokens: result.tokens
      });
    } catch (error) {
      logger.error('Registration failed:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('already')) {
    return res.status(409).json({ error: error.message });
        } else {
    return res.status(400).json({ error: error.message });
        }
      } else {
    return res.status(500).json({ error: 'Registration failed' });
      }
    }
  }
);

// Login user
router.post('/login',
  authRateLimit,
  validateBody(schemas.login),
  async (req, res) => {
    try {
      const result = await authService.login(req.body);
      
      // Set secure HTTP-only cookie for refresh token
      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env['NODE_ENV'] === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });
      
    return res.json({
        message: 'Login successful',
        user: result.user,
        accessToken: result.tokens.accessToken,
        expiresIn: result.tokens.expiresIn
      });
    } catch (error) {
      logger.error('Login failed:', error);
    return res.status(401).json({ error: 'Invalid credentials' });
    }
  }
);

// Refresh access token
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
    
    if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token required' });
      return;
    }
    
    const tokens = await authService.refreshTokens(refreshToken);
    
    // Update refresh token cookie
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    
    return res.json({
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn
    });
  } catch (error) {
    logger.error('Token refresh failed:', error);
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// Logout user
router.post('/logout',
  authMiddleware,
  async (req, res) => {
    try {
      const refreshToken = req.cookies.refreshToken;
      await authService.logout(req.user!.id, refreshToken);
      
      // Clear refresh token cookie
      res.clearCookie('refreshToken');
      
    return res.json({ message: 'Logout successful' });
    } catch (error) {
      logger.error('Logout failed:', error);
    return res.status(500).json({ error: 'Logout failed' });
    }
  }
);

// Request password reset
router.post('/forgot-password',
  passwordResetRateLimit,
  validateBody(z.object({ email: z.string().email() })),
  async (req, res) => {
    try {
      await authService.requestPasswordReset(req.body.email);
      
      // Always return success to prevent email enumeration
    return res.json({ message: 'If the email exists, a password reset link has been sent' });
    } catch (error) {
      logger.error('Password reset request failed:', error);
    return res.json({ message: 'If the email exists, a password reset link has been sent' });
    }
  }
);

// Reset password
router.post('/reset-password',
  authRateLimit,
  validateBody(schemas.resetPassword),
  async (req, res) => {
    try {
      await authService.resetPassword(req.body.token, req.body.newPassword);
    return res.json({ message: 'Password reset successful' });
    } catch (error) {
      logger.error('Password reset failed:', error);
    return res.status(400).json({ error: 'Invalid or expired reset token' });
    }
  }
);

// Change password (authenticated)
router.post('/change-password',
  authMiddleware,
  validateBody(schemas.changePassword),
  async (req, res) => {
    try {
      await authService.changePassword(
        req.user!.id,
        req.body.currentPassword,
        req.body.newPassword
      );
      
    return res.json({ message: 'Password changed successfully' });
    } catch (error) {
      logger.error('Password change failed:', error);
      
      if (error instanceof Error && error.message.includes('Invalid current password')) {
    return res.status(400).json({ error: 'Current password is incorrect' });
      } else {
    return res.status(500).json({ error: 'Password change failed' });
      }
    }
  }
);

// Verify email
router.post('/verify-email',
  validateBody(z.object({ token: z.string() })),
  async (req, res) => {
    try {
      await authService.verifyEmail(req.body.token);
    return res.json({ message: 'Email verified successfully' });
    } catch (error) {
      logger.error('Email verification failed:', error);
    return res.status(400).json({ error: 'Invalid verification token' });
    }
  }
);

// Resend verification email
router.post('/resend-verification',
  emailVerificationRateLimit,
  authMiddleware,
  async (_req, res) => {
    try {
      // TODO: Implement resend verification email
    return res.json({ message: 'Verification email sent' });
    } catch (error) {
      logger.error('Resend verification failed:', error);
    return res.status(500).json({ error: 'Failed to send verification email' });
    }
  }
);

// Get current user profile
router.get('/me',
  authMiddleware,
  async (req, res) => {
    try {
    return res.json({ user: req.user });
    } catch (error) {
      logger.error('Get profile failed:', error);
    return res.status(500).json({ error: 'Failed to get user profile' });
    }
  }
);

// Update user profile
router.patch('/me',
  authMiddleware,
  validateBody(z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    bio: z.string().max(500).optional(),
    settings: z.any().optional()
  })),
  async (req, res) => {
    try {
      const updatedUser = await db.user.update({
        where: { id: req.user!.id },
        data: req.body,
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          avatar: true,
          bio: true,
          emailVerified: true,
          settings: true
        }
      });
      
    return res.json({ user: updatedUser });
    } catch (error) {
      logger.error('Profile update failed:', error);
    return res.status(500).json({ error: 'Failed to update profile' });
    }
  }
);

// Delete account
router.delete('/me',
  authMiddleware,
  validateBody(z.object({ 
    password: z.string(),
    confirmation: z.literal('DELETE_ACCOUNT')
  })),
  async (req, res) => {
    try {
      // Verify password before deletion
      const user = await db.user.findUnique({
        where: { id: req.user!.id },
        select: { passwordHash: true }
      });
      
      if (!user?.passwordHash) {
    return res.status(400).json({ error: 'Cannot delete account' });
        return;
      }
      
      const isValidPassword = await bcrypt.compare(req.body.password, user.passwordHash);
      if (!isValidPassword) {
    return res.status(400).json({ error: 'Invalid password' });
        return;
      }
      
      // TODO: Implement proper account deletion with data cleanup
      // This should include:
      // - Transferring ownership of shared resources
      // - Deleting personal data
      // - Anonymizing or deleting associated records
      
    return res.json({ message: 'Account deletion initiated' });
    } catch (error) {
      logger.error('Account deletion failed:', error);
    return res.status(500).json({ error: 'Failed to delete account' });
    }
  }
);

// OAuth routes (Google, GitHub, etc.)
router.get('/oauth/:provider', (req, res) => {
  const { provider } = req.params;
  
  // TODO: Implement OAuth redirect URLs
  switch (provider) {
    case 'google':
      // Redirect to Google OAuth
      return res.status(501).json({ error: 'Google OAuth not implemented yet' });
    case 'github':
      // Redirect to GitHub OAuth
      return res.status(501).json({ error: 'GitHub OAuth not implemented yet' });
    default:
      return res.status(400).json({ error: 'Unsupported OAuth provider' });
  }
});

router.get('/oauth/:provider/callback', async (req, res) => {
  try {
    const { provider: _provider } = req.params;
    const { code: _code } = req.query;
    
    // TODO: Implement OAuth callback handling
    // This would:
    // 1. Exchange code for access token
    // 2. Get user profile from OAuth provider
    // 3. Create or login user
    // 4. Return tokens
    
    res.redirect(`${process.env['FRONTEND_URL']}/auth/success`);
  } catch (error) {
    logger.error('OAuth callback failed:', error);
    res.redirect(`${process.env['FRONTEND_URL']}/auth/error`);
  }
});

// Get user sessions
router.get('/sessions',
  authMiddleware,
  async (req, res) => {
    try {
      const sessions = await db.session.findMany({
        where: { userId: req.user!.id },
        select: {
          id: true,
          userAgent: true,
          ipAddress: true,
          createdAt: true,
          expiresAt: true
        },
        orderBy: { createdAt: 'desc' }
      });
      
    return res.json({ sessions });
    } catch (error) {
      logger.error('Get sessions failed:', error);
    return res.status(500).json({ error: 'Failed to get sessions' });
    }
  }
);

// Revoke session
router.delete('/sessions/:sessionId',
  authMiddleware,
  async (req, res) => {
    try {
      const sessionId = req.params['sessionId'];
      if (!sessionId) {
    return res.status(400).json({ error: 'Session ID is required' });
        return;
      }
      await authService.revokeSession(sessionId);
    return res.json({ message: 'Session revoked' });
    } catch (error) {
      logger.error('Session revocation failed:', error);
    return res.status(500).json({ error: 'Failed to revoke session' });
    }
  }
);

// Revoke all sessions
router.delete('/sessions',
  authMiddleware,
  async (req, res) => {
    try {
      await authService.revokeAllSessions(req.user!.id);
    return res.json({ message: 'All sessions revoked' });
    } catch (error) {
      logger.error('Revoke all sessions failed:', error);
    return res.status(500).json({ error: 'Failed to revoke sessions' });
    }
  }
);

export default router;
