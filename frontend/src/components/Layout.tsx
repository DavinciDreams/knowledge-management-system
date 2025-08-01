import React, { useState, useRef, useEffect } from 'react'
import { 
  FileText, 
  MessageSquare, 
  Share2, 
  Calendar, 
  User, 
  Settings as SettingsIcon,
  Mic,
  MicOff,
  Search,
  Menu,
  X,
  Palette,
  Network
} from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import VoiceController from './VoiceController'
import SearchModal from './SearchModal'

interface LayoutProps {
  children: React.ReactNode
}

/**
 * Main Layout Component
 * 
 * Provides the overall structure for the application including:
 * - Sidebar navigation
 * - Voice controller
 * - Search functionality
 * - Responsive mobile menu
 */
const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  // Navigation items
  const navigationItems = [
    { 
      path: '/', 
      label: 'Dashboard', 
      icon: FileText,
      description: 'Overview and recent activity'
    },
    { 
      path: '/voice', 
      label: 'Voice Intelligence', 
      icon: Mic,
      description: 'AI-powered voice recording and analysis'
    },
    { 
      path: '/canvas', 
      label: 'Canvas', 
      icon: Palette,
      description: 'Infinite canvas with pen input'
    },
    { 
      path: '/graph', 
      label: 'Knowledge Graph', 
      icon: Network,
      description: 'Visualize connections'
    },
    { 
      path: '/chat', 
      label: 'AI Chat', 
      icon: MessageSquare,
      description: 'Conversational AI assistant'
    },
    { 
      path: '/calendar', 
      label: 'Calendar', 
      icon: Calendar,
      description: 'Events and scheduling'
    },
    { 
      path: '/cv', 
      label: 'CV Overview', 
      icon: User,
      description: 'Professional summary'
    },
  ]

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + K for search
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault()
        setIsSearchOpen(true)
      }
      
      // Escape to close modals
      if (event.key === 'Escape') {
        setIsSearchOpen(false)
        setIsMobileMenuOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const SidebarContent = () => (
    <div className="sidebar h-full flex flex-col">
      {/* Logo and branding */}
      <div className="sidebar-section border-b">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-gradient">KM System</h1>
            <p className="text-xs text-secondary-500">Knowledge Management</p>
          </div>
        </div>
      </div>

      {/* Search bar */}
      <div className="sidebar-section">
        <button
          onClick={() => setIsSearchOpen(true)}
          className="w-full flex items-center gap-3 px-3 py-2 text-left text-secondary-600 hover:bg-secondary-50 rounded-lg transition-colors"
        >
          <Search className="w-4 h-4" />
          <span className="text-sm">Search...</span>
          <kbd className="ml-auto text-xs text-secondary-400 bg-secondary-100 px-2 py-1 rounded">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-2">
        <div className="space-y-1">
          {navigationItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            
            return (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path)
                  setIsMobileMenuOpen(false)
                }}
                className={`sidebar-item w-full ${isActive ? 'active' : ''}`}
                title={item.description}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      {/* Bottom section */}
      <div className="sidebar-section border-t">
        <button
          onClick={() => navigate('/settings')}
          className={`sidebar-item w-full ${location.pathname === '/settings' ? 'active' : ''}`}
        >
          <SettingsIcon className="w-4 h-4" />
          <span>Settings</span>
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-secondary-50">
      {/* Desktop Sidebar */}
      <div className={`hidden md:block transition-all duration-300 ${
        isSidebarOpen ? 'w-64' : 'w-0'
      } overflow-hidden`}>
        <SidebarContent />
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div 
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-64 bg-white">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-semibold">Navigation</h2>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1 hover:bg-secondary-100 rounded"
                title="Close navigation menu"
                aria-label="Close navigation menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white border-b border-secondary-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-1 hover:bg-secondary-100 rounded"
              title="Open navigation menu"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Desktop sidebar toggle */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="hidden md:block p-1 hover:bg-secondary-100 rounded"
              title="Toggle sidebar"
              aria-label="Toggle sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Page title */}
            <h2 className="font-semibold text-lg text-secondary-800">
              {navigationItems.find(item => item.path === location.pathname)?.label || 'Page'}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick search */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm text-secondary-600 bg-secondary-100 hover:bg-secondary-200 rounded-lg transition-colors"
            >
              <Search className="w-4 h-4" />
              <span>Search</span>
              <kbd className="text-xs bg-secondary-200 px-1.5 py-0.5 rounded">⌘K</kbd>
            </button>

            {/* Voice Controller */}
            <VoiceController />
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>

      {/* Search Modal */}
      {isSearchOpen && (
        <SearchModal 
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
        />
      )}
    </div>
  )
}

export default Layout
