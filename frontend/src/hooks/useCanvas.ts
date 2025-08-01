import { useEffect, useCallback, useRef, useState } from 'react';
import { useCanvasStore } from '../stores';
import { canvasService } from '../services';
import { CanvasObject, DrawingTool, CanvasState, ExportFormat } from '../types';
import { fabric } from 'fabric';

export interface UseCanvasProps {
  canvasId?: string;
  width?: number;
  height?: number;
  backgroundColor?: string;
  enableCollaboration?: boolean;
  autoSave?: boolean;
  autoSaveInterval?: number;
}

export interface UseCanvasReturn {
  canvas: fabric.Canvas | null;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isLoading: boolean;
  isDirty: boolean;
  selectedTool: DrawingTool;
  selectedObjects: CanvasObject[];
  zoomLevel: number;
  panX: number;
  panY: number;
  
  // Tool actions
  setTool: (tool: DrawingTool) => void;
  setBrushSize: (size: number) => void;
  setBrushColor: (color: string) => void;
  setFillColor: (color: string) => void;
  
  // Canvas actions
  undo: () => void;
  redo: () => void;
  clear: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomToFit: () => void;
  resetZoom: () => void;
  pan: (deltaX: number, deltaY: number) => void;
  
  // Object actions
  deleteSelected: () => void;
  duplicateSelected: () => void;
  selectAll: () => void;
  deselectAll: () => void;
  bringToFront: () => void;
  sendToBack: () => void;
  
  // File operations
  save: () => Promise<void>;
  load: (canvasId: string) => Promise<void>;
  export: (format: ExportFormat) => Promise<Blob>;
  import: (file: File) => Promise<void>;
  
  // Collaboration
  broadcastChange: (change: any) => void;
  applyRemoteChange: (change: any) => void;
}

export function useCanvas({
  canvasId,
  width = 800,
  height = 600,
  backgroundColor = '#ffffff',
  enableCollaboration = false,
  autoSave = true,
  autoSaveInterval = 5000
}: UseCanvasProps = {}): UseCanvasReturn {
  const store = useCanvasStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvas, setCanvas] = useState<fabric.Canvas | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const autoSaveTimer = useRef<NodeJS.Timeout>();
  const lastSaveState = useRef<string>('');

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const fabricCanvas = new fabric.Canvas(canvasRef.current, {
      width,
      height,
      backgroundColor,
      selection: true,
      preserveObjectStacking: true,
      enableRetinaScaling: true,
      allowTouchScrolling: false
    });

    // Set up pen input with pressure sensitivity
    if ('PointerEvent' in window) {
      fabricCanvas.on('mouse:down', (event) => {
        if (event.e instanceof PointerEvent && event.e.pointerType === 'pen') {
          const pressure = event.e.pressure || 0.5;
          // Adjust brush size based on pressure
          if (store.tool.type === 'pen') {
            const baseBrushSize = store.tool.brushSize || 5;
            fabricCanvas.freeDrawingBrush.width = baseBrushSize * pressure;
          }
        }
      });
    }

    // Canvas event handlers
    fabricCanvas.on('path:created', (event) => {
      setIsDirty(true);
      
      if (enableCollaboration) {
        broadcastChange({
          type: 'object:added',
          object: event.target?.toObject(),
          timestamp: Date.now()
        });
      }
    });

    fabricCanvas.on('object:added', () => setIsDirty(true));
    fabricCanvas.on('object:modified', () => setIsDirty(true));
    fabricCanvas.on('object:removed', () => setIsDirty(true));

    // Selection events
    fabricCanvas.on('selection:created', (event) => {
      const objects = event.selected || [];
      store.setSelectedObjects(
        objects.map(obj => (obj as any).id || obj.toObject().id || crypto.randomUUID())
      );
    });

    fabricCanvas.on('selection:updated', (event) => {
      const objects = event.selected || [];
      store.setSelectedObjects(
        objects.map(obj => (obj as any).id || obj.toObject().id || crypto.randomUUID())
      );
    });

    fabricCanvas.on('selection:cleared', () => {
      store.setSelectedObjects([]);
    });

    setCanvas(fabricCanvas);

    return () => {
      fabricCanvas.dispose();
    };
  }, [canvasRef, width, height, backgroundColor, enableCollaboration, store]);

  // Load canvas data
  useEffect(() => {
    if (canvas && canvasId) {
      load(canvasId);
    }
  }, [canvas, canvasId]);

  // Auto-save functionality
  useEffect(() => {
    if (!autoSave || !canvas || !canvasId) return;

    if (isDirty) {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }

      autoSaveTimer.current = setTimeout(() => {
        save();
      }, autoSaveInterval);
    }

    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
    };
  }, [isDirty, autoSave, autoSaveInterval, canvas, canvasId]);

  // Tool management
  const setTool = useCallback((tool: DrawingTool) => {
    if (!canvas) return;

    store.setTool(tool);

    switch (tool.type) {
      case 'select':
        canvas.isDrawingMode = false;
        canvas.selection = true;
        canvas.defaultCursor = 'default';
        break;
        
      case 'pen':
        canvas.isDrawingMode = true;
        canvas.selection = false;
        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
        canvas.freeDrawingBrush.width = tool.size || 5;
        canvas.freeDrawingBrush.color = tool.color || '#000000';
        break;
        
      case 'eraser':
        canvas.isDrawingMode = false;
        canvas.selection = true;
        // Eraser: Remove selected objects or implement custom eraser logic here
        break;
        
      case 'text':
        canvas.isDrawingMode = false;
        canvas.selection = true;
        canvas.defaultCursor = 'text';
        break;
        
      default:
        canvas.isDrawingMode = false;
        canvas.selection = true;
        break;
    }
  }, [canvas, store]);

  const setBrushSize = useCallback((size: number) => {
    if (canvas && canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.width = size;
    }
    store.setBrushSize(size);
  }, [canvas, store]);

  const setBrushColor = useCallback((color: string) => {
    if (canvas && canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.color = color;
    }
    store.setBrushColor(color);
  }, [canvas, store]);

  const setFillColor = useCallback((color: string) => {
    store.setFillColor(color);
  }, [store]);

  // History operations
  const undo = useCallback(() => {
    if (!canvas) return;
    
    store.undo();
    // Optionally, you may want to reload the canvas state here if your undo logic requires it.
    // For now, just mark as dirty and re-render.
    setIsDirty(true);
    canvas.requestRenderAll();
  }, [canvas, store]);

  const redo = useCallback(() => {
    if (!canvas) return;
    
    store.redo();
    // Optionally, reload the canvas state here if your redo logic requires it.
    setIsDirty(true);
    canvas.requestRenderAll();
  }, [canvas, store]);

  // Canvas operations
  const clear = useCallback(() => {
    if (!canvas) return;
    
    canvas.clear();
    canvas.backgroundColor = backgroundColor;
    setIsDirty(true);
  }, [canvas, backgroundColor]);

  const zoomIn = useCallback(() => {
    if (!canvas) return;
    
    const zoom = Math.min(canvas.getZoom() * 1.2, 5);
    canvas.setZoom(zoom);
    store.setZoom(zoom);
  }, [canvas, store]);

  const zoomOut = useCallback(() => {
    if (!canvas) return;
    
    const zoom = Math.max(canvas.getZoom() / 1.2, 0.1);
    canvas.setZoom(zoom);
    store.setZoom(zoom);
  }, [canvas, store]);

  const zoomToFit = useCallback(() => {
    if (!canvas) return;
    
    const objects = canvas.getObjects();
    if (objects.length === 0) return;

    const group = new fabric.Group(objects);
    const groupBounds = group.getBoundingRect();
    
    const canvasWidth = canvas.getWidth();
    const canvasHeight = canvas.getHeight();
    
    const scaleX = canvasWidth / groupBounds.width;
    const scaleY = canvasHeight / groupBounds.height;
    const zoom = Math.min(scaleX, scaleY) * 0.9;
    
    canvas.setZoom(zoom);
    canvas.absolutePan(new fabric.Point(
      (canvasWidth - groupBounds.width * zoom) / 2,
      (canvasHeight - groupBounds.height * zoom) / 2
    ));
    
    store.setZoom(zoom);
  }, [canvas, store]);

  const resetZoom = useCallback(() => {
    if (!canvas) return;
    
    canvas.setZoom(1);
    canvas.absolutePan(new fabric.Point(0, 0));
    store.setZoom(1);
    store.setPan({ x: 0, y: 0 });
  }, [canvas, store]);

  const pan = useCallback((deltaX: number, deltaY: number) => {
    if (!canvas) return;
    
    const vpt = canvas.viewportTransform;
    if (vpt) {
      vpt[4] += deltaX;
      vpt[5] += deltaY;
      canvas.requestRenderAll();
      store.setPan({ x: vpt[4], y: vpt[5] });
    }
  }, [canvas, store]);

  // Object operations
  const deleteSelected = useCallback(() => {
    if (!canvas) return;
    
    const activeObjects = canvas.getActiveObjects();
    activeObjects.forEach(obj => canvas.remove(obj));
    canvas.discardActiveObject();
    setIsDirty(true);
  }, [canvas]);

  const duplicateSelected = useCallback(() => {
    if (!canvas) return;
    
    const activeObjects = canvas.getActiveObjects();
    activeObjects.forEach(obj => {
      obj.clone((cloned: fabric.Object) => {
        cloned.set({
          left: (cloned.left || 0) + 10,
          top: (cloned.top || 0) + 10
        });
        canvas.add(cloned);
        setIsDirty(true);
      });
    });
  }, [canvas]);

  const selectAll = useCallback(() => {
    if (!canvas) return;
    
    const selection = new fabric.ActiveSelection(canvas.getObjects(), {
      canvas: canvas
    });
    canvas.setActiveObject(selection);
    canvas.requestRenderAll();
  }, [canvas]);

  const deselectAll = useCallback(() => {
    if (!canvas) return;
    
    canvas.discardActiveObject();
    canvas.requestRenderAll();
  }, [canvas]);

  const bringToFront = useCallback(() => {
    if (!canvas) return;
    
    const activeObjects = canvas.getActiveObjects();
    activeObjects.forEach(obj => canvas.bringToFront(obj));
    setIsDirty(true);
  }, [canvas]);

  const sendToBack = useCallback(() => {
    if (!canvas) return;
    
    const activeObjects = canvas.getActiveObjects();
    activeObjects.forEach(obj => canvas.sendToBack(obj));
    setIsDirty(true);
  }, [canvas]);

  // File operations
  const save = useCallback(async () => {
    if (!canvas || !canvasId) return;
    
    setIsLoading(true);
    try {
      const canvasData = canvas.toJSON();
      const currentState = JSON.stringify(canvasData);
      
      if (currentState !== lastSaveState.current) {
        await canvasService.saveCanvas(canvasId, {
          canvasData: canvas.toJSON(),
          width: canvas.getWidth(),
          height: canvas.getHeight(),
          backgroundColor: canvas.backgroundColor as string,
          zoom: canvas.getZoom(),
          panX: canvas.viewportTransform?.[4] || 0,
          panY: canvas.viewportTransform?.[5] || 0
        });
        
        lastSaveState.current = currentState;
        setIsDirty(false);
      }
    } catch (error) {
      console.error('Failed to save canvas:', error);
    } finally {
      setIsLoading(false);
    }
  }, [canvas, canvasId]);

  const load = useCallback(async (loadCanvasId: string) => {
    if (!canvas) return;
    
    setIsLoading(true);
    try {
      const canvasState = await canvasService.loadCanvas(loadCanvasId);
      
      await new Promise<void>((resolve) => {
        canvas.loadFromJSON(canvasState.canvasData, () => {
          canvas.setZoom(canvasState.zoom || 1);
          if (typeof canvasState.panX === 'number' && typeof canvasState.panY === 'number') {
            canvas.absolutePan(new fabric.Point(canvasState.panX, canvasState.panY));
          }
          canvas.renderAll();
          resolve();
        });
      });
      
      lastSaveState.current = JSON.stringify(canvasState.canvasData);
      setIsDirty(false);
    } catch (error) {
      console.error('Failed to load canvas:', error);
    } finally {
      setIsLoading(false);
    }
  }, [canvas]);

  const exportCanvas = useCallback(async (format: ExportFormat): Promise<Blob> => {
    if (!canvas || !canvasId) {
      throw new Error('Canvas not available');
    }
    
    return canvasService.exportCanvas(canvasId, format);
  }, [canvas, canvasId]);

  const importCanvas = useCallback(async (file: File) => {
    if (!canvas) return;
    
    setIsLoading(true);
    try {
      const result = await canvasService.importCanvas(file);
      await load(result.id);
    } catch (error) {
      console.error('Failed to import canvas:', error);
    } finally {
      setIsLoading(false);
    }
  }, [canvas, load]);

  // Collaboration
  const broadcastChange = useCallback((change: any) => {
    // This would be implemented with the collaboration system
    console.log('Broadcasting change:', change);
  }, []);

  const applyRemoteChange = useCallback((change: any) => {
    if (!canvas) return;
    
    // Apply remote changes to the canvas
    console.log('Applying remote change:', change);
  }, [canvas]);

  return {
    canvas,
    canvasRef,
    isLoading,
    isDirty,
    selectedTool: store.tool,
    selectedObjects: store.selectedObjects
      .map(id => {
        const obj = canvas?.getObjects().find(obj => (obj as any).id === id) as any;
        if (!obj) return null;
        // Map fabric.Object to CanvasObject
        return {
          id: obj.id,
          type: obj.type,
          properties: obj.properties || {},
          transform: obj.transform || {
            x: obj.left || 0,
            y: obj.top || 0,
            rotation: obj.angle || 0,
            scaleX: obj.scaleX || 1,
            scaleY: obj.scaleY || 1
          },
          style: obj.style || {
            fill: obj.fill,
            stroke: obj.stroke,
            strokeWidth: obj.strokeWidth,
            opacity: obj.opacity
          },
          layerId: obj.layerId || '',
          authorId: obj.authorId || '',
          createdAt: obj.createdAt || new Date(),
          updatedAt: obj.updatedAt || new Date()
        } as CanvasObject;
      })
      .filter((obj): obj is CanvasObject => !!obj),
    zoomLevel: store.zoom,
    panX: store.pan.x,
    panY: store.pan.y,
    
    // Tool actions
    setTool,
    setBrushSize,
    setBrushColor,
    setFillColor,
    
    // Canvas actions
    undo,
    redo,
    clear,
    zoomIn,
    zoomOut,
    zoomToFit,
    resetZoom,
    pan,
    
    // Object actions
    deleteSelected,
    duplicateSelected,
    selectAll,
    deselectAll,
    bringToFront,
    sendToBack,
    
    // File operations
    save,
    load,
    export: exportCanvas,
    import: importCanvas,
    
    // Collaboration
    broadcastChange,
    applyRemoteChange
  };
}
