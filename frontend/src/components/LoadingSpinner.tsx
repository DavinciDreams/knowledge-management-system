import React from 'react'
import { Loader2 } from 'lucide-react'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
  className?: string
}

/**
 * Loading Spinner Component
 * 
 * Provides consistent loading states throughout the application
 */
const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  text,
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  }

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <Loader2 className={`spinner ${sizeClasses[size]}`} />
      {text && (
        <p className="text-sm text-secondary-600 animate-pulse">
          {text}
        </p>
      )}
    </div>
  )
}

export default LoadingSpinner
