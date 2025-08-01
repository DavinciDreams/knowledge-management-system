import { apiClient, ApiResponse, API_CONFIG } from './api';
import { CanvasState, CanvasSaveData, CanvasObject, DrawingTool, ExportFormat } from '../types';

export interface CanvasService {
  saveCanvas: (canvasId: string, canvasData: CanvasSaveData) => Promise<void>;
  loadCanvas: (canvasId: string) => Promise<CanvasSaveData>;
  createCanvas: (name: string, template?: string) => Promise<{ id: string; canvas: CanvasSaveData }>;
  deleteCanvas: (canvasId: string) => Promise<void>;
  listCanvases: (filters?: CanvasFilters) => Promise<CanvasSummary[]>;
  duplicateCanvas: (canvasId: string, newName: string) => Promise<{ id: string; canvas: CanvasSaveData }>;
  exportCanvas: (canvasId: string, format: ExportFormat) => Promise<Blob>;
  importCanvas: (file: File) => Promise<{ id: string; canvas: CanvasSaveData }>;
  shareCanvas: (canvasId: string, shareSettings: ShareSettings) => Promise<{ shareUrl: string }>;
  getCanvasHistory: (canvasId: string) => Promise<CanvasVersion[]>;
  restoreCanvasVersion: (canvasId: string, versionId: string) => Promise<CanvasSaveData>;
  addCollaborator: (canvasId: string, userId: string, permissions: CollaborationPermissions) => Promise<void>;
  removeCollaborator: (canvasId: string, userId: string) => Promise<void>;
}

export interface CanvasFilters {
  tags?: string[];
  createdBy?: string;
  dateRange?: { start: Date; end: Date };
  shared?: boolean;
  template?: boolean;
}

export interface CanvasSummary {
  id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  createdAt: string;
  modifiedAt: string;
  createdBy: string;
  tags: string[];
  isShared: boolean;
  isTemplate: boolean;
  collaboratorCount: number;
  objectCount: number;
}

export interface ShareSettings {
  isPublic: boolean;
  allowComments: boolean;
  allowEditing: boolean;
  expiresAt?: string;
  password?: string;
}

export interface CanvasVersion {
  id: string;
  canvasId: string;
  versionNumber: number;
  createdAt: string;
  createdBy: string;
  description?: string;
  changes: string[];
  thumbnail?: string;
}

export interface CollaborationPermissions {
  canEdit: boolean;
  canComment: boolean;
  canShare: boolean;
  canExport: boolean;
}

class CanvasServiceImpl implements CanvasService {
  async saveCanvas(canvasId: string, canvasData: CanvasSaveData): Promise<void> {
    const response = await apiClient.put(`/canvas/${canvasId}`, {
      ...canvasData,
      modifiedAt: new Date().toISOString()
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to save canvas');
    }
  }
  async loadCanvas(canvasId: string): Promise<CanvasSaveData> {
    const response = await apiClient.get<{ canvas: CanvasSaveData }>(`/canvas/${canvasId}`);

    if (!response.success) {
      throw new Error(response.error || 'Failed to load canvas');
    }

    return response.data!.canvas;
  }
  async createCanvas(name: string, template?: string): Promise<{ id: string; canvas: CanvasSaveData }> {
    const response = await apiClient.post<{
      id: string;
      canvas: CanvasSaveData;
    }>('/canvas', {
      name,
      template,
      createdAt: new Date().toISOString()
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to create canvas');
    }

    return response.data!;
  }

  async deleteCanvas(canvasId: string): Promise<void> {
    const response = await apiClient.delete(`/canvas/${canvasId}`);

    if (!response.success) {
      throw new Error(response.error || 'Failed to delete canvas');
    }
  }

  async listCanvases(filters?: CanvasFilters): Promise<CanvasSummary[]> {
    const params = filters ? this.serializeFilters(filters) : {};
    
    const response = await apiClient.get<{ canvases: CanvasSummary[] }>('/canvas', params);

    if (!response.success) {
      throw new Error(response.error || 'Failed to list canvases');
    }

    return response.data?.canvases || [];
  }
  async duplicateCanvas(canvasId: string, newName: string): Promise<{ id: string; canvas: CanvasSaveData }> {
    const response = await apiClient.post<{
      id: string;
      canvas: CanvasSaveData;
    }>(`/canvas/${canvasId}/duplicate`, {
      name: newName
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to duplicate canvas');
    }

    return response.data!;
  }

  async exportCanvas(canvasId: string, format: ExportFormat): Promise<Blob> {
    return apiClient.download(`/canvas/${canvasId}/export?format=${format}`, `canvas.${format}`);
  }
  async importCanvas(file: File): Promise<{ id: string; canvas: CanvasSaveData }> {
    const response = await apiClient.upload<{
      id: string;
      canvas: CanvasSaveData;
    }>('/canvas/import', file);

    if (!response.success) {
      throw new Error(response.error || 'Failed to import canvas');
    }

    return response.data!;
  }

  async shareCanvas(canvasId: string, shareSettings: ShareSettings): Promise<{ shareUrl: string }> {
    const response = await apiClient.post<{ shareUrl: string }>(`/canvas/${canvasId}/share`, shareSettings);

    if (!response.success) {
      throw new Error(response.error || 'Failed to share canvas');
    }

    return response.data!;
  }

  async getCanvasHistory(canvasId: string): Promise<CanvasVersion[]> {
    const response = await apiClient.get<{ versions: CanvasVersion[] }>(`/canvas/${canvasId}/history`);

    if (!response.success) {
      throw new Error(response.error || 'Failed to get canvas history');
    }

    return response.data?.versions || [];
  }
  async restoreCanvasVersion(canvasId: string, versionId: string): Promise<CanvasSaveData> {
    const response = await apiClient.post<{ canvas: CanvasSaveData }>(
      `/canvas/${canvasId}/restore`,
      { versionId }
    );

    if (!response.success) {
      throw new Error(response.error || 'Failed to restore canvas version');
    }

    return response.data!.canvas;
  }

  async addCollaborator(
    canvasId: string, 
    userId: string, 
    permissions: CollaborationPermissions
  ): Promise<void> {
    const response = await apiClient.post(`/canvas/${canvasId}/collaborators`, {
      userId,
      permissions
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to add collaborator');
    }
  }

  async removeCollaborator(canvasId: string, userId: string): Promise<void> {
    const response = await apiClient.delete(`/canvas/${canvasId}/collaborators/${userId}`);

    if (!response.success) {
      throw new Error(response.error || 'Failed to remove collaborator');
    }
  }

  private serializeFilters(filters: CanvasFilters): Record<string, string> {
    const params: Record<string, string> = {};

    if (filters.tags?.length) {
      params.tags = filters.tags.join(',');
    }

    if (filters.createdBy) {
      params.createdBy = filters.createdBy;
    }

    if (filters.dateRange) {
      if (filters.dateRange.start) {
        params.startDate = filters.dateRange.start.toISOString();
      }
      if (filters.dateRange.end) {
        params.endDate = filters.dateRange.end.toISOString();
      }
    }

    if (filters.shared !== undefined) {
      params.shared = filters.shared.toString();
    }

    if (filters.template !== undefined) {
      params.template = filters.template.toString();
    }

    return params;
  }
}

export const canvasService = new CanvasServiceImpl();
