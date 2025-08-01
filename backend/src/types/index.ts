import { Request } from 'express';

export interface User {
  readonly id: string;
  readonly email: string;
  readonly username: string;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly avatar: string | null;
  readonly emailVerified: boolean;
  readonly settings?: any;
}

export interface AuthenticatedRequest extends Request {
  user: User;
}

// Additional type definitions for the application
export interface PaginationQuery {
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SearchQuery extends PaginationQuery {
  q?: string;
  type?: string;
  filters?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// File upload types
export interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  filename: string;
  path: string;
}

// Canvas types
export interface CanvasElement {
  id: string;
  type: 'shape' | 'text' | 'image' | 'pen';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  zIndex: number;
  data: any;
  style: any;
}

// Knowledge graph types
export interface KnowledgeNode {
  id: string;
  type: string;
  title: string;
  content: string;
  metadata: any;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeRelationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  weight: number;
  metadata: any;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

// Collaboration types
export interface CollaborationSession {
  id: string;
  resourceId: string;
  resourceType: string;
  participants: string[];
  createdAt: Date;
  expiresAt: Date;
}

// Voice types
export interface VoiceNote {
  id: string;
  title: string;
  audioUrl: string;
  transcript?: string;
  duration: number;
  language: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}
