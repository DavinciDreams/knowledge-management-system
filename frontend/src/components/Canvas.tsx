import React, { useEffect, useRef, useState, useCallback } from 'react'
import { fabric } from 'fabric'
import { 
  Pen, 
  Eraser, 
  Square, 
  Circle, 
  Type, 
  Move,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RotateCw,
  Save,
  Upload,
  Palette
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useCanvasStore } from '../stores/canvasStore'
import { useCollaboration } from '../hooks/useCollaboration'

interface CanvasProps {
  canvasId?: string
  readOnly?: boolean
  className?: string
}

/**
 * Infinite Canvas Component
 * 
 * Provides OneNote-like infinite canvas with:
 * - Robust pen input with pressure sensitivity
 * - Low-latency drawing (<100ms)
 * - Excalidraw-like diagramming tools
 * - Real-time collaboration
 * - SVG export capability
 */
const Canvas: React.FC<CanvasProps> = ({ 
  canvasId = 'default',
  readOnly = false,
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentTool, setCurrentTool] = useState<string>('pen')
  const [strokeWidth, setStrokeWidth] = useState(2)
  const [strokeColor, setStrokeColor] = useState('#000000')
  const [pressure, setPressure] = useState(1)

  // UseCanvasStore provides addToHistory for recording canvas operations
  const store = useCanvasStore()
  const addToHistory = store.addToHistory
  const undo = store.undo
  const redo = store.redo
  const canUndo = store.canUndo()
  const canRedo = store.canRedo()

  // Fallback implementation for loadCanvasState if missing from the store
  const loadCanvasState = useCallback(
    async (canvasId: string) => {
      // Try to load from localStorage or return null if not found
      const state = localStorage.getItem(`canvasState-${canvasId}`)
      return state ? JSON.parse(state) : null
    },
    []
  )

  // Provide a saveCanvasState fallback if not present in store
  const saveCanvasState = useCallback(
    (canvasId: string, state: any) => {
      // Implement saving logic here or leave as a no-op if not needed
      // Example: localStorage.setItem(`canvasState-${canvasId}`, JSON.stringify(state))
    },
    []
  )

  const {
    broadcastEvent,
    events
  } = useCollaboration({
    roomId: canvasId,
    user: { 
      id: 'local', 
      name: 'Local User', 
      email: 'local@example.com', 
      role: 'user', 
      preferences: {
        theme: 'light',
        language: 'en',
        timezone: 'UTC',
        notifications: {
          email: true,
          push: true,
          mentions: true,
          updates: true
        },
        canvas: {
          snapToGrid: false,
          defaultTool: 'pen',
          gridVisible: false,
          penPressureSensitivity: 1,
          autoSave: true,
          autoSaveInterval: 30000
        },
        voice: {
          inputDevice: '',
          outputDevice: '',
          voiceToText: false,
          textToVoice: false,
          autoTranscribe: false
        },
        ai: {
          model: 'default',
          temperature: 0.7,
          autoSuggestions: true,
          contextWindow: 2048
        }
      },
      createdAt: new Date(),
      lastLoginAt: new Date()
    } // Replace with actual user object
  })

  // Initialize Fabric.js canvas
  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: 'white',
      selection: currentTool === 'select',
      isDrawingMode: currentTool === 'pen' || currentTool === 'eraser',
      enableRetinaScaling: true,
      renderOnAddRemove: true,
      stateful: true
    })

    // Configure drawing brush
    canvas.freeDrawingBrush.width = strokeWidth
    canvas.freeDrawingBrush.color = strokeColor

    // Fabric.js handles touch events natively; no need to set enableTouch

    fabricCanvasRef.current = canvas

    // Load existing canvas state
    loadCanvasState(canvasId).then(state => {
      if (state) {
        canvas.loadFromJSON(state, canvas.renderAll.bind(canvas))
      }
    })

    return () => {
      canvas.dispose()
    }
  }, [canvasId, loadCanvasState])

  // Handle tool changes
  useEffect(() => {
    const canvas = fabricCanvasRef.current
    if (!canvas) return

    switch (currentTool) {
      case 'pen':
        canvas.isDrawingMode = true
        canvas.selection = false
        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas)
        canvas.freeDrawingBrush.width = strokeWidth
        canvas.freeDrawingBrush.color = strokeColor
        break
      
      case 'eraser':
        canvas.isDrawingMode = true
        canvas.selection = false
        // Use PencilBrush with white color to mimic erasing
        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas)
        canvas.freeDrawingBrush.width = strokeWidth * 2
        canvas.freeDrawingBrush.color = '#ffffff'
        break
      
      case 'select':
        canvas.isDrawingMode = false
        canvas.selection = true
        break
      
      default:
        canvas.isDrawingMode = false
        canvas.selection = false
    }
  }, [currentTool, strokeWidth, strokeColor])

  // Handle pressure sensitivity
  const handlePointerEvent = useCallback((event: PointerEvent) => {
    if (event.pointerType === 'pen') {
      setPressure(event.pressure || 1)
      
      const canvas = fabricCanvasRef.current
      if (canvas && canvas.freeDrawingBrush) {
        // Adjust brush width based on pressure
        const pressureWidth = strokeWidth * (0.5 + pressure * 0.5)
        canvas.freeDrawingBrush.width = pressureWidth
      }
    }
  }, [strokeWidth, pressure])

  // Add event listeners for pressure sensitivity
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.addEventListener('pointermove', handlePointerEvent)
    canvas.addEventListener('pointerdown', handlePointerEvent)

    return () => {
      canvas.removeEventListener('pointermove', handlePointerEvent)
      canvas.removeEventListener('pointerdown', handlePointerEvent)
    }
  }, [handlePointerEvent])

  // Handle drawing events for collaboration
  useEffect(() => {
    const canvas = fabricCanvasRef.current
    if (!canvas) return

    const handlePathCreated = (event: fabric.IEvent) => {
      const path = event.target as fabric.Path
      if (path) {
        const strokeData = {
          id: Date.now().toString(),
          path: path.path,
          stroke: strokeColor,
          strokeWidth: strokeWidth,
          pressure: pressure,
          timestamp: Date.now()
        }
        
        addToHistory({
          type: 'add',
          objectId: strokeData.id,
          data: strokeData,
          timestamp: new Date()
        })
        broadcastEvent({
          type: 'stroke',
          payload: strokeData
        })
      }
    }

    const handleObjectModified = (e: fabric.IEvent<Event>): void => {
      if (!canvas || !e.target) return

      // Prepare object data for history/collaboration
      const obj = e.target
      const objectData = obj.toObject(['id'])

      // Add to history (for undo/redo)
      addToHistory({
        type: 'update',
        objectId: (obj as any).id || obj.toObject().id || obj.toObject().uuid || undefined,
        data: objectData,
        timestamp: new Date()
      })

      // Broadcast modification event for collaboration
      broadcastEvent({
        type: 'object:modified',
        payload: {
          id: (obj as any).id || obj.toObject().id || obj.toObject().uuid || undefined,
          data: objectData
        }
      })
    }

    canvas.on('path:created', handlePathCreated)
    canvas.on('object:modified', handleObjectModified)

    return () => {
      canvas.off('path:created', handlePathCreated)
      canvas.off('object:modified', handleObjectModified)
    }
  }, [canvasId, strokeColor, strokeWidth, pressure, broadcastEvent, saveCanvasState, addToHistory])

  // Handle collaboration events
  useEffect(() => {
    const canvas = fabricCanvasRef.current
    if (!canvas) return

    // Listen for new stroke events from collaborators
    const latestStrokeEvents = events.filter(e => e.type === 'stroke')
    if (latestStrokeEvents.length === 0) return

    latestStrokeEvents.forEach(e => {
      const strokeData = e.payload
      if (!strokeData) return

      // Create path from remote stroke data
      const path = new fabric.Path(strokeData.path, {
        stroke: strokeData.stroke,
        strokeWidth: strokeData.strokeWidth,
        fill: '',
        selectable: false
      })

      canvas.add(path)
      canvas.renderAll()
    })
  }, [events])

  // Add geometric shapes
  const addShape = (shapeType: string) => {
    const canvas = fabricCanvasRef.current
    if (!canvas) return

    let shape: fabric.Object

    switch (shapeType) {
      case 'rectangle':
        shape = new fabric.Rect({
          left: 100,
          top: 100,
          width: 100,
          height: 60,
          fill: 'transparent',
          stroke: strokeColor,
          strokeWidth: strokeWidth
        })
        break
      
      case 'circle':
        shape = new fabric.Circle({
          left: 100,
          top: 100,
          radius: 50,
          fill: 'transparent',
          stroke: strokeColor,
          strokeWidth: strokeWidth
        })
        break
      
      case 'text':
        shape = new fabric.IText('Double click to edit', {
          left: 100,
          top: 100,
          fontSize: 16,
          fill: strokeColor
        })
        break
      
      default:
        return
    }

    canvas.add(shape)
    canvas.setActiveObject(shape)
    canvas.renderAll()
  }

  // Canvas controls
  const zoomIn = () => {
    const canvas = fabricCanvasRef.current
    if (canvas) {
      canvas.setZoom(canvas.getZoom() * 1.1)
    }
  }

  const zoomOut = () => {
    const canvas = fabricCanvasRef.current
    if (canvas) {
      canvas.setZoom(canvas.getZoom() / 1.1)
    }
  }

  const resetZoom = () => {
    const canvas = fabricCanvasRef.current
    if (canvas) {
      canvas.setZoom(1)
      canvas.viewportTransform = [1, 0, 0, 1, 0, 0]
      canvas.renderAll()
    }
  }

  const exportCanvas = () => {
    const canvas = fabricCanvasRef.current
    if (canvas) {
      // Export as SVG for vector graphics
      const svg = canvas.toSVG()
      const blob = new Blob([svg], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)
      
      const link = document.createElement('a')
      link.href = url
      link.download = `canvas-${canvasId}-${Date.now()}.svg`
      link.click()
      
      URL.revokeObjectURL(url)
    }
  }

  const tools = [
    { id: 'pen', icon: Pen, label: 'Pen' },
    { id: 'eraser', icon: Eraser, label: 'Eraser' },
    { id: 'select', icon: Move, label: 'Select' },
    { id: 'rectangle', icon: Square, label: 'Rectangle' },
    { id: 'circle', icon: Circle, label: 'Circle' },
    { id: 'text', icon: Type, label: 'Text' }
  ]

  return (
    <div className={`canvas-container ${className}`}>
      {/* Toolbar */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="canvas-toolbar"
      >
        {/* Drawing Tools */}
        <div className="flex items-center gap-1 border-r border-secondary-200 pr-2">
          {tools.map(tool => {
            const Icon = tool.icon
            return (
              <button
                key={tool.id}
                onClick={() => {
                  if (['rectangle', 'circle', 'text'].includes(tool.id)) {
                    addShape(tool.id)
                  } else {
                    setCurrentTool(tool.id)
                  }
                }}
                className={`p-2 rounded hover:bg-secondary-100 transition-colors ${
                  currentTool === tool.id ? 'bg-primary-100 text-primary-600' : ''
                }`}
                title={tool.label}
              >
                <Icon className="w-4 h-4" />
              </button>
            )
          })}
        </div>

        {/* Stroke Controls */}
        <div className="flex items-center gap-2 border-r border-secondary-200 pr-2">
          <input
            type="color"
            value={strokeColor}
            onChange={(e) => setStrokeColor(e.target.value)}
            className="w-8 h-8 rounded border border-secondary-300 cursor-pointer"
            title="Stroke Color"
          />
          
          <input
            type="range"
            min="1"
            max="20"
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(Number(e.target.value))}
            className="w-16"
            title="Stroke Width"
          />
          
          <span className="text-xs text-secondary-600 w-6 text-center">
            {strokeWidth}
          </span>
        </div>

        {/* Undo/Redo */}
        <div className="flex items-center gap-1 border-r border-secondary-200 pr-2">
          <button
            onClick={() => undo()}
            disabled={!canUndo}
            className="p-2 rounded hover:bg-secondary-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Undo"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => redo()}
            disabled={!canRedo}
            className="p-2 rounded hover:bg-secondary-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Redo"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-1 border-r border-secondary-200 pr-2">
          <button
            onClick={zoomOut}
            className="p-2 rounded hover:bg-secondary-100 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          
          <button
            onClick={resetZoom}
            className="px-2 py-1 text-xs rounded hover:bg-secondary-100 transition-colors"
            title="Reset Zoom"
          >
            100%
          </button>
          
          <button
            onClick={zoomIn}
            className="p-2 rounded hover:bg-secondary-100 transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>

        {/* Export */}
        <button
          onClick={exportCanvas}
          className="p-2 rounded hover:bg-secondary-100 transition-colors"
          title="Export as SVG"
        >
          <Save className="w-4 h-4" />
        </button>
      </motion.div>

      {/* Pressure Indicator */}
      {pressure < 1 && currentTool === 'pen' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute top-4 right-4 bg-white rounded-lg shadow-lg border border-secondary-200 p-2"
        >
          <div className="text-xs text-secondary-600 mb-1">
            Pressure: {Math.round(pressure * 100)}%
          </div>
          <div className="w-20 h-2 bg-secondary-200 rounded overflow-hidden">
            <div
              className="h-2 bg-primary-400"
              style={{ width: `${Math.round(pressure * 100)}%` }}
            />
          </div>
        </motion.div>
      )}

      {/* The actual canvas element */}
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ touchAction: 'none', background: 'white' }}
        tabIndex={0}
      />
    </div>
  )
}

export default Canvas

