import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Canvas, DrawingTool, CanvasOperation, CollaborationParticipant } from '../types';

interface CanvasState {
  // Active canvas
  activeCanvas: Canvas | null;
  
  // Drawing state
  tool: DrawingTool;
  zoom: number;
  pan: { x: number; y: number };
  isDrawing: boolean;
  isPanning: boolean;
  
  // Selection state
  selectedObjects: string[];
  
  // History state
  history: CanvasOperation[];
  historyIndex: number;
  maxHistorySize: number;
  
  // Collaboration state
  collaborators: CollaborationParticipant[];
  isCollaborating: boolean;
  
  // UI state
  showGrid: boolean;
  snapToGrid: boolean;
  gridSize: number;
  showLayers: boolean;
  showToolbar: boolean;
  
  // Actions
  setActiveCanvas: (canvas: Canvas | null) => void;
  setTool: (tool: DrawingTool) => void;
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  setIsDrawing: (drawing: boolean) => void;
  setIsPanning: (panning: boolean) => void;
  setSelectedObjects: (objects: string[]) => void;
  addToSelection: (objectId: string) => void;
  removeFromSelection: (objectId: string) => void;
  clearSelection: () => void;
  
  // History actions
  addToHistory: (operation: CanvasOperation) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clearHistory: () => void;
  
  // Collaboration actions
  setCollaborators: (collaborators: CollaborationParticipant[]) => void;
  addCollaborator: (collaborator: CollaborationParticipant) => void;
  removeCollaborator: (userId: string) => void;
  updateCollaborator: (userId: string, updates: Partial<CollaborationParticipant>) => void;
  
  // UI actions
  setShowGrid: (show: boolean) => void;
  setSnapToGrid: (snap: boolean) => void;
  setGridSize: (size: number) => void;
  toggleLayers: () => void;
  toggleToolbar: () => void;
  
  // Canvas actions
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  fitToScreen: () => void;
  centerCanvas: () => void;
  
  // Tool property setters
  setBrushSize: (size: number) => void;
  setBrushColor: (color: string) => void;
  setFillColor: (color: string) => void;
  
  // Reset
  reset: () => void;
}

const defaultTool: DrawingTool = {
  type: 'pen',
  size: 2,
  color: '#000000',
  opacity: 1,
  pressure: 1,
};

const initialState = {
  activeCanvas: null,
  tool: defaultTool,
  zoom: 1,
  pan: { x: 0, y: 0 },
  isDrawing: false,
  isPanning: false,
  selectedObjects: [],
  history: [],
  historyIndex: -1,
  maxHistorySize: 100,
  collaborators: [],
  isCollaborating: false,
  showGrid: true,
  snapToGrid: false,
  gridSize: 20,
  showLayers: false,
  showToolbar: true,
};

export const useCanvasStore = create<CanvasState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      setActiveCanvas: (canvas) => 
        set({ activeCanvas: canvas }, false, 'setActiveCanvas'),

      setTool: (tool) => 
        set({ tool }, false, 'setTool'),

      setZoom: (zoom) => 
        set({ zoom: Math.max(0.1, Math.min(5, zoom)) }, false, 'setZoom'),

      setPan: (pan) => 
        set({ pan }, false, 'setPan'),

      setIsDrawing: (drawing) => 
        set({ isDrawing: drawing }, false, 'setIsDrawing'),

      setIsPanning: (panning) => 
        set({ isPanning: panning }, false, 'setIsPanning'),

      setSelectedObjects: (objects) => 
        set({ selectedObjects: objects }, false, 'setSelectedObjects'),

      addToSelection: (objectId) => 
        set((state) => ({
          selectedObjects: [...state.selectedObjects, objectId]
        }), false, 'addToSelection'),

      removeFromSelection: (objectId) => 
        set((state) => ({
          selectedObjects: state.selectedObjects.filter(id => id !== objectId)
        }), false, 'removeFromSelection'),

      clearSelection: () => 
        set({ selectedObjects: [] }, false, 'clearSelection'),

      addToHistory: (operation) => 
        set((state) => {
          const newHistory = state.history.slice(0, state.historyIndex + 1);
          newHistory.push(operation);
          
          // Limit history size
          if (newHistory.length > state.maxHistorySize) {
            newHistory.shift();
          }
          
          return {
            history: newHistory,
            historyIndex: newHistory.length - 1
          };
        }, false, 'addToHistory'),

      undo: () => 
        set((state) => {
          if (state.historyIndex > 0) {
            return { historyIndex: state.historyIndex - 1 };
          }
          return state;
        }, false, 'undo'),

      redo: () => 
        set((state) => {
          if (state.historyIndex < state.history.length - 1) {
            return { historyIndex: state.historyIndex + 1 };
          }
          return state;
        }, false, 'redo'),

      canUndo: () => {
        const state = get();
        return state.historyIndex > 0;
      },

      canRedo: () => {
        const state = get();
        return state.historyIndex < state.history.length - 1;
      },

      clearHistory: () => 
        set({ history: [], historyIndex: -1 }, false, 'clearHistory'),

      setCollaborators: (collaborators) => 
        set({ 
          collaborators,
          isCollaborating: collaborators.length > 1
        }, false, 'setCollaborators'),

      addCollaborator: (collaborator) => 
        set((state) => ({
          collaborators: [...state.collaborators, collaborator],
          isCollaborating: true
        }), false, 'addCollaborator'),

      removeCollaborator: (userId) => 
        set((state) => {
          const collaborators = state.collaborators.filter(c => c.userId !== userId);
          return {
            collaborators,
            isCollaborating: collaborators.length > 1
          };
        }, false, 'removeCollaborator'),

      updateCollaborator: (userId, updates) => 
        set((state) => ({
          collaborators: state.collaborators.map(c => 
            c.userId === userId ? { ...c, ...updates } : c
          )
        }), false, 'updateCollaborator'),

      setShowGrid: (show) => 
        set({ showGrid: show }, false, 'setShowGrid'),

      setSnapToGrid: (snap) => 
        set({ snapToGrid: snap }, false, 'setSnapToGrid'),

      setGridSize: (size) => 
        set({ gridSize: Math.max(5, Math.min(100, size)) }, false, 'setGridSize'),

      toggleLayers: () => 
        set((state) => ({ showLayers: !state.showLayers }), false, 'toggleLayers'),

      toggleToolbar: () => 
        set((state) => ({ showToolbar: !state.showToolbar }), false, 'toggleToolbar'),

      zoomIn: () => 
        set((state) => ({ zoom: Math.min(5, state.zoom * 1.2) }), false, 'zoomIn'),

      zoomOut: () => 
        set((state) => ({ zoom: Math.max(0.1, state.zoom / 1.2) }), false, 'zoomOut'),

      resetZoom: () => 
        set({ zoom: 1, pan: { x: 0, y: 0 } }, false, 'resetZoom'),

      fitToScreen: () => {
        // TODO: Implement fit to screen logic based on canvas content
        set({ zoom: 1, pan: { x: 0, y: 0 } }, false, 'fitToScreen');
      },

      centerCanvas: () => 
        set({ pan: { x: 0, y: 0 } }, false, 'centerCanvas'),

      setBrushSize: (size) => 
        set((state) => ({
          tool: { ...state.tool, size, brushSize: size }
        }), false, 'setBrushSize'),

      setBrushColor: (color) => 
        set((state) => ({
          tool: { ...state.tool, color }
        }), false, 'setBrushColor'),

      setFillColor: (color) => 
        set((state) => ({
          tool: { ...state.tool, options: { ...state.tool.options, fillColor: color } }
        }), false, 'setFillColor'),

      reset: () => 
        set(initialState, false, 'reset'),
    }),
    {
      name: 'canvas-store',
    }
  )
);
