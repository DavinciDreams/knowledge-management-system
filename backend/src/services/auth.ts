import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { db } from './database';
import { redis } from './redis';
import { logger } from '../utils/logger';
import { User } from '../types';

export interface AuthUser extends User {}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterData {
  email: string;
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

class AuthService {
  private readonly jwtSecret: string;
  private readonly accessTokenExpiry = '15m';
  private readonly refreshTokenExpiry = '7d';
  private readonly bcryptRounds = 12;

  constructor() {
    this.jwtSecret = process.env['JWT_SECRET'] || 'fallback-secret-key';
    if (this.jwtSecret === 'fallback-secret-key') {
      logger.warn('Using fallback JWT secret. Set JWT_SECRET environment variable.');
    }
  }

  // User registration
  public async register(data: RegisterData): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    const { email, username, password, firstName, lastName } = data;

    try {
      // Check if user already exists
      const existingUser = await db.user.findFirst({
        where: {
          OR: [{ email }, { username }]
        }
      });

      if (existingUser) {
        if (existingUser.email === email) {
          throw new Error('Email already registered');
        }
        if (existingUser.username === username) {
          throw new Error('Username already taken');
        }
      }

      // Hash password
      const passwordHash = await this.hashPassword(password);

      // Generate email verification token
      const emailVerificationToken = crypto.randomBytes(32).toString('hex');      // Create user
      const user = await db.user.create({
        data: {
          email,
          username,
          passwordHash,
          firstName: firstName || null,
          lastName: lastName || null,
          emailVerificationToken,
          settings: {
            theme: 'light',
            language: 'en',
            notifications: {
              email: true,
              push: true,
              mentions: true,
              comments: true
            }
          }
        },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          avatar: true,
          emailVerified: true,
          settings: true
        }
      });

      // Generate tokens
      const tokens = await this.generateTokens(user.id);

      // Store refresh token
      await this.storeRefreshToken(user.id, tokens.refreshToken);

      // TODO: Send verification email
      // await this.sendVerificationEmail(user.email, emailVerificationToken);

      logger.info(`User registered: ${user.username} (${user.email})`);

      return { user, tokens };
    } catch (error) {
      logger.error('Registration failed:', error);
      throw error;
    }
  }

  // User login
  public async login(credentials: LoginCredentials): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    const { email, password, rememberMe = false } = credentials;

    try {
      // Find user
      const user = await db.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          avatar: true,
          emailVerified: true,
          passwordHash: true,
          settings: true
        }
      });

      if (!user) {
        throw new Error('Invalid credentials');
      }

      // Verify password
      const isValidPassword = await this.verifyPassword(password, user.passwordHash || '');
      if (!isValidPassword) {
        throw new Error('Invalid credentials');
      }

      // Generate tokens
      const expiryOverride = rememberMe ? '30d' : undefined;
      const tokens = await this.generateTokens(user.id, expiryOverride);

      // Store refresh token
      await this.storeRefreshToken(user.id, tokens.refreshToken);

      // Update last login
      await db.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() }
      });

      // Remove sensitive data
      const { passwordHash, ...safeUser } = user;

      logger.info(`User logged in: ${user.username} (${user.email})`);

      return { user: safeUser, tokens };
    } catch (error) {
      logger.error('Login failed:', error);
      throw error;
    }
  }

  // Token refresh
  public async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, this.jwtSecret) as any;
      const userId = decoded.sub;

      // Check if refresh token exists in Redis
      const storedToken = await redis.get(`refresh_token:${userId}`);
      if (storedToken !== refreshToken) {
        throw new Error('Invalid refresh token');
      }

      // Verify user still exists
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { id: true }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Generate new tokens
      const tokens = await this.generateTokens(userId);

      // Store new refresh token
      await this.storeRefreshToken(userId, tokens.refreshToken);

      logger.debug(`Tokens refreshed for user: ${userId}`);

      return tokens;
    } catch (error) {
      logger.error('Token refresh failed:', error);
      throw new Error('Invalid refresh token');
    }
  }

  // Logout
  public async logout(userId: string, refreshToken?: string): Promise<void> {
    try {
      // Remove refresh token from Redis
      await redis.del(`refresh_token:${userId}`);

      // If refresh token provided, add it to blacklist
      if (refreshToken) {
        await redis.set(`blacklisted_token:${refreshToken}`, 'true', 7 * 24 * 60 * 60); // 7 days
      }

      // Remove all user sessions
      await db.session.deleteMany({
        where: { userId }
      });

      logger.info(`User logged out: ${userId}`);
    } catch (error) {
      logger.error('Logout failed:', error);
      throw error;
    }
  }

  // Verify access token
  public async verifyAccessToken(token: string): Promise<AuthUser> {
    try {
      // Check if token is blacklisted
      const isBlacklisted = await redis.exists(`blacklisted_token:${token}`);
      if (isBlacklisted) {
        throw new Error('Token blacklisted');
      }

      // Verify JWT
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      const userId = decoded.sub;

      // Get user from database
      const user = await db.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          avatar: true,
          emailVerified: true,
          settings: true
        }
      });

      if (!user) {
        throw new Error('User not found');
      }

      return user;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token');
      }
      throw error;
    }
  }

  // Password reset request
  public async requestPasswordReset(email: string): Promise<void> {
    try {
      const user = await db.user.findUnique({
        where: { email }
      });

      if (!user) {
        // Don't reveal if email exists
        logger.info(`Password reset requested for non-existent email: ${email}`);
        return;
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Store reset token
      await db.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: resetToken,
          passwordResetExpires: resetExpires
        }
      });

      // TODO: Send reset email
      // await this.sendPasswordResetEmail(email, resetToken);

      logger.info(`Password reset requested for: ${email}`);
    } catch (error) {
      logger.error('Password reset request failed:', error);
      throw error;
    }
  }

  // Reset password
  public async resetPassword(token: string, newPassword: string): Promise<void> {
    try {
      const user = await db.user.findFirst({
        where: {
          passwordResetToken: token,
          passwordResetExpires: {
            gt: new Date()
          }
        }
      });

      if (!user) {
        throw new Error('Invalid or expired reset token');
      }

      // Hash new password
      const passwordHash = await this.hashPassword(newPassword);

      // Update password and clear reset token
      await db.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          passwordResetToken: null,
          passwordResetExpires: null
        }
      });

      // Invalidate all existing sessions
      await this.logout(user.id);

      logger.info(`Password reset completed for user: ${user.id}`);
    } catch (error) {
      logger.error('Password reset failed:', error);
      throw error;
    }
  }

  // Email verification
  public async verifyEmail(token: string): Promise<void> {
    try {
      const user = await db.user.findFirst({
        where: { emailVerificationToken: token }
      });

      if (!user) {
        throw new Error('Invalid verification token');
      }

      await db.user.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
          emailVerificationToken: null
        }
      });

      logger.info(`Email verified for user: ${user.id}`);
    } catch (error) {
      logger.error('Email verification failed:', error);
      throw error;
    }
  }

  // Change password
  public async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { passwordHash: true }
      });

      if (!user || !user.passwordHash) {
        throw new Error('User not found');
      }

      // Verify current password
      const isValidPassword = await this.verifyPassword(currentPassword, user.passwordHash);
      if (!isValidPassword) {
        throw new Error('Invalid current password');
      }

      // Hash new password
      const passwordHash = await this.hashPassword(newPassword);

      // Update password
      await db.user.update({
        where: { id: userId },
        data: { passwordHash }
      });

      logger.info(`Password changed for user: ${userId}`);
    } catch (error) {
      logger.error('Password change failed:', error);
      throw error;
    }
  }

  // OAuth login
  public async oauthLogin(provider: string, oauthId: string, profile: any): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    try {
      // Try to find existing user by OAuth ID
      let user = await db.user.findFirst({
        where: {
          oauthProvider: provider,
          oauthId: oauthId
        },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          avatar: true,
          emailVerified: true,
          settings: true
        }
      });

      if (!user) {
        // Try to find by email
        user = await db.user.findUnique({
          where: { email: profile.email },
          select: {
            id: true,
            email: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar: true,
            emailVerified: true,
            settings: true
          }
        });

        if (user) {
          // Link OAuth account to existing user
          await db.user.update({
            where: { id: user.id },
            data: {
              oauthProvider: provider,
              oauthId: oauthId
            }
          });
        } else {
          // Create new user
          const username = await this.generateUniqueUsername(profile.username || profile.email.split('@')[0]);
          
          user = await db.user.create({
            data: {
              email: profile.email,
              username,
              firstName: profile.firstName,
              lastName: profile.lastName,
              avatar: profile.avatar,
              emailVerified: true, // OAuth emails are typically verified
              oauthProvider: provider,
              oauthId: oauthId,
              settings: {
                theme: 'light',
                language: 'en',
                notifications: {
                  email: true,
                  push: true,
                  mentions: true,
                  comments: true
                }
              }
            },
            select: {
              id: true,
              email: true,
              username: true,
              firstName: true,
              lastName: true,
              avatar: true,
              emailVerified: true,
              settings: true
            }
          });
        }
      }

      // Generate tokens
      const tokens = await this.generateTokens(user.id);

      // Store refresh token
      await this.storeRefreshToken(user.id, tokens.refreshToken);

      // Update last login
      await db.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() }
      });

      logger.info(`OAuth login: ${user.username} via ${provider}`);

      return { user, tokens };
    } catch (error) {
      logger.error('OAuth login failed:', error);
      throw error;
    }
  }

  // Private helper methods
  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.bcryptRounds);
  }

  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  private async generateTokens(userId: string, refreshExpiry?: string): Promise<AuthTokens> {
    const accessToken = jwt.sign(
      { sub: userId, type: 'access' },
      this.jwtSecret,
      { expiresIn: this.accessTokenExpiry }
    );

    const expirationTime = refreshExpiry || this.refreshTokenExpiry;
    const refreshToken = jwt.sign(
      { sub: userId, type: 'refresh' },
      this.jwtSecret as jwt.Secret,
      { expiresIn: expirationTime } as jwt.SignOptions
    );

    // Calculate expiration time
    const decoded = jwt.decode(accessToken) as any;
    const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);

    return {
      accessToken,
      refreshToken,
      expiresIn
    };
  }

  private async storeRefreshToken(userId: string, refreshToken: string): Promise<void> {
    // Store refresh token in Redis with expiration
    const expiry = 7 * 24 * 60 * 60; // 7 days
    await redis.set(`refresh_token:${userId}`, refreshToken, expiry);
  }

  private async generateUniqueUsername(baseUsername: string): Promise<string> {
    let username = baseUsername.toLowerCase().replace(/[^a-z0-9]/g, '');
    let counter = 0;

    while (true) {
      const testUsername = counter === 0 ? username : `${username}${counter}`;
      
      const existing = await db.user.findUnique({
        where: { username: testUsername }
      });

      if (!existing) {
        return testUsername;
      }

      counter++;
    }
  }

  // Session management
  public async createSession(userId: string, userAgent?: string, ipAddress?: string): Promise<string> {
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await db.session.create({
      data: {
        id: sessionToken,
        userId,
        token: sessionToken,
        expiresAt,
        userAgent: userAgent || null,
        ipAddress: ipAddress || null
      }
    });

    return sessionToken;
  }

  public async validateSession(sessionToken: string): Promise<AuthUser | null> {
    try {
      const session = await db.session.findUnique({
        where: { token: sessionToken },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              firstName: true,
              lastName: true,
              avatar: true,
              emailVerified: true,
              settings: true
            }
          }
        }
      });

      if (!session || session.expiresAt < new Date()) {
        return null;
      }

      return session.user;
    } catch (error) {
      logger.error('Session validation failed:', error);
      return null;
    }
  }

  public async revokeSession(sessionToken: string): Promise<void> {
    await db.session.delete({
      where: { token: sessionToken }
    });
  }

  public async revokeAllSessions(userId: string): Promise<void> {
    await db.session.deleteMany({
      where: { userId }
    });
  }
}

export const authService = new AuthService();
export { AuthService };
