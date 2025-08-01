import { apiClient, ApiResponse } from './api';
import { SearchResult, SearchFilters } from '../types';

export interface SearchService {
  search: (query: string, filters?: Partial<SearchFilters>, page?: number) => Promise<SearchResult[]>;
  searchSimilar: (content: string, limit?: number) => Promise<SearchResult[]>;
  searchByEntity: (entityType: string, entityValue: string) => Promise<SearchResult[]>;
  getSuggestions: (query: string) => Promise<string[]>;
  getRecentSearches: () => Promise<string[]>;
  saveSearch: (query: string, results: SearchResult[]) => Promise<void>;
  indexContent: (content: any) => Promise<void>;
  reindexAll: () => Promise<void>;
}

class SearchServiceImpl implements SearchService {
  async search(
    query: string, 
    filters: Partial<SearchFilters> = {}, 
    page: number = 1
  ): Promise<SearchResult[]> {
    const params = {
      q: query,
      page: page.toString(),
      limit: '20',
      ...this.serializeFilters(filters)
    };

    const response = await apiClient.get<{
      results: SearchResult[];
      total: number;
      hasMore: boolean;
    }>('/search', params);

    if (!response.success) {
      throw new Error(response.error || 'Search failed');
    }

    return response.data?.results || [];
  }

  async searchSimilar(content: string, limit: number = 10): Promise<SearchResult[]> {
    const response = await apiClient.post<{
      results: SearchResult[];
    }>('/search/similar', {
      content,
      limit
    });

    if (!response.success) {
      throw new Error(response.error || 'Similar search failed');
    }

    return response.data?.results || [];
  }

  async searchByEntity(entityType: string, entityValue: string): Promise<SearchResult[]> {
    const response = await apiClient.get<{
      results: SearchResult[];
    }>('/search/entity', {
      type: entityType,
      value: entityValue
    });

    if (!response.success) {
      throw new Error(response.error || 'Entity search failed');
    }

    return response.data?.results || [];
  }

  async getSuggestions(query: string): Promise<string[]> {
    if (query.length < 2) return [];

    const response = await apiClient.get<{
      suggestions: string[];
    }>('/search/suggestions', { q: query });

    if (!response.success) {
      console.warn('Failed to get suggestions:', response.error);
      return [];
    }

    return response.data?.suggestions || [];
  }

  async getRecentSearches(): Promise<string[]> {
    const response = await apiClient.get<{
      searches: string[];
    }>('/search/recent');

    if (!response.success) {
      console.warn('Failed to get recent searches:', response.error);
      return [];
    }

    return response.data?.searches || [];
  }

  async saveSearch(query: string, results: SearchResult[]): Promise<void> {
    await apiClient.post('/search/history', {
      query,
      resultCount: results.length,
      timestamp: new Date().toISOString()
    });
  }

  async indexContent(content: any): Promise<void> {
    const response = await apiClient.post('/search/index', content);

    if (!response.success) {
      throw new Error(response.error || 'Content indexing failed');
    }
  }

  async reindexAll(): Promise<void> {
    const response = await apiClient.post('/search/reindex');

    if (!response.success) {
      throw new Error(response.error || 'Reindexing failed');
    }
  }

  private serializeFilters(filters: Partial<SearchFilters>): Record<string, string> {
    const params: Record<string, string> = {};

    if (filters.contentType?.length) {
      params.contentType = filters.contentType.join(',');
    }

    if (filters.tags?.length) {
      params.tags = filters.tags.join(',');
    }

    if (filters.authorId?.length) {
      params.authorId = filters.authorId.join(',');
    }

    if (filters.sources?.length) {
      params.sources = filters.sources.join(',');
    }

    if (filters.dateRange) {
      if (filters.dateRange.start) {
        params.startDate = filters.dateRange.start.toISOString();
      }
      if (filters.dateRange.end) {
        params.endDate = filters.dateRange.end.toISOString();
      }
    }

    if (filters.aiGenerated !== null && filters.aiGenerated !== undefined) {
      params.aiGenerated = filters.aiGenerated.toString();
    }

    if (filters.hasAttachments !== null && filters.hasAttachments !== undefined) {
      params.hasAttachments = filters.hasAttachments.toString();
    }

    if (filters.language) {
      params.language = filters.language;
    }

    if (filters.minRelevance !== undefined) {
      params.minRelevance = filters.minRelevance.toString();
    }

    if (filters.sortBy) {
      params.sortBy = filters.sortBy;
    }

    if (filters.sortOrder) {
      params.sortOrder = filters.sortOrder;
    }

    return params;
  }
}

export const searchService = new SearchServiceImpl();
