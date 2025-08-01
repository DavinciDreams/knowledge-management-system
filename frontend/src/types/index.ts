// User and Authentication Types
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'admin' | 'user';
  preferences: UserPreferences;
  createdAt: Date;
  lastLoginAt: Date;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  timezone: string;
  notifications: NotificationSettings;
  canvas: CanvasSettings;
  voice: VoiceSettings;
  ai: AISettings;
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  mentions: boolean;
  updates: boolean;
}

export interface CanvasSettings {
  defaultTool: string;
  gridVisible: boolean;
  snapToGrid: boolean;
  penPressureSensitivity: number;
  autoSave: boolean;
  autoSaveInterval: number;
}

export interface VoiceSettings {
  inputDevice: string;
  outputDevice: string;
  voiceToText: boolean;
  textToVoice: boolean;
  autoTranscribe: boolean;
  speechRate?: number;
  speechVolume?: number;
  speechVoice?: string;
}

export interface AISettings {
  model: string;
  temperature: number;
  autoSuggestions: boolean;
  contextWindow: number;
}

// Content Types
export interface Note {
  id: string;
  title: string;
  content: string;
  type: 'text' | 'markdown' | 'rich_text';
  tags: string[];
  authorId: string;
  folderId?: string;
  isPublic: boolean;
  version: number;
  wordCount: number;
  readTime: number;
  metadata: ContentMetadata;
  collaborators: Collaborator[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Canvas {
  id: string;
  title: string;
  description?: string;
  data: CanvasData;
  thumbnail?: string;
  authorId: string;
  folderId?: string;
  isPublic: boolean;
  version: number;
  metadata: ContentMetadata;
  collaborators: Collaborator[];
  createdAt: Date;
  updatedAt: Date;
}

export interface VoiceNote {
  id: string;
  title: string;
  audioUrl: string;
  transcription?: string;
  duration: number;
  size: number;
  format: string;
  authorId: string;
  folderId?: string;
  isPublic: boolean;
  metadata: ContentMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebClip {
  id: string;
  title: string;
  url: string;
  content: string;
  excerpt: string;
  thumbnail?: string;
  favicon?: string;
  authorId: string;
  folderId?: string;
  tags: string[];
  metadata: ContentMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContentMetadata {
  entities: Entity[];
  keywords: string[];
  summary?: string;
  sentiment?: number;
  language?: string;
  readingLevel?: number;
}

export interface Entity {
  text: string;
  type: 'person' | 'organization' | 'location' | 'date' | 'event' | 'concept';
  confidence: number;
  linkedId?: string;
}

export interface Collaborator {
  userId: string;
  role: 'owner' | 'editor' | 'viewer';
  permissions: string[];
  addedAt: Date;
}

// Canvas Types
export interface CanvasData {
  objects: CanvasObject[];
  background?: {
    color?: string;
    image?: string;
    grid?: GridSettings;
  };
  viewport: {
    x: number;
    y: number;
    zoom: number;
  };
  layers: CanvasLayer[];
}

export interface CanvasObject {
  id: string;
  type: 'path' | 'text' | 'image' | 'shape' | 'group';
  properties: Record<string, any>;
  transform: {
    x: number;
    y: number;
    rotation: number;
    scaleX: number;
    scaleY: number;
  };
  style: {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    opacity?: number;
  };
  layerId: string;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CanvasLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  order: number;
}

export interface GridSettings {
  visible: boolean;
  snapToGrid: boolean;
  size: number;
  color: string;
  opacity: number;
}

export interface DrawingTool {
  type: 'pen' | 'highlighter' | 'eraser' | 'text' | 'shape' | 'select';
  size: number;
  color: string;
  opacity: number;
  pressure?: number;
  brushSize?: number;
  options?: Record<string, any>;
}

// Export format for canvas
export type ExportFormat = 'png' | 'jpeg' | 'svg' | 'pdf' | 'json';

// Canvas save/load data structure
export interface CanvasSaveData {
  canvasData: any;
  width: number;
  height: number;
  backgroundColor: string;
  zoom: number;
  panX: number;
  panY: number;
}

// Knowledge Graph Types
export interface GraphNode {
  id: string;
  label: string;
  type: 'note' | 'canvas' | 'voice' | 'web_clip' | 'entity' | 'tag';
  properties: Record<string, any>;
  x?: number;
  y?: number;
  color?: string;
  size?: number;
  metadata: {
    contentId?: string;
    entityType?: string;
    importance: number;
    lastAccessed: Date;
    connections: number;
  };
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'reference' | 'similarity' | 'entity_mention' | 'tag' | 'collaboration';
  weight: number;
  properties: Record<string, any>;
  createdAt: Date;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: {
    totalNodes: number;
    totalEdges: number;
    clusters: GraphCluster[];
    lastUpdated: Date;
  };
}

export interface GraphCluster {
  id: string;
  label: string;
  nodeIds: string[];
  color: string;
  centroid: { x: number; y: number };
}

// Search Types
export interface SearchQuery {
  text: string;
  filters?: SearchFilters;
  options?: SearchOptions;
}

export interface SearchFilters {
  contentType?: ('note' | 'canvas' | 'voice' | 'web_clip')[];
  authorId?: string[];
  tags?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  folderId?: string[];
  isPublic?: boolean;
  sources?: string[];
  aiGenerated?: boolean;
  hasAttachments?: boolean;
  language?: string;
  minRelevance?: number;
  sortBy?: 'relevance' | 'date' | 'title' | 'author';
  sortOrder?: 'asc' | 'desc';
}

export interface SearchOptions {
  fuzzy?: boolean;
  semantic?: boolean;
  includeContent?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: 'relevance' | 'date' | 'title' | 'author';
  sortOrder?: 'asc' | 'desc';
}

export interface SearchResult {
  id: string;
  type: 'note' | 'canvas' | 'voice' | 'web_clip';
  title: string;
  excerpt: string;
  highlights: SearchHighlight[];
  score: number;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
  metadata: ContentMetadata;
}

export interface SearchHighlight {
  field: string;
  fragments: string[];
}

export interface SearchSuggestion {
  text: string;
  type: 'query' | 'tag' | 'entity' | 'content';
  count?: number;
}

// Voice Types
export interface VoiceRecording {
  id: string;
  blob: Blob;
  url: string;
  duration: number;
  startTime: Date;
  endTime: Date;
  transcription?: VoiceTranscription;
}

export interface VoiceTranscription {
  text: string;
  confidence: number;
  words: TranscriptWord[];
  language: string;
  model: string;
}

export interface TranscriptWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
}

export interface VoiceCommand {
  type: 'create_note' | 'search' | 'navigate' | 'canvas_action' | 'system_action';
  parameters: Record<string, any>;
  confidence: number;
}

// AI Types
export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  attachments?: AIAttachment[];
  metadata?: {
    model: string;
    tokens: number;
    confidence: number;
    sources: string[];
  };
}

export interface AIAttachment {
  type: 'image' | 'document' | 'link' | 'canvas' | 'voice';
  url: string;
  name: string;
  size?: number;
  contentId?: string;
}

export interface AIContext {
  recentContent: ContentSummary[];
  currentCanvas?: string;
  activeNote?: string;
  searchQuery?: string;
  userPreferences: UserPreferences;
}

export interface ContentSummary {
  id: string;
  type: 'note' | 'canvas' | 'voice' | 'web_clip';
  title: string;
  summary: string;
  keywords: string[];
  lastAccessed: Date;
}

// Collaboration Types
export interface CollaborationParticipant {
  id: string;
  userId: string;
  name: string;
  avatar?: string;
  cursor?: Cursor;
  isActive: boolean;
  joinedAt: Date;
  lastActivity: Date;
  permissions: string[];
}

export interface CollaborationOperation {
  id: string;
  type: 'insert' | 'delete' | 'update' | 'move' | 'cursor' | 'selection';
  userId: string;
  data: any;
  timestamp: Date;
  applied: boolean;
  position?: number;
  targetId?: string;
}

export interface CollaborationSession {
  id: string;
  roomId: string;
  userId: string;
  participants: CollaborationParticipant[];
  operations: CollaborationOperation[];
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'paused' | 'ended';
}

export interface CollaborationEvent {
  id: string;
  type: string;
  userId?: string;
  data?: any;
  payload?: any;
  timestamp: number;
}

export interface Cursor {
  x: number;
  y: number;
  color?: string;
  [key: string]: any;
}

export interface Awareness {
  [key: string]: any;
}

// Calendar Types
export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  attendees?: string[];
  type: 'meeting' | 'deadline' | 'reminder' | 'note_reference';
  linkedContentId?: string;
  linkedContentType?: 'note' | 'canvas' | 'voice' | 'web_clip';
  color: string;
  isAllDay: boolean;
  recurring?: RecurrenceRule;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  until?: Date;
  count?: number;
  daysOfWeek?: number[];
  dayOfMonth?: number;
}

// System Types
export interface SystemStats {
  users: {
    total: number;
    active: number;
    new: number;
  };
  content: {
    notes: number;
    canvases: number;
    voiceNotes: number;
    webClips: number;
  };
  storage: {
    used: number;
    limit: number;
    percentage: number;
  };
  performance: {
    responseTime: number;
    uptime: number;
    errorRate: number;
  };
}

export interface SystemNotification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  actions?: NotificationAction[];
  userId?: string;
  read: boolean;
  createdAt: Date;
  expiresAt?: Date;
}

export interface NotificationAction {
  label: string;
  action: string;
  url?: string;
  style: 'primary' | 'secondary' | 'danger';
}

// Folder and Organization Types
export interface Folder {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
  authorId: string;
  isShared: boolean;
  color?: string;
  icon?: string;
  contentCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  description?: string;
  usageCount: number;
  createdAt: Date;
  lastUsed: Date;
}

// Export and Import Types
export interface ExportRequest {
  id: string;
  format: 'json' | 'markdown' | 'pdf' | 'html' | 'docx';
  contentIds?: string[];
  contentTypes?: ('note' | 'canvas' | 'voice' | 'web_clip')[];
  includeMetadata: boolean;
  includeMedia: boolean;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  downloadUrl?: string;
  createdAt: Date;
  completedAt?: Date;
  errorMessage?: string;
}

export interface ImportRequest {
  id: string;
  source: 'file' | 'url' | 'clipboard' | 'browser_extension';
  format: 'json' | 'markdown' | 'pdf' | 'html' | 'docx' | 'txt';
  folderId?: string;
  tags?: string[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  itemsProcessed: number;
  itemsTotal: number;
  createdAt: Date;
  completedAt?: Date;
  errorMessage?: string;
  results?: ImportResult[];
}

export interface ImportResult {
  originalName: string;
  contentId: string;
  contentType: 'note' | 'canvas' | 'voice' | 'web_clip';
  status: 'success' | 'failed' | 'skipped';
  errorMessage?: string;
}

// API Response Types
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: APIError;
  pagination?: PaginationInfo;
}

export interface APIError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// WebSocket Types
export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
}

export interface WebSocketEvent {
  type: 'collaboration' | 'notification' | 'system' | 'user_activity';
  action: string;
  data: any;
  recipients?: string[];
}

// Error Types
export interface AppError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  stack?: string;
}

// Utility Types
export type ContentType = 'note' | 'canvas' | 'voice' | 'web_clip';
export type UserRole = 'admin' | 'user';
export type Theme = 'light' | 'dark' | 'system';
export type SortOrder = 'asc' | 'desc';
export type ViewMode = 'grid' | 'list' | 'kanban' | 'timeline';

// Form Types
export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'file' | 'date' | 'number';
  required: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
  };
}

export interface FormData {
  [key: string]: any;
}

export interface FormErrors {
  [key: string]: string;
}

// State Types for Zustand stores
export interface AppState {
  user: User | null;
  theme: Theme;
  notifications: SystemNotification[];
  isLoading: boolean;
  error: AppError | null;
}

export interface CanvasState {
  activeCanvas: Canvas | null;
  tool: DrawingTool;
  zoom: number;
  isDrawing: boolean;
  history: CanvasOperation[];
  historyIndex: number;
  collaborators: CollaborationParticipant[];
  canvasData?: any;
  panX?: number;
  panY?: number;
  setBrushSize?: (size: number) => void;
  setBrushColor?: (color: string) => void;
  setFillColor?: (color: string) => void;
}

export interface CanvasOperation {
  type: 'add' | 'remove' | 'update' | 'move';
  objectId: string;
  data: any;
  timestamp: Date;
}

export interface VoiceState {
  isRecording: boolean;
  currentRecording: VoiceRecording | null;
  recordings: VoiceRecording[];
  transcriptions: Map<string, VoiceTranscription>;
  isProcessing: boolean;
  error: string | null;
}

export interface SearchState {
  query: string;
  results: SearchResult[];
  suggestions: SearchSuggestion[];
  filters: SearchFilters;
  isLoading: boolean;
  error: string | null;
  recentQueries: string[];
}

export interface CollaborationState {
  activeSessions: Map<string, CollaborationSession>;
  pendingOperations: CollaborationOperation[];
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
  participants: Map<string, CollaborationParticipant>;
  cursors: Record<string, any>;
  awareness: Record<string, any>;
  events: any[];
  roomId: string | null;
}
