import React, { useState, useEffect, useRef } from 'react'
import { Search, Clock, FileText, Hash, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from 'react-query'
import { searchService } from '../services/searchService'

interface SearchModalProps {
  isOpen: boolean
  onClose: () => void
}

import type { SearchResult } from '../types'

/**
 * Search Modal Component
 * 
 * Provides global search functionality across all content types
 * with real-time results and keyboard navigation
 */
const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  // Search query with debouncing
  const { data: results = [], isLoading } = useQuery(
    ['search', query],
    () => searchService.search(query),
    {
      enabled: query.length > 2,
      staleTime: 5000,
    }
  )

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          setSelectedIndex(prev => 
            prev < results.length - 1 ? prev + 1 : prev
          )
          break
        case 'ArrowUp':
          event.preventDefault()
          setSelectedIndex(prev => prev > 0 ? prev - 1 : prev)
          break
        case 'Enter':
          event.preventDefault()
          if (results[selectedIndex]) {
            handleResultClick(results[selectedIndex])
          }
          break
        case 'Escape':
          event.preventDefault()
          onClose()
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, results, selectedIndex, onClose])

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [results])
  const handleResultClick = (result: SearchResult) => {
    // Navigate to the result based on type
    const routes: Record<string, string> = {
      note: `/note/${result.id}`,
      canvas: `/canvas/${result.id}`,
      document: `/document/${result.id}`,
      voice: `/voice/${result.id}`,
      web_clip: `/webclip/${result.id}`
    };
    
    window.location.href = routes[result.type] || '/';
    onClose();
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'note':
        return <FileText className="w-4 h-4" />
      case 'canvas':
        return <Hash className="w-4 h-4" />
      case 'document':
        return <FileText className="w-4 h-4" />
      case 'voice':
        return <Clock className="w-4 h-4" />
      default:
        return <FileText className="w-4 h-4" />
    }
  }

  const highlightText = (text: string, highlights: string[]) => {
    if (!highlights.length) return text

    let highlightedText = text
    highlights.forEach(highlight => {
      const regex = new RegExp(`(${highlight})`, 'gi')
      highlightedText = highlightedText.replace(
        regex,
        '<mark class="bg-yellow-200 text-yellow-900 px-1 rounded">$1</mark>'
      )
    })

    return (
      <span dangerouslySetInnerHTML={{ __html: highlightedText }} />
    )
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-start justify-center pt-20"
      >
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-black bg-opacity-50"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          className="relative w-full max-w-2xl mx-4 bg-white rounded-xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="border-b border-secondary-200 p-4">
            <div className="flex items-center gap-3">
              <Search className="w-5 h-5 text-secondary-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search notes, documents, voice recordings..."
                className="flex-1 text-lg bg-transparent outline-none placeholder-secondary-400"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="p-1 hover:bg-secondary-100 rounded"
                  title="Clear search"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4 text-secondary-400" />
                </button>
              )}
            </div>
          </div>

          {/* Results */}
          <div 
            ref={resultsRef}
            className="max-h-96 overflow-y-auto"
          >
            {query.length <= 2 ? (
              <div className="p-8 text-center text-secondary-500">
                <Search className="w-12 h-12 mx-auto mb-4 text-secondary-300" />
                <p>Type at least 3 characters to search</p>
              </div>
            ) : isLoading ? (
              <div className="p-8 text-center">
                <div className="spinner w-6 h-6 mx-auto mb-4" />
                <p className="text-secondary-500">Searching...</p>
              </div>
            ) : results.length === 0 ? (
              <div className="p-8 text-center text-secondary-500">
                <Search className="w-12 h-12 mx-auto mb-4 text-secondary-300" />
                <p>No results found for "{query}"</p>
                <p className="text-sm mt-2">Try different keywords or check your spelling</p>
              </div>
            ) : (
              <div className="py-2">
                {results.map((result, index) => (
                  <motion.div
                    key={result.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`px-4 py-3 cursor-pointer transition-colors ${
                      index === selectedIndex 
                        ? 'bg-primary-50 border-r-2 border-primary-500' 
                        : 'hover:bg-secondary-50'
                    }`}
                    onClick={() => handleResultClick(result)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-1 p-1 rounded ${
                        index === selectedIndex 
                          ? 'text-primary-600' 
                          : 'text-secondary-400'
                      }`}>
                        {getTypeIcon(result.type)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-secondary-900 truncate">
                          {highlightText(result.title, result.highlights.flatMap(h => h.fragments))}
                          </h3>
                          <span className="text-xs text-secondary-400 capitalize bg-secondary-100 px-2 py-1 rounded">
                            {result.type}
                          </span>
                        </div>
                        
                        <p className="text-sm text-secondary-600 line-clamp-2">
                          {highlightText(
                            result.excerpt,
                            result.highlights.flatMap(h => h.fragments)
                          )}
                        </p>
                        
                        <div className="flex items-center gap-2 mt-2 text-xs text-secondary-400">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(result.createdAt).toLocaleString()}</span>
                          <span className="ml-auto">
                            {Math.round(result.score)} score
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {results.length > 0 && (
            <div className="border-t border-secondary-200 px-4 py-3 bg-secondary-50">
              <div className="flex items-center justify-between text-xs text-secondary-500">
                <span>
                  {results.length} result{results.length !== 1 ? 's' : ''} found
                </span>
                <div className="flex items-center gap-4">
                  <span>↑↓ to navigate</span>
                  <span>↵ to select</span>
                  <span>esc to close</span>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default SearchModal
