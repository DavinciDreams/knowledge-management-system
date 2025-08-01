import { Client as MinioClient } from 'minio';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import { logger } from '../utils/logger';
import { db } from './database';

export interface FileUpload {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  bucket: string;
  key: string;
  uploadedBy: string;
  createdAt: Date;
}

export interface UploadOptions {
  maxSize?: number;
  allowedTypes?: string[];
  generateThumbnail?: boolean;
  compress?: boolean;
}

class FileStorageService {
  private minioClient: MinioClient;
  private defaultBucket: string;
  private publicUrl: string;

  constructor() {
    this.defaultBucket = process.env['MINIO_BUCKET'] || 'knowledge-files';
    this.publicUrl = `http://${process.env['MINIO_ENDPOINT']}:${process.env['MINIO_PORT']}`;

    this.minioClient = new MinioClient({
      endPoint: process.env['MINIO_ENDPOINT'] || 'localhost',
      port: parseInt(process.env['MINIO_PORT'] || '9000'),
      useSSL: false,
      accessKey: process.env['MINIO_ACCESS_KEY'] || 'knowledge_minio',
      secretKey: process.env['MINIO_SECRET_KEY'] || 'knowledge_minio_secret'
    });

    this.initializeBuckets();
  }

  private async initializeBuckets(): Promise<void> {
    try {
      // Create default bucket if it doesn't exist
      const bucketExists = await this.minioClient.bucketExists(this.defaultBucket);
      if (!bucketExists) {
        await this.minioClient.makeBucket(this.defaultBucket, 'us-east-1');
        
        // Set bucket policy for public read access to certain files
        const policy = {
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: { AWS: ['*'] },
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${this.defaultBucket}/public/*`]
            }
          ]
        };
        
        await this.minioClient.setBucketPolicy(this.defaultBucket, JSON.stringify(policy));
        logger.info(`Created bucket: ${this.defaultBucket}`);
      }

      // Create additional buckets for different file types
      const additionalBuckets = ['avatars', 'thumbnails', 'temp'];
      for (const bucket of additionalBuckets) {
        const exists = await this.minioClient.bucketExists(bucket);
        if (!exists) {
          await this.minioClient.makeBucket(bucket, 'us-east-1');
          logger.info(`Created bucket: ${bucket}`);
        }
      }
    } catch (error) {
      logger.error('Failed to initialize MinIO buckets:', error);
    }
  }

  // Configure multer for file uploads
  public getMulterConfig(options: UploadOptions = {}): multer.Multer {
    const {
      maxSize = 100 * 1024 * 1024, // 100MB default
      allowedTypes = []
    } = options;

    const storage = multer.memoryStorage();

    const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
      // Check file type if specified
      if (allowedTypes.length > 0) {
        const isAllowed = allowedTypes.some(type => {
          if (type.endsWith('/*')) {
            return file.mimetype.startsWith(type.slice(0, -2));
          }
          return file.mimetype === type;
        });

        if (!isAllowed) {
          return cb(new Error(`File type ${file.mimetype} not allowed`));
        }
      }

      // Check for malicious files
      const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.jar'];
      const fileExtension = path.extname(file.originalname).toLowerCase();
      
      if (dangerousExtensions.includes(fileExtension)) {
        return cb(new Error('File type not allowed for security reasons'));
      }

      cb(null, true);
    };

    return multer({
      storage,
      fileFilter,
      limits: {
        fileSize: maxSize,
        files: 10 // Max 10 files per request
      }
    });
  }

  // Upload file
  public async uploadFile(
    file: Express.Multer.File,
    userId: string,
    options: {
      bucket?: string;
      folder?: string;
      makePublic?: boolean;
      pageId?: string;
    } = {}
  ): Promise<FileUpload> {
    const {
      bucket = this.defaultBucket,
      folder = 'uploads',
      makePublic = false,
      pageId
    } = options;

    try {
      // Generate unique filename
      const fileId = crypto.randomUUID();
      const extension = path.extname(file.originalname);
      const filename = `${fileId}${extension}`;
      const key = `${folder}/${filename}`;

      // Upload to MinIO
      await this.minioClient.putObject(
        bucket,
        key,
        file.buffer,
        file.size,
        {
          'Content-Type': file.mimetype,
          'X-Uploaded-By': userId,
          'X-Original-Name': file.originalname
        }
      );

      // Generate URL
      const url = makePublic 
        ? `${this.publicUrl}/${bucket}/${key}`
        : await this.minioClient.presignedGetObject(bucket, key, 7 * 24 * 60 * 60); // 7 days

      // Save to database
      const attachment = await db.attachment.create({
        data: {
          id: fileId,
          filename,
          mimeType: file.mimetype,
          size: file.size,
          url,
          uploadedBy: userId,
          pageId
        }
      });

      logger.info(`File uploaded: ${filename} by user ${userId}`);

      return {
        id: attachment.id,
        filename: attachment.filename,
        originalName: file.originalname,
        mimeType: attachment.mimeType,
        size: attachment.size,
        url: attachment.url,
        bucket,
        key,
        uploadedBy: attachment.uploadedBy,
        createdAt: attachment.createdAt
      };
    } catch (error) {
      logger.error('File upload failed:', error);
      throw new Error('Failed to upload file');
    }
  }

  // Upload multiple files
  public async uploadFiles(
    files: Express.Multer.File[],
    userId: string,
    options: {
      bucket?: string;
      folder?: string;
      makePublic?: boolean;
      pageId?: string;
    } = {}
  ): Promise<FileUpload[]> {
    const uploads = await Promise.all(
      files.map(file => this.uploadFile(file, userId, options))
    );
    return uploads;
  }

  // Get file
  public async getFile(fileId: string, userId: string): Promise<NodeJS.ReadableStream> {
    try {
      const attachment = await db.attachment.findUnique({
        where: { id: fileId },
        include: {
          page: {
            select: {
              authorId: true,
              collaborations: {
                where: { userId },
                select: { canEdit: true }
              }
            }
          }
        }
      });

      if (!attachment) {
        throw new Error('File not found');
      }

      // Check permissions
      const canAccess = attachment.uploadedBy === userId ||
        attachment.page?.authorId === userId ||
        attachment.page?.collaborations.length > 0;

      if (!canAccess) {
        throw new Error('Access denied');
      }

      // Get file from MinIO
      const key = `uploads/${attachment.filename}`;
      const stream = await this.minioClient.getObject(this.defaultBucket, key);
      
      return stream;
    } catch (error) {
      logger.error('Failed to get file:', error);
      throw error;
    }
  }

  // Delete file
  public async deleteFile(fileId: string, userId: string): Promise<void> {
    try {
      const attachment = await db.attachment.findUnique({
        where: { id: fileId },
        include: {
          page: {
            select: {
              authorId: true,
              collaborations: {
                where: { userId },
                select: { canEdit: true }
              }
            }
          }
        }
      });

      if (!attachment) {
        throw new Error('File not found');
      }

      // Check permissions
      const canDelete = attachment.uploadedBy === userId ||
        attachment.page?.authorId === userId ||
        attachment.page?.collaborations.some((c: any) => c.canEdit);

      if (!canDelete) {
        throw new Error('Access denied');
      }

      // Delete from MinIO
      const key = `uploads/${attachment.filename}`;
      await this.minioClient.removeObject(this.defaultBucket, key);

      // Delete from database
      await db.attachment.delete({
        where: { id: fileId }
      });

      logger.info(`File deleted: ${attachment.filename} by user ${userId}`);
    } catch (error) {
      logger.error('Failed to delete file:', error);
      throw error;
    }
  }

  // Get file content as string (for text-based files)
  public async getFileContent(fileUrl: string): Promise<string> {
    try {
      // Extract bucket and key from URL
      let bucket = this.defaultBucket;
      let key = '';

      if (fileUrl.startsWith('http')) {      // Parse URL to extract bucket and key
      const url = new URL(fileUrl);
      const pathParts = url.pathname.split('/').filter(part => part);
      if (pathParts.length >= 2) {
        bucket = pathParts[0] || this.defaultBucket;
        key = pathParts.slice(1).join('/');
      }
      } else {
        // Assume it's a relative key
        key = fileUrl.startsWith('uploads/') ? fileUrl : `uploads/${fileUrl}`;
      }

      // Get file stream from MinIO
      const stream = await this.minioClient.getObject(bucket, key);
      
      // Convert stream to string
      const chunks: Buffer[] = [];
      return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => {
          const content = Buffer.concat(chunks).toString('utf-8');
          resolve(content);
        });
        stream.on('error', reject);
      });
    } catch (error) {
      logger.error('Failed to get file content:', error);
      throw new Error('Failed to retrieve file content');
    }
  }

  // Download file content as buffer
  public async downloadFile(fileUrl: string): Promise<Buffer> {
    try {
      // Extract bucket and key from URL
      let bucket = this.defaultBucket;
      let key = '';

      if (fileUrl.startsWith('http')) {
        // Parse URL to extract bucket and key
        const url = new URL(fileUrl);
        const pathParts = url.pathname.split('/').filter(part => part);
        if (pathParts.length >= 2) {
          bucket = pathParts[0] || this.defaultBucket;
          key = pathParts.slice(1).join('/');
        }
      } else {
        // Assume it's a relative key
        key = fileUrl.startsWith('uploads/') ? fileUrl : `uploads/${fileUrl}`;
      }

      // Get file stream from MinIO
      const stream = await this.minioClient.getObject(bucket, key);
      
      // Convert stream to buffer
      const chunks: Buffer[] = [];
      return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve(buffer);
        });
        stream.on('error', reject);
      });
    } catch (error) {
      logger.error('Failed to download file:', error);
      throw new Error('Failed to download file');
    }
  }

  // Get presigned upload URL
  public async getPresignedUploadUrl(
    filename: string,
    _mimeType: string,
    _userId: string,
    options: {
      bucket?: string;
      folder?: string;
      expiresIn?: number;
    } = {}
  ): Promise<{ uploadUrl: string; fileKey: string; fileId: string }> {
    const {
      bucket = this.defaultBucket,
      folder = 'uploads',
      expiresIn = 60 * 60 // 1 hour
    } = options;

    try {
      const fileId = crypto.randomUUID();
      const extension = path.extname(filename);
      const newFilename = `${fileId}${extension}`;
      const key = `${folder}/${newFilename}`;

      const uploadUrl = await this.minioClient.presignedPutObject(
        bucket,
        key,
        expiresIn
      );

      return {
        uploadUrl,
        fileKey: key,
        fileId
      };
    } catch (error) {
      logger.error('Failed to generate presigned URL:', error);
      throw new Error('Failed to generate upload URL');
    }
  }

  // Get presigned download URL
  public async getPresignedDownloadUrl(
    fileId: string,
    userId: string,
    expiresIn: number = 60 * 60 // 1 hour
  ): Promise<string> {
    try {
      const attachment = await db.attachment.findUnique({
        where: { id: fileId },
        include: {
          page: {
            select: {
              authorId: true,
              collaborations: {
                where: { userId },
                select: { canEdit: true }
              }
            }
          }
        }
      });

      if (!attachment) {
        throw new Error('File not found');
      }

      // Check permissions
      const canAccess = attachment.uploadedBy === userId ||
        attachment.page?.authorId === userId ||
        attachment.page?.collaborations.length > 0;

      if (!canAccess) {
        throw new Error('Access denied');
      }

      const key = `uploads/${attachment.filename}`;
      const url = await this.minioClient.presignedGetObject(
        this.defaultBucket,
        key,
        expiresIn
      );

      return url;
    } catch (error) {
      logger.error('Failed to generate download URL:', error);
      throw error;
    }
  }

  // Upload avatar
  public async uploadAvatar(
    file: Express.Multer.File,
    userId: string
  ): Promise<string> {
    try {
      // Validate image file
      if (!file.mimetype.startsWith('image/')) {
        throw new Error('Avatar must be an image file');
      }

      // Check file size (max 5MB for avatars)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Avatar file too large (max 5MB)');
      }

      const filename = `${userId}-${Date.now()}${path.extname(file.originalname)}`;
      const key = `avatars/${filename}`;

      // Upload to MinIO
      await this.minioClient.putObject(
        'avatars',
        key,
        file.buffer,
        file.size,
        { 'Content-Type': file.mimetype }
      );

      // Generate public URL
      const avatarUrl = `${this.publicUrl}/avatars/${key}`;

      // Update user avatar in database
      await db.user.update({
        where: { id: userId },
        data: { avatar: avatarUrl }
      });

      logger.info(`Avatar uploaded for user: ${userId}`);

      return avatarUrl;
    } catch (error) {
      logger.error('Avatar upload failed:', error);
      throw error;
    }
  }

  // Clean up orphaned files
  public async cleanupOrphanedFiles(): Promise<void> {
    try {
      // Get all file keys from MinIO
      const stream = this.minioClient.listObjects(this.defaultBucket, 'uploads/', true);
      const minioFiles: string[] = [];

      stream.on('data', (obj) => {
        if (obj.name) {
          minioFiles.push(obj.name);
        }
      });

      stream.on('end', async () => {
        // Get all files from database
        const dbFiles = await db.attachment.findMany({
          select: { filename: true }
        });

        const dbFilenames = new Set(dbFiles.map((f: any) => `uploads/${f.filename}`));

        // Find orphaned files
        const orphanedFiles = minioFiles.filter(file => !dbFilenames.has(file));

        // Delete orphaned files
        for (const file of orphanedFiles) {
          try {
            await this.minioClient.removeObject(this.defaultBucket, file);
            logger.info(`Cleaned up orphaned file: ${file}`);
          } catch (error) {
            logger.error(`Failed to clean up file ${file}:`, error);
          }
        }

        logger.info(`Cleanup completed. Removed ${orphanedFiles.length} orphaned files.`);
      });

      stream.on('error', (error) => {
        logger.error('Error during cleanup:', error);
      });
    } catch (error) {
      logger.error('Cleanup failed:', error);
    }
  }

  // Get file metadata
  public async getFileMetadata(fileId: string): Promise<any> {
    try {
      const attachment = await db.attachment.findUnique({
        where: { id: fileId }
      });

      if (!attachment) {
        throw new Error('File not found');
      }

      const key = `uploads/${attachment.filename}`;
      const stat = await this.minioClient.statObject(this.defaultBucket, key);

      return {
        ...attachment,
        lastModified: stat.lastModified,
        etag: stat.etag,
        metadata: stat.metaData
      };
    } catch (error) {
      logger.error('Failed to get file metadata:', error);
      throw error;
    }
  }

  // Check storage usage
  public async getStorageUsage(userId: string): Promise<{
    totalFiles: number;
    totalSize: number;
    sizeByType: Record<string, number>;
  }> {
    try {
      const files = await db.attachment.findMany({
        where: { uploadedBy: userId },
        select: { size: true, mimeType: true }
      });

      const totalFiles = files.length;
      const totalSize = files.reduce((sum: any, file: any) => sum + file.size, 0);
      
      const sizeByType: Record<string, number> = {};
      files.forEach((file: any) => {
        const type = file.mimeType.split('/')[0];
        sizeByType[type] = (sizeByType[type] || 0) + file.size;
      });

      return { totalFiles, totalSize, sizeByType };
    } catch (error) {
      logger.error('Failed to get storage usage:', error);
      throw error;
    }
  }

  // Health check
  public async healthCheck(): Promise<boolean> {
    try {
      // Try to list buckets to test connection
      await this.minioClient.listBuckets();
      return true;
    } catch (error) {
      logger.error('MinIO health check failed:', error);
      return false;
    }
  }
}

export const fileStorage = new FileStorageService();
export { FileStorageService };
