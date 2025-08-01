import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  User, 
  MapPin, 
  Building, 
  Calendar, 
  Tag, 
  Clock, 
  DollarSign,
  Phone,
  Mail,
  Globe,
  CheckCircle,
  AlertCircle
} from 'lucide-react'

interface Entity {
  text: string
  label: string
  confidence: number
  start: number
  end: number
}

interface ActionItem {
  id: string
  text: string
  priority: 'low' | 'medium' | 'high'
  dueDate?: string
  completed: boolean
  category?: string
}

interface EntityDisplayProps {
  entities: Entity[]
  actionItems: ActionItem[]
  isVisible: boolean
  onEntityClick?: (entity: Entity) => void
  onActionItemToggle?: (id: string) => void
  className?: string
}

const EntityDisplay: React.FC<EntityDisplayProps> = ({
  entities,
  actionItems,
  isVisible,
  onEntityClick,
  onActionItemToggle,
  className = ''
}) => {
  // Get icon for entity type
  const getEntityIcon = (label: string) => {
    switch (label.toLowerCase()) {
      case 'person':
      case 'per':
        return User
      case 'location':
      case 'loc':
      case 'gpe':
        return MapPin
      case 'organization':
      case 'org':
        return Building
      case 'date':
      case 'time':
        return Calendar
      case 'money':
      case 'currency':
        return DollarSign
      case 'phone':
        return Phone
      case 'email':
        return Mail
      case 'url':
        return Globe
      default:
        return Tag
    }
  }

  // Get color for entity type
  const getEntityColor = (label: string) => {
    switch (label.toLowerCase()) {
      case 'person':
      case 'per':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'location':
      case 'loc':
      case 'gpe':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'organization':
      case 'org':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'date':
      case 'time':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'money':
      case 'currency':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'phone':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200'
      case 'email':
        return 'bg-pink-100 text-pink-800 border-pink-200'
      case 'url':
        return 'bg-teal-100 text-teal-800 border-teal-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  // Get priority color for action items
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-600 bg-red-50 border-red-200'
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'low':
        return 'text-green-600 bg-green-50 border-green-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3 }}
          className={`bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden ${className}`}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              AI Analysis Results
            </h3>
            <p className="text-blue-100 text-sm mt-1">
              Extracted entities and action items from voice transcription
            </p>
          </div>

          <div className="p-4 space-y-6">
            {/* Entities Section */}
            {entities.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Tag className="w-4 h-4" />
                  Detected Entities ({entities.length})
                </h4>
                <div className="flex flex-wrap gap-2">
                  {entities.map((entity, index) => {
                    const IconComponent = getEntityIcon(entity.label)
                    return (
                      <motion.button
                        key={index}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.1 }}
                        onClick={() => onEntityClick?.(entity)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all hover:shadow-md hover:scale-105 ${getEntityColor(entity.label)}`}
                      >
                        <IconComponent className="w-4 h-4" />
                        <span>{entity.text}</span>
                        <span className="text-xs opacity-75">
                          {entity.label}
                        </span>
                        {entity.confidence && (
                          <span className="text-xs opacity-60">
                            {Math.round(entity.confidence * 100)}%
                          </span>
                        )}
                      </motion.button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Action Items Section */}
            {actionItems.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Action Items ({actionItems.length})
                </h4>
                <div className="space-y-2">
                  {actionItems.map((item, index) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={`flex items-start gap-3 p-3 rounded-lg border transition-all hover:shadow-sm ${getPriorityColor(item.priority)} ${
                        item.completed ? 'opacity-60 line-through' : ''
                      }`}
                    >
                      <button
                        onClick={() => onActionItemToggle?.(item.id)}
                        className={`flex-shrink-0 w-5 h-5 rounded-full border-2 transition-all ${
                          item.completed
                            ? 'bg-green-500 border-green-500'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        {item.completed && (
                          <CheckCircle className="w-full h-full text-white" />
                        )}
                      </button>
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {item.text}
                        </p>
                        
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs font-medium px-2 py-1 rounded-full bg-white bg-opacity-60">
                            {item.priority.toUpperCase()}
                          </span>
                          
                          {item.dueDate && (
                            <span className="text-xs text-gray-600 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(item.dueDate).toLocaleDateString()}
                            </span>
                          )}
                          
                          {item.category && (
                            <span className="text-xs text-gray-600">
                              #{item.category}
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {entities.length === 0 && actionItems.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">
                  No entities or action items detected yet.
                </p>
                <p className="text-xs mt-1">
                  Try recording a voice note with names, dates, or tasks.
                </p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default EntityDisplay
