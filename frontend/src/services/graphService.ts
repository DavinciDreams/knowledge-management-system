import { apiClient, ApiResponse, API_CONFIG } from './api';
import { GraphNode, GraphEdge } from '../types';

export interface GraphService {
  getGraph: (filters?: GraphFilters) => Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }>;
  addNode: (node: Omit<GraphNode, 'id'>) => Promise<GraphNode>;
  updateNode: (id: string, updates: Partial<GraphNode>) => Promise<GraphNode>;
  deleteNode: (id: string) => Promise<void>;
  addEdge: (edge: Omit<GraphEdge, 'id'>) => Promise<GraphEdge>;
  updateEdge: (id: string, updates: Partial<GraphEdge>) => Promise<GraphEdge>;
  deleteEdge: (id: string) => Promise<void>;
  findPath: (fromId: string, toId: string) => Promise<GraphNode[]>;
  findNeighbors: (nodeId: string, depth?: number) => Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }>;
  searchNodes: (query: string) => Promise<GraphNode[]>;
  getCluster: (nodeId: string) => Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }>;
  analyzeGraph: () => Promise<GraphAnalytics>;
  exportGraph: (format: 'json' | 'gexf' | 'graphml') => Promise<Blob>;
  importGraph: (file: File) => Promise<void>;
}

export interface GraphFilters {
  nodeTypes?: string[];
  edgeTypes?: string[];
  dateRange?: { start: Date; end: Date };
  tags?: string[];
  maxNodes?: number;
  minConnections?: number;
}

export interface GraphAnalytics {
  nodeCount: number;
  edgeCount: number;
  averageDegree: number;
  clustering: number;
  diameter: number;
  communities: Array<{
    id: string;
    nodes: string[];
    size: number;
  }>;
  centralNodes: Array<{
    id: string;
    label: string;
    betweenness: number;
    closeness: number;
    degree: number;
  }>;
}

class GraphServiceImpl implements GraphService {
  async getGraph(filters?: GraphFilters): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
    const params = filters ? this.serializeFilters(filters) : {};
    
    const response = await apiClient.get<{
      nodes: GraphNode[];
      edges: GraphEdge[];
    }>('/graph', params);

    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch graph');
    }

    return response.data || { nodes: [], edges: [] };
  }

  async addNode(nodeData: Omit<GraphNode, 'id'>): Promise<GraphNode> {
    const response = await apiClient.post<{ node: GraphNode }>('/graph/nodes', nodeData);

    if (!response.success) {
      throw new Error(response.error || 'Failed to create node');
    }

    return response.data!.node;
  }

  async updateNode(id: string, updates: Partial<GraphNode>): Promise<GraphNode> {
    const response = await apiClient.patch<{ node: GraphNode }>(`/graph/nodes/${id}`, updates);

    if (!response.success) {
      throw new Error(response.error || 'Failed to update node');
    }

    return response.data!.node;
  }

  async deleteNode(id: string): Promise<void> {
    const response = await apiClient.delete(`/graph/nodes/${id}`);

    if (!response.success) {
      throw new Error(response.error || 'Failed to delete node');
    }
  }

  async addEdge(edgeData: Omit<GraphEdge, 'id'>): Promise<GraphEdge> {
    const response = await apiClient.post<{ edge: GraphEdge }>('/graph/edges', edgeData);

    if (!response.success) {
      throw new Error(response.error || 'Failed to create edge');
    }

    return response.data!.edge;
  }

  async updateEdge(id: string, updates: Partial<GraphEdge>): Promise<GraphEdge> {
    const response = await apiClient.patch<{ edge: GraphEdge }>(`/graph/edges/${id}`, updates);

    if (!response.success) {
      throw new Error(response.error || 'Failed to update edge');
    }

    return response.data!.edge;
  }

  async deleteEdge(id: string): Promise<void> {
    const response = await apiClient.delete(`/graph/edges/${id}`);

    if (!response.success) {
      throw new Error(response.error || 'Failed to delete edge');
    }
  }

  async findPath(fromId: string, toId: string): Promise<GraphNode[]> {
    const response = await apiClient.get<{ path: GraphNode[] }>('/graph/path', {
      from: fromId,
      to: toId
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to find path');
    }

    return response.data?.path || [];
  }

  async findNeighbors(
    nodeId: string, 
    depth: number = 1
  ): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
    const response = await apiClient.get<{
      nodes: GraphNode[];
      edges: GraphEdge[];
    }>(`/graph/nodes/${nodeId}/neighbors`, {
      depth: depth.toString()
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to find neighbors');
    }

    return response.data || { nodes: [], edges: [] };
  }

  async searchNodes(query: string): Promise<GraphNode[]> {
    const response = await apiClient.get<{ nodes: GraphNode[] }>('/graph/search', {
      q: query
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to search nodes');
    }

    return response.data?.nodes || [];
  }

  async getCluster(nodeId: string): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
    const response = await apiClient.get<{
      nodes: GraphNode[];
      edges: GraphEdge[];
    }>(`/graph/nodes/${nodeId}/cluster`);

    if (!response.success) {
      throw new Error(response.error || 'Failed to get cluster');
    }

    return response.data || { nodes: [], edges: [] };
  }

  async analyzeGraph(): Promise<GraphAnalytics> {
    const response = await apiClient.get<{ analytics: GraphAnalytics }>('/graph/analytics');

    if (!response.success) {
      throw new Error(response.error || 'Failed to analyze graph');
    }

    return response.data!.analytics;
  }

  async exportGraph(format: 'json' | 'gexf' | 'graphml'): Promise<Blob> {
    return apiClient.download(`/graph/export?format=${format}`, `graph.${format}`);
  }

  async importGraph(file: File): Promise<void> {
    const response = await apiClient.upload('/graph/import', file);

    if (!response.success) {
      throw new Error(response.error || 'Failed to import graph');
    }
  }

  private serializeFilters(filters: GraphFilters): Record<string, string> {
    const params: Record<string, string> = {};

    if (filters.nodeTypes?.length) {
      params.nodeTypes = filters.nodeTypes.join(',');
    }

    if (filters.edgeTypes?.length) {
      params.edgeTypes = filters.edgeTypes.join(',');
    }

    if (filters.tags?.length) {
      params.tags = filters.tags.join(',');
    }

    if (filters.dateRange) {
      if (filters.dateRange.start) {
        params.startDate = filters.dateRange.start.toISOString();
      }
      if (filters.dateRange.end) {
        params.endDate = filters.dateRange.end.toISOString();
      }
    }

    if (filters.maxNodes) {
      params.maxNodes = filters.maxNodes.toString();
    }

    if (filters.minConnections) {
      params.minConnections = filters.minConnections.toString();
    }

    return params;
  }
}

export const graphService = new GraphServiceImpl();
