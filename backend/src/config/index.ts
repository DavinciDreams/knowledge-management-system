import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

// Configuration schema validation
const configSchema = z.object({
  // Environment
  env: z.enum(['development', 'production', 'test']).default('development'),
  port: z.coerce.number().default(3001),
  
  // Database
  database: z.object({
    url: z.string().url(),
  }),
  
  // Redis
  redis: z.object({
    url: z.string().url(),
    prefix: z.string().default('kms'),
  }),
  
  // JWT
  jwt: z.object({
    secret: z.string().min(32),
    expiresIn: z.string().default('7d'),
    refreshExpiresIn: z.string().default('30d'),
  }),
  
  // CORS
  cors: z.object({
    origin: z.union([z.string(), z.array(z.string())]).default('http://localhost:3000'),
  }),
  
  // File Storage
  storage: z.object({
    provider: z.enum(['local', 's3']).default('local'),
    local: z.object({
      uploadPath: z.string().default('./uploads'),
      publicUrl: z.string().default('http://localhost:3001/uploads'),
    }),
    s3: z.object({
      bucket: z.string().optional(),
      region: z.string().optional(),
      accessKeyId: z.string().optional(),
      secretAccessKey: z.string().optional(),
    }),
  }),
  
  // External Services
  services: z.object({
    // Search
    elasticsearch: z.object({
      url: z.string().url().optional(),
      username: z.string().optional(),
      password: z.string().optional(),
    }),
    
    // Vector Search
    weaviate: z.object({
      url: z.string().url().optional(),
      apiKey: z.string().optional(),
    }),
    
    // Graph Database
    neo4j: z.object({
      url: z.string().url().optional(),
      username: z.string().optional(),
      password: z.string().optional(),
    }),
    
    // AI Services
    openai: z.object({
      apiKey: z.string().optional(),
      model: z.string().default('gpt-4'),
    }),
    
    // Voice Processing
    whisper: z.object({
      apiKey: z.string().optional(),
      model: z.string().default('whisper-1'),
    }),
    
    // Email
    smtp: z.object({
      host: z.string().optional(),
      port: z.coerce.number().optional(),
      username: z.string().optional(),
      password: z.string().optional(),
      from: z.string().email().optional(),
    }),
  }),
  
  // Security
  security: z.object({
    bcryptRounds: z.coerce.number().default(12),
    rateLimitMax: z.coerce.number().default(100),
    rateLimitWindowMs: z.coerce.number().default(15 * 60 * 1000), // 15 minutes
  }),
  
  // Collaboration
  collaboration: z.object({
    maxSessionDuration: z.coerce.number().default(24 * 60 * 60 * 1000), // 24 hours
    maxParticipants: z.coerce.number().default(50),
    operationBatchSize: z.coerce.number().default(100),
  }),
  
  // File Processing
  processing: z.object({
    maxFileSize: z.coerce.number().default(100 * 1024 * 1024), // 100MB
    supportedTypes: z.array(z.string()).default([
      'application/pdf',
      'text/plain',
      'text/markdown',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'audio/mpeg',
      'audio/wav',
      'audio/ogg',
      'video/mp4',
      'video/webm',
    ]),
    tempDir: z.string().default('./temp'),
  }),
  
  // Logging
  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    format: z.enum(['json', 'simple']).default('simple'),
  }),
});

// Create configuration object
const createConfig = () => {
  const rawConfig = {
    env: process.env['NODE_ENV'],
    port: process.env['PORT'],
    
    database: {
      url: process.env['DATABASE_URL'],
    },
    
    redis: {
      url: process.env['REDIS_URL'],
      prefix: process.env['REDIS_PREFIX'],
    },
    
    jwt: {
      secret: process.env['JWT_SECRET'],
      expiresIn: process.env['JWT_EXPIRES_IN'],
      refreshExpiresIn: process.env['JWT_REFRESH_EXPIRES_IN'],
    },
    
    cors: {
      origin: process.env['CORS_ORIGIN']?.split(',') || process.env['CORS_ORIGIN'],
    },
    
    storage: {
      provider: process.env['STORAGE_PROVIDER'],
      local: {
        uploadPath: process.env['STORAGE_LOCAL_PATH'],
        publicUrl: process.env['STORAGE_LOCAL_URL'],
      },
      s3: {
        bucket: process.env['S3_BUCKET'],
        region: process.env['S3_REGION'],
        accessKeyId: process.env['S3_ACCESS_KEY_ID'],
        secretAccessKey: process.env['S3_SECRET_ACCESS_KEY'],
      },
    },
    
    services: {
      elasticsearch: {
        url: process.env['ELASTICSEARCH_URL'],
        username: process.env['ELASTICSEARCH_USERNAME'],
        password: process.env['ELASTICSEARCH_PASSWORD'],
      },
        weaviate: {
        url: process.env['WEAVIATE_URL'],
        apiKey: process.env['WEAVIATE_API_KEY'],
      },
      
      neo4j: {
        url: process.env['NEO4J_URL'],
        username: process.env['NEO4J_USERNAME'],
        password: process.env['NEO4J_PASSWORD'],
      },
      
      openai: {
        apiKey: process.env['OPENAI_API_KEY'],
        model: process.env['OPENAI_MODEL'],
      },
      
      whisper: {
        apiKey: process.env['WHISPER_API_KEY'],
        model: process.env['WHISPER_MODEL'],
      },
      
      smtp: {
        host: process.env['SMTP_HOST'],
        port: process.env['SMTP_PORT'],
        username: process.env['SMTP_USERNAME'],
        password: process.env['SMTP_PASSWORD'],
        from: process.env['SMTP_FROM'],
      },
    },
    
    security: {
      bcryptRounds: process.env['BCRYPT_ROUNDS'],
      rateLimitMax: process.env['RATE_LIMIT_MAX'],
      rateLimitWindowMs: process.env['RATE_LIMIT_WINDOW_MS'],
    },
    
    collaboration: {
      maxSessionDuration: process.env['COLLABORATION_MAX_SESSION_DURATION'],
      maxParticipants: process.env['COLLABORATION_MAX_PARTICIPANTS'],
      operationBatchSize: process.env['COLLABORATION_OPERATION_BATCH_SIZE'],
    },
    
    processing: {
      maxFileSize: process.env['PROCESSING_MAX_FILE_SIZE'],
      supportedTypes: process.env['PROCESSING_SUPPORTED_TYPES']?.split(','),
      tempDir: process.env['PROCESSING_TEMP_DIR'],
    },
    
    logging: {
      level: process.env['LOG_LEVEL'],
      format: process.env['LOG_FORMAT'],
    },
  };

  try {
    return configSchema.parse(rawConfig);
  } catch (error) {
    console.error('Configuration validation failed:', error);
    throw new Error('Invalid configuration');
  }
};

export const config = createConfig();
export type Config = typeof config;
