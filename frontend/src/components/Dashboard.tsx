import React, { useState, useEffect } from 'react';
import { 
  BookOpenIcon, 
  ChartBarIcon, 
  ClockIcon, 
  DocumentTextIcon,
  PlusIcon,
  MicrophoneIcon,
  PaintBrushIcon,
  GlobeAltIcon
} from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from './LoadingSpinner';

interface RecentActivity {
  id: string;
  type: 'note' | 'canvas' | 'voice' | 'web_clip';
  title: string;
  timestamp: Date;
  preview?: string;
}

interface DashboardStats {
  totalNotes: number;
  totalCanvases: number;
  totalVoiceNotes: number;
  weeklyActivity: number;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      // TODO: Replace with actual API calls
      const mockStats: DashboardStats = {
        totalNotes: 142,
        totalCanvases: 23,
        totalVoiceNotes: 67,
        weeklyActivity: 28
      };

      const mockActivity: RecentActivity[] = [
        {
          id: '1',
          type: 'note',
          title: 'Meeting Notes - Q4 Planning',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
          preview: 'Discussed upcoming product roadmap and resource allocation...'
        },
        {
          id: '2',
          type: 'canvas',
          title: 'System Architecture Diagram',
          timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
          preview: 'Updated microservices architecture with new AI components'
        },
        {
          id: '3',
          type: 'voice',
          title: 'Voice Note: Ideas for UI improvements',
          timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
          preview: '3:24 duration'
        },
        {
          id: '4',
          type: 'web_clip',
          title: 'Article: Best Practices for Knowledge Management',
          timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          preview: 'Saved from medium.com'
        }
      ];

      setStats(mockStats);
      setRecentActivity(mockActivity);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getActivityIcon = (type: RecentActivity['type']) => {
    switch (type) {
      case 'note':
        return <DocumentTextIcon className="w-5 h-5 text-blue-500" />;
      case 'canvas':
        return <PaintBrushIcon className="w-5 h-5 text-purple-500" />;
      case 'voice':
        return <MicrophoneIcon className="w-5 h-5 text-green-500" />;
      case 'web_clip':
        return <GlobeAltIcon className="w-5 h-5 text-orange-500" />;
      default:
        return <DocumentTextIcon className="w-5 h-5 text-gray-500" />;
    }
  };

  const formatTimeAgo = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 60) {
      return `${minutes}m ago`;
    } else if (hours < 24) {
      return `${hours}h ago`;
    } else {
      return `${days}d ago`;
    }
  };

  const quickActions = [
    {
      title: 'New Note',
      description: 'Create a text note',
      icon: <DocumentTextIcon className="w-8 h-8" />,
      action: () => navigate('/notes/new'),
      color: 'bg-blue-500 hover:bg-blue-600'
    },
    {
      title: 'New Canvas',
      description: 'Start drawing',
      icon: <PaintBrushIcon className="w-8 h-8" />,
      action: () => navigate('/canvas/new'),
      color: 'bg-purple-500 hover:bg-purple-600'
    },
    {
      title: 'Voice Note',
      description: 'Record audio',
      icon: <MicrophoneIcon className="w-8 h-8" />,
      action: () => navigate('/voice/new'),
      color: 'bg-green-500 hover:bg-green-600'
    },
    {
      title: 'Web Clip',
      description: 'Capture web content',
      icon: <GlobeAltIcon className="w-8 h-8" />,
      action: () => window.open('/extension', '_blank'),
      color: 'bg-orange-500 hover:bg-orange-600'
    }
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Welcome back! Here's what's happening with your knowledge base.
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {quickActions.map((action, index) => (
          <button
            key={index}
            onClick={action.action}
            className={`${action.color} text-white p-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl`}
          >
            <div className="flex items-center space-x-4">
              {action.icon}
              <div className="text-left">
                <h3 className="font-semibold">{action.title}</h3>
                <p className="text-sm opacity-90">{action.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <DocumentTextIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Notes</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.totalNotes}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <PaintBrushIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Canvases</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.totalCanvases}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                <MicrophoneIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Voice Notes</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.totalVoiceNotes}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-lg">
                <ChartBarIcon className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Weekly Activity</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.weeklyActivity}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Recent Activity
          </h2>
        </div>
        <div className="p-6">
          {recentActivity.length > 0 ? (
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start space-x-4 p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                  onClick={() => {
                    // TODO: Navigate to specific item
                    console.log('Navigate to:', activity.id);
                  }}
                >
                  <div className="flex-shrink-0 mt-1">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                      {activity.title}
                    </h3>
                    {activity.preview && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 truncate">
                        {activity.preview}
                      </p>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatTimeAgo(activity.timestamp)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <BookOpenIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                No recent activity. Start creating some content!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
