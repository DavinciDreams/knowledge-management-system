import React, { Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { motion } from 'framer-motion'
import Layout from './components/Layout'
import LoadingSpinner from './components/LoadingSpinner'

// Lazy load components for better performance
const Dashboard = React.lazy(() => import('./components/Dashboard'))
const Canvas = React.lazy(() => import('./components/Canvas'))
const KnowledgeGraph = React.lazy(() => import('./components/KnowledgeGraph'))
const AIChat = React.lazy(() => import('./components/AIChat'))
const Calendar = React.lazy(() => import('./components/Calendar'))
const CVOverview = React.lazy(() => import('./components/CVOverview'))
const Settings = React.lazy(() => import('./components/Settings'))
const VoiceDashboard = React.lazy(() => import('./components/VoiceDashboard'))

/**
 * Main Application Component
 * 
 * Provides routing and global layout for the Knowledge Management System.
 * Features lazy loading for performance optimization and smooth page transitions.
 */
function App() {
  return (
    <div className="App">
      <Layout>
        <Suspense 
          fallback={
            <div className="flex items-center justify-center h-full">
              <LoadingSpinner size="lg" text="Loading..." />
            </div>
          }
        >
          <Routes>
            {/* Dashboard - Main landing page */}
            <Route 
              path="/" 
              element={
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Dashboard />
                </motion.div>
              } 
            />
            
            {/* Voice Dashboard - AI-powered voice features */}
            <Route 
              path="/voice" 
              element={
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <VoiceDashboard />
                </motion.div>
              } 
            />
            
            {/* Infinite Canvas - Drawing and note-taking */}
            <Route 
              path="/canvas" 
              element={
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <Canvas />
                </motion.div>
              } 
            />
            
            {/* Knowledge Graph - Visualization of relationships */}
            <Route 
              path="/graph" 
              element={
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <KnowledgeGraph />
                </motion.div>
              } 
            />
            
            {/* AI Chat - Conversational interface */}
            <Route 
              path="/chat" 
              element={
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <AIChat />
                </motion.div>
              } 
            />
            
            {/* Calendar - Event management */}
            <Route 
              path="/calendar" 
              element={
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Calendar />
                </motion.div>
              } 
            />
            
            {/* CV Overview - Professional summary */}
            <Route 
              path="/cv" 
              element={
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <CVOverview />
                </motion.div>
              } 
            />
            
            {/* Settings - Configuration */}
            <Route 
              path="/settings" 
              element={
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <Settings />
                </motion.div>
              } 
            />
            
            {/* 404 Not Found */}
            <Route 
              path="*" 
              element={
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col items-center justify-center h-full text-center"
                >
                  <h1 className="text-4xl font-bold text-secondary-800 mb-4">
                    404 - Page Not Found
                  </h1>
                  <p className="text-secondary-600 mb-8">
                    The page you're looking for doesn't exist.
                  </p>
                  <button 
                    onClick={() => window.history.back()}
                    className="btn-primary"
                  >
                    Go Back
                  </button>
                </motion.div>
              } 
            />
          </Routes>
        </Suspense>
      </Layout>
    </div>
  )
}

export default App
