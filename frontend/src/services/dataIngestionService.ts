import { apiClient, ApiResponse } from './api';

export interface DataIngestionService {
  ingestFile: (file: File, options?: IngestionOptions) => Promise<IngestionResult>;
  ingestUrl: (url: string, options?: IngestionOptions) => Promise<IngestionResult>;
  ingestEmail: (emailData: EmailData, options?: IngestionOptions) => Promise<IngestionResult>;
  batchIngest: (items: IngestionItem[]) => Promise<BatchIngestionResult>;
  getIngestionJobs: () => Promise<IngestionJob[]>;
  getIngestionJob: (jobId: string) => Promise<IngestionJob>;
  cancelIngestionJob: (jobId: string) => Promise<void>;
  retryIngestionJob: (jobId: string) => Promise<IngestionJob>;
  getIngestionStats: () => Promise<IngestionStats>;
  getSupportedFormats: () => Promise<SupportedFormat[]>;
  extractEntities: (content: string) => Promise<EntityExtractionResult>;
  processDocument: (documentId: string, options?: ProcessingOptions) => Promise<ProcessingResult>;
}

export interface IngestionOptions {
  extractEntities?: boolean;
  generateSummary?: boolean;
  detectLanguage?: boolean;
  ocrEnabled?: boolean;
  preserveFormatting?: boolean;
  tags?: string[];
  category?: string;
  priority?: 'low' | 'medium' | 'high';
  metadata?: Record<string, any>;
}

export interface EmailData {
  subject: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  date: string;
  body: string;
  attachments?: File[];
  headers?: Record<string, string>;
}

export interface IngestionItem {
  type: 'file' | 'url' | 'email' | 'text';
  data: File | string | EmailData;
  options?: IngestionOptions;
}

export interface IngestionResult {
  id: string;
  status: 'success' | 'partial' | 'failed';
  message?: string;
  extractedData: ExtractedData;
  metadata: IngestionMetadata;
  warnings?: string[];
  errors?: string[];
}

export interface BatchIngestionResult {
  jobId: string;
  totalItems: number;
  successCount: number;
  failureCount: number;
  results: IngestionResult[];
  status: 'completed' | 'partial' | 'failed';
}

export interface IngestionJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  type: 'single' | 'batch';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  progress: number;
  totalItems: number;
  processedItems: number;
  failedItems: number;
  currentItem?: string;
  estimatedTimeRemaining?: number;
  results?: IngestionResult[];
  error?: string;
}

export interface IngestionStats {
  totalIngested: number;
  todayIngested: number;
  weekIngested: number;
  monthIngested: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  averageProcessingTime: number;
  topSources: Array<{ source: string; count: number }>;
  recentJobs: IngestionJob[];
}

export interface SupportedFormat {
  extension: string;
  mimeType: string;
  category: 'document' | 'image' | 'audio' | 'video' | 'archive' | 'other';
  description: string;
  maxSize: number;
  features: {
    textExtraction: boolean;
    ocr: boolean;
    metadata: boolean;
    preview: boolean;
  };
}

export interface ExtractedData {
  title?: string;
  content: string;
  summary?: string;
  language?: string;
  author?: string;
  createdDate?: string;
  modifiedDate?: string;
  wordCount: number;
  characterCount: number;
  pageCount?: number;
  entities: ExtractedEntity[];
  topics: ExtractedTopic[];
  keywords: string[];
  links: ExtractedLink[];
  images?: ExtractedImage[];
  attachments?: ExtractedAttachment[];
}

export interface IngestionMetadata {
  originalFileName?: string;
  fileSize?: number;
  mimeType?: string;
  source: string;
  ingestedAt: string;
  ingestedBy: string;
  processingTime: number;
  version: string;
  checksum?: string;
}

export interface EntityExtractionResult {
  entities: ExtractedEntity[];
  confidence: number;
  processingTime: number;
  language: string;
}

export interface ExtractedEntity {
  type: 'person' | 'organization' | 'location' | 'date' | 'money' | 'misc';
  value: string;
  start: number;
  end: number;
  confidence: number;
  context?: string;
  linkedData?: any;
}

export interface ExtractedTopic {
  topic: string;
  confidence: number;
  keywords: string[];
}

export interface ExtractedLink {
  url: string;
  text: string;
  type: 'internal' | 'external';
}

export interface ExtractedImage {
  url: string;
  alt?: string;
  caption?: string;
  width?: number;
  height?: number;
  format?: string;
}

export interface ExtractedAttachment {
  name: string;
  size: number;
  type: string;
  url: string;
}

export interface ProcessingOptions {
  reprocess?: boolean;
  updateExisting?: boolean;
  extractImages?: boolean;
  generateThumbnails?: boolean;
  enhancedOCR?: boolean;
}

export interface ProcessingResult {
  documentId: string;
  status: 'success' | 'partial' | 'failed';
  extractedData: ExtractedData;
  processingTime: number;
  warnings?: string[];
  errors?: string[];
}

class DataIngestionServiceImpl implements DataIngestionService {
  async ingestFile(file: File, options?: IngestionOptions): Promise<IngestionResult> {
    const formData = new FormData();
    formData.append('file', file);
    if (options) {
      formData.append('options', JSON.stringify(options));
    }

    const response = await apiClient.upload<{ result: IngestionResult }>('/ingest/file', file, options);

    if (!response.success) {
      throw new Error(response.error || 'File ingestion failed');
    }

    return response.data!.result;
  }

  async ingestUrl(url: string, options?: IngestionOptions): Promise<IngestionResult> {
    const response = await apiClient.post<{ result: IngestionResult }>('/ingest/url', {
      url,
      options
    });

    if (!response.success) {
      throw new Error(response.error || 'URL ingestion failed');
    }

    return response.data!.result;
  }

  async ingestEmail(emailData: EmailData, options?: IngestionOptions): Promise<IngestionResult> {
    const response = await apiClient.post<{ result: IngestionResult }>('/ingest/email', {
      emailData,
      options
    });

    if (!response.success) {
      throw new Error(response.error || 'Email ingestion failed');
    }

    return response.data!.result;
  }

  async batchIngest(items: IngestionItem[]): Promise<BatchIngestionResult> {
    const response = await apiClient.post<{ result: BatchIngestionResult }>('/ingest/batch', {
      items
    });

    if (!response.success) {
      throw new Error(response.error || 'Batch ingestion failed');
    }

    return response.data!.result;
  }

  async getIngestionJobs(): Promise<IngestionJob[]> {
    const response = await apiClient.get<{ jobs: IngestionJob[] }>('/ingest/jobs');

    if (!response.success) {
      throw new Error(response.error || 'Failed to get ingestion jobs');
    }

    return response.data?.jobs || [];
  }

  async getIngestionJob(jobId: string): Promise<IngestionJob> {
    const response = await apiClient.get<{ job: IngestionJob }>(`/ingest/jobs/${jobId}`);

    if (!response.success) {
      throw new Error(response.error || 'Failed to get ingestion job');
    }

    return response.data!.job;
  }

  async cancelIngestionJob(jobId: string): Promise<void> {
    const response = await apiClient.post(`/ingest/jobs/${jobId}/cancel`);

    if (!response.success) {
      throw new Error(response.error || 'Failed to cancel ingestion job');
    }
  }

  async retryIngestionJob(jobId: string): Promise<IngestionJob> {
    const response = await apiClient.post<{ job: IngestionJob }>(`/ingest/jobs/${jobId}/retry`);

    if (!response.success) {
      throw new Error(response.error || 'Failed to retry ingestion job');
    }

    return response.data!.job;
  }

  async getIngestionStats(): Promise<IngestionStats> {
    const response = await apiClient.get<{ stats: IngestionStats }>('/ingest/stats');

    if (!response.success) {
      throw new Error(response.error || 'Failed to get ingestion stats');
    }

    return response.data!.stats;
  }

  async getSupportedFormats(): Promise<SupportedFormat[]> {
    const response = await apiClient.get<{ formats: SupportedFormat[] }>('/ingest/formats');

    if (!response.success) {
      throw new Error(response.error || 'Failed to get supported formats');
    }

    return response.data?.formats || [];
  }

  async extractEntities(content: string): Promise<EntityExtractionResult> {
    const response = await apiClient.post<{ result: EntityExtractionResult }>('/ingest/entities', {
      content
    });

    if (!response.success) {
      throw new Error(response.error || 'Entity extraction failed');
    }

    return response.data!.result;
  }

  async processDocument(documentId: string, options?: ProcessingOptions): Promise<ProcessingResult> {
    const response = await apiClient.post<{ result: ProcessingResult }>(
      `/ingest/documents/${documentId}/process`,
      options || {}
    );

    if (!response.success) {
      throw new Error(response.error || 'Document processing failed');
    }

    return response.data!.result;
  }
}

export const dataIngestionService = new DataIngestionServiceImpl();
