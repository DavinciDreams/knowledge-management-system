/// <reference types="vite/client" />

// API Configuration and Base Client

export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  AI_SERVICE_URL: import.meta.env.VITE_AI_SERVICE_URL || 'http://localhost:8000',
  WEBSOCKET_URL: import.meta.env.VITE_WS_URL || 'ws://localhost:3001',
  TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000
};

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    hasMore?: boolean;
  };
}

export interface ApiError {
  status: number;
  message: string;
  code?: string;
  details?: any;
}

class ApiClient {
  private baseURL: string;
  private timeout: number;
  private retryAttempts: number;
  private retryDelay: number;

  constructor(config = API_CONFIG) {
    this.baseURL = config.BASE_URL;
    this.timeout = config.TIMEOUT;
    this.retryAttempts = config.RETRY_ATTEMPTS;
    this.retryDelay = config.RETRY_DELAY;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    
    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };    // Add auth token if available
    const token = localStorage.getItem('auth_token');
    if (token) {
      (defaultHeaders as any)['Authorization'] = `Bearer ${token}`;
    }

    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers
      },
      signal: AbortSignal.timeout(this.timeout)
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;

    } catch (error) {
      console.error(`API Error (${url}):`, error);

      // Retry logic for network errors
      if (retryCount < this.retryAttempts && this.shouldRetry(error)) {
        await this.delay(this.retryDelay * Math.pow(2, retryCount));
        return this.request<T>(endpoint, options, retryCount + 1);
      }

      throw this.createApiError(error, url);
    }
  }

  private shouldRetry(error: any): boolean {
    // Retry on network errors, timeouts, and 5xx server errors
    return (
      error.name === 'NetworkError' ||
      error.name === 'TimeoutError' ||
      (error.status >= 500 && error.status < 600)
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private createApiError(error: any, url: string): ApiError {
    return {
      status: error.status || 0,
      message: error.message || 'Network error occurred',
      code: error.code,
      details: { url, originalError: error }
    };
  }

  // HTTP Methods
  async get<T>(endpoint: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    const url = params ? `${endpoint}?${new URLSearchParams(params)}` : endpoint;
    return this.request<T>(url, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  async patch<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  // File upload
  async upload<T>(endpoint: string, file: File, additionalData?: Record<string, any>): Promise<ApiResponse<T>> {
    const formData = new FormData();
    formData.append('file', file);
    
    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, typeof value === 'string' ? value : JSON.stringify(value));
      });
    }

    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return this.request<T>(endpoint, {
      method: 'POST',
      body: formData,
      headers
    });
  }

  // Download file
  async download(endpoint: string, filename?: string): Promise<Blob> {
    const url = `${this.baseURL}${endpoint}`;
    const token = localStorage.getItem('auth_token');
    
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(this.timeout)
    });

    if (!response.ok) {
      throw new Error(`Download failed: ${response.statusText}`);
    }

    const blob = await response.blob();
    
    // Auto-download if filename provided
    if (filename) {
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    }

    return blob;
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Helper function for handling API errors in components
export const handleApiError = (error: ApiError, showNotification?: (message: string, type: 'error') => void) => {
  console.error('API Error:', error);
  
  const message = error.message || 'An unexpected error occurred';
  
  if (showNotification) {
    showNotification(message, 'error');
  }
  
  // Handle authentication errors
  if (error.status === 401) {
    localStorage.removeItem('auth_token');
    window.location.href = '/login';
  }
  
  return error;
};
