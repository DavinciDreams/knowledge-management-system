import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { SearchResult, SearchFilters, SearchState, SearchSuggestion } from '../types';

interface SearchStore extends SearchState {
  searchHistory: SearchResult[];
  // Actions
  setQuery: (query: string) => void;
  setFilters: (filters: Partial<SearchFilters>) => void;
  setResults: (results: SearchResult[]) => void;
  setIsLoading: (loading: boolean) => void;
  setSelectedResult: (result: SearchResult | null) => void;
  addRecentQuery: (query: string) => void;
  clearRecentQueries: () => void;
  setSuggestions: (suggestions: SearchSuggestion[]) => void;
  setSearchHistory: (history: SearchResult[]) => void;

  // Search actions
  search: (query: string, filters?: Partial<SearchFilters>) => Promise<void>;
  clearSearch: () => void;
  searchSimilar: (content: string) => Promise<void>;
  searchByEntity: (entityType: string, entityValue: string) => Promise<void>;
}

const defaultFilters: SearchFilters = {};

export const useSearchStore = create<SearchStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        query: '',
        results: [],
        suggestions: [],
        filters: defaultFilters,
        isLoading: false,
        error: null,
        recentQueries: [],
        selectedResult: null,
        searchHistory: [],
        // Add any other SearchState properties as needed

        // Actions
        setQuery: (query: string) => {
          set({ query }, false, 'search/setQuery');
        },

        setFilters: (newFilters: Partial<SearchFilters>) => {
          const currentFilters = get().filters;
          const updatedFilters = { ...currentFilters, ...newFilters };
          set({ filters: updatedFilters }, false, 'search/setFilters');
        },

        setResults: (results: SearchResult[]) => {
          set({ results }, false, 'search/setResults');
        },

        setIsLoading: (loading: boolean) => {
          set({ isLoading: loading }, false, 'search/setIsLoading');
        },

        setSelectedResult: (result: SearchResult | null) => {
          set({ selectedResult: result } as Partial<SearchStore>, false, 'search/setSelectedResult');
        },

        addRecentQuery: (query: string) => {
          const { recentQueries } = get();
          const filtered: string[] = recentQueries.filter((s: string) => s !== query);
          const updated = [query, ...filtered].slice(0, 10);
          set({ recentQueries: updated }, false, 'search/addRecentQuery');
        },

        clearRecentQueries: () => {
          set({ recentQueries: [] }, false, 'search/clearRecentQueries');
        },

        setSuggestions: (suggestions: SearchSuggestion[]) => {
          set({ suggestions }, false, 'search/setSuggestions');
        },

        setSearchHistory: (history: SearchResult[]) => {
          set({ searchHistory: history }, false, 'search/setSearchHistory');
        },

        // Search actions
        search: async (query: string, filters?: Partial<SearchFilters>) => {
          const state = get();

          set({ isLoading: true, query }, false, 'search/search/start');

          if (filters) {
            state.setFilters(filters);
          }

          try {
            // TODO: Replace with actual API call
            const searchFilters = filters ? { ...state.filters, ...filters } : state.filters;

            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 500));

            // Mock results - replace with actual API integration
            const mockResults: SearchResult[] = [
              {
                id: '1',
                type: 'note',
                title: `Results for "${query}"`,
                excerpt: 'This is a mock search result...',
                highlights: [
                  {
                    field: 'excerpt',
                    fragments: [`This is a mock search result for <mark>${query}</mark>`]
                  }
                ],
                score: 0.95,
                authorId: 'system',
                createdAt: new Date(),
                updatedAt: new Date(),
                metadata: {
                  entities: [],
                  keywords: []
                }
              }
            ];

            set({
              results: mockResults,
              isLoading: false,
              error: null
            }, false, 'search/search/success');

            // Add to recent queries
            state.addRecentQuery(query);

          } catch (error: any) {
            console.error('Search failed:', error);
            set({
              results: [],
              isLoading: false,
              error: error?.message ?? 'Search failed'
            }, false, 'search/search/error');
          }
        },

        clearSearch: () => {
          set({
            query: '',
            results: [],
            isLoading: false,
            error: null
          }, false, 'search/clearSearch');
        },

        searchSimilar: async (content: string) => {
          const state = get();
          set({ isLoading: true }, false, 'search/searchSimilar/start');

          try {
            // TODO: Implement semantic similarity search
            await new Promise(resolve => setTimeout(resolve, 300));

            // Mock similar results
            const similarResults: SearchResult[] = [
              {
                id: 'similar-1',
                type: 'note',
                title: 'Similar Content Found',
                excerpt: 'This content is semantically similar...',
                highlights: [],
                score: 0.85,
                authorId: 'system',
                createdAt: new Date(),
                updatedAt: new Date(),
                metadata: {
                  entities: [],
                  keywords: []
                }
              }
            ];

            set({
              results: similarResults,
              isLoading: false,
              error: null
            }, false, 'search/searchSimilar/success');

          } catch (error: any) {
            console.error('Similar search failed:', error);
            set({
              results: [],
              isLoading: false,
              error: error?.message ?? 'Similar search failed'
            }, false, 'search/searchSimilar/error');
          }
        },

        searchByEntity: async (entityType: string, entityValue: string) => {
          const state = get();
          set({ isLoading: true }, false, 'search/searchByEntity/start');

          try {
            // TODO: Implement entity-based search
            await new Promise(resolve => setTimeout(resolve, 400));

            // Mock entity results
            const entityResults: SearchResult[] = [
              {
                id: 'entity-1',
                type: 'note',
                title: `Content with ${entityType}: ${entityValue}`,
                excerpt: `This content contains the ${entityType} "${entityValue}"...`,
                highlights: [
                  {
                    field: 'excerpt',
                    fragments: [`Content with <mark>${entityValue}</mark>`]
                  }
                ],
                score: 0.90,
                authorId: 'system',
                createdAt: new Date(),
                updatedAt: new Date(),
                metadata: {
                  entities: [],
                  keywords: []
                }
              }
            ];

            set({
              results: entityResults,
              isLoading: false,
              error: null
            }, false, 'search/searchByEntity/success');

          } catch (error: any) {
            console.error('Entity search failed:', error);
            set({
              results: [],
              isLoading: false,
              error: error?.message ?? 'Entity search failed'
            }, false, 'search/searchByEntity/error');
          }
        }
      }),
      {
        name: 'search-store',
      }
    )
  )
);
