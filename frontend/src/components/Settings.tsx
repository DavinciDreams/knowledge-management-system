import React, { useState, useEffect } from 'react';
import { 
  CogIcon, 
  UserIcon, 
  BellIcon, 
  ShieldCheckIcon, 
  PaintBrushIcon, 
  GlobeAltIcon,
  MoonIcon,
  SunIcon,
  ComputerDesktopIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import LoadingSpinner from './LoadingSpinner';
import { useRef, useLayoutEffect } from 'react';

interface UserSettings {
  profile: {
    name: string;
    email: string;
    avatar?: string;
    timezone: string;
    language: string;
  };
  preferences: {
    theme: 'light' | 'dark' | 'system';
    notifications: {
      email: boolean;
      push: boolean;
      mentions: boolean;
      updates: boolean;
    };
    canvas: {
      defaultTool: string;
      gridVisible: boolean;
      snapToGrid: boolean;
      penPressureSensitivity: number;
      autoSave: boolean;
      autoSaveInterval: number;
    };
    voice: {
      inputDevice: string;
      outputDevice: string;
      voiceToText: boolean;
      textToVoice: boolean;
      autoTranscribe: boolean;
    };
    ai: {
      model: string;
      temperature: number;
      autoSuggestions: boolean;
      contextWindow: number;
    };
  };
  security: {
    twoFactorEnabled: boolean;
    sessionTimeout: number;
    encryptionEnabled: boolean;
    backupEnabled: boolean;
  };
  data: {
    storageUsed: number;
    storageLimit: number;
    autoBackup: boolean;
    backupFrequency: string;
    exportFormat: string;
  };
}

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Ref for storage usage bar
  const storageBarRef = useRef<HTMLDivElement>(null);

  // Update width of storage usage bar using data attribute and CSS
  useLayoutEffect(() => {
    if (storageBarRef.current) {
      const percent = storageBarRef.current.getAttribute('data-width');
      if (percent) {
        storageBarRef.current.style.width = `${percent}%`;
      }
    }
  }, [settings?.data.storageUsed, settings?.data.storageLimit]);
  const [activeTab, setActiveTab] = useState('profile');
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      // TODO: Replace with actual API call
      const mockSettings: UserSettings = {
        profile: {
          name: 'John Doe',
          email: 'john.doe@example.com',
          timezone: 'America/Los_Angeles',
          language: 'en-US'
        },
        preferences: {
          theme: 'system',
          notifications: {
            email: true,
            push: true,
            mentions: true,
            updates: false
          },
          canvas: {
            defaultTool: 'pen',
            gridVisible: true,
            snapToGrid: false,
            penPressureSensitivity: 0.8,
            autoSave: true,
            autoSaveInterval: 30
          },
          voice: {
            inputDevice: 'default',
            outputDevice: 'default',
            voiceToText: true,
            textToVoice: true,
            autoTranscribe: true
          },
          ai: {
            model: 'gpt-4',
            temperature: 0.7,
            autoSuggestions: true,
            contextWindow: 4000
          }
        },
        security: {
          twoFactorEnabled: false,
          sessionTimeout: 720, // 12 hours
          encryptionEnabled: true,
          backupEnabled: true
        },
        data: {
          storageUsed: 2.4, // GB
          storageLimit: 10, // GB
          autoBackup: true,
          backupFrequency: 'daily',
          exportFormat: 'json'
        }
      };
      
      setSettings(mockSettings);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setIsSaving(true);
      // TODO: API call to save settings
      await new Promise(resolve => setTimeout(resolve, 1000));
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const updateSettings = (path: string, value: any) => {
    if (!settings) return;
    
    const keys = path.split('.');
    const newSettings = { ...settings };
    let current: any = newSettings;
    
    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
    setSettings(newSettings);
  };

  const tabs = [
    { id: 'profile', name: 'Profile', icon: UserIcon },
    { id: 'preferences', name: 'Preferences', icon: PaintBrushIcon },
    { id: 'security', name: 'Security', icon: ShieldCheckIcon },
    { id: 'data', name: 'Data & Storage', icon: GlobeAltIcon }
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 dark:text-gray-400">Failed to load settings</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your account, preferences, and system configuration
          </p>
        </div>
        
        {showSuccess && (
          <div className="flex items-center space-x-2 px-4 py-2 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-lg">
            <CheckIcon className="w-5 h-5" />
            <span>Settings saved successfully</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                title={tab.name}
                aria-label={tab.name}
                type="button"
              >
                <tab.icon className="w-5 h-5" aria-hidden="true" />
                <span className="font-medium">{tab.name}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md">
            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div className="p-6 space-y-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Profile Information
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={settings.profile.name}
                      onChange={(e) => updateSettings('profile.name', e.target.value)}
                      placeholder="Enter your full name"
                      title="Full Name"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={settings.profile.email}
                      onChange={(e) => updateSettings('profile.email', e.target.value)}
                      placeholder="Enter your email address"
                      title="Email Address"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Timezone
                    </label>
                    <select
                      value={settings.profile.timezone}
                      onChange={(e) => updateSettings('profile.timezone', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      title="Timezone"
                      aria-label="Timezone"
                    >
                      <option value="America/Los_Angeles">Pacific Time</option>
                      <option value="America/Denver">Mountain Time</option>
                      <option value="America/Chicago">Central Time</option>
                      <option value="America/New_York">Eastern Time</option>
                      <option value="Europe/London">GMT</option>
                      <option value="Europe/Paris">CET</option>
                      <option value="Asia/Tokyo">JST</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Language
                    </label>
                    <select
                      value={settings.profile.language}
                      onChange={(e) => updateSettings('profile.language', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      title="Language"
                      aria-label="Language"
                    >
                      <option value="en-US">English (US)</option>
                      <option value="en-GB">English (UK)</option>
                      <option value="es-ES">Spanish</option>
                      <option value="fr-FR">French</option>
                      <option value="de-DE">German</option>
                      <option value="ja-JP">Japanese</option>
                      <option value="zh-CN">Chinese (Simplified)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Preferences Tab */}
            {activeTab === 'preferences' && (
              <div className="p-6 space-y-8">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Preferences
                </h2>
                
                {/* Theme Settings */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    Theme
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { value: 'light', label: 'Light', icon: SunIcon },
                      { value: 'dark', label: 'Dark', icon: MoonIcon },
                      { value: 'system', label: 'System', icon: ComputerDesktopIcon }
                    ].map((theme) => (
                      <button
                        key={theme.value}
                        onClick={() => updateSettings('preferences.theme', theme.value)}
                        className={`flex flex-col items-center space-y-2 p-4 rounded-lg border-2 transition-colors ${
                          settings.preferences.theme === theme.value
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900'
                            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                        }`}
                        title={theme.label}
                        aria-label={theme.label}
                      >
                        <theme.icon className="w-6 h-6" />
                        <span className="font-medium">{theme.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notification Settings */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    Notifications
                  </h3>
                  <div className="space-y-4">
                    {[
                      { key: 'email', label: 'Email notifications', description: 'Receive notifications via email' },
                      { key: 'push', label: 'Push notifications', description: 'Browser push notifications' },
                      { key: 'mentions', label: 'Mentions', description: 'When someone mentions you' },
                      { key: 'updates', label: 'Product updates', description: 'Feature announcements and updates' }
                    ].map((notification) => (
                      <div key={notification.key} className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {notification.label}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {notification.description}
                          </p>
                        </div>
                        <button
                          onClick={() => updateSettings(
                            `preferences.notifications.${notification.key}`, 
                            !settings.preferences.notifications[notification.key as keyof typeof settings.preferences.notifications]
                          )}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            settings.preferences.notifications[notification.key as keyof typeof settings.preferences.notifications]
                              ? 'bg-blue-600'
                              : 'bg-gray-200 dark:bg-gray-700'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                              settings.preferences.notifications[notification.key as keyof typeof settings.preferences.notifications]
                                ? 'translate-x-6'
                                : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Canvas Settings */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    Canvas
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Default Tool
                      </label>
                      <select
                        value={settings.preferences.canvas.defaultTool}
                        onChange={(e) => updateSettings('preferences.canvas.defaultTool', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        title="Default Tool"
                        aria-label="Default Tool"
                      >
                        <option value="pen">Pen</option>
                        <option value="highlighter">Highlighter</option>
                        <option value="eraser">Eraser</option>
                        <option value="text">Text</option>
                        <option value="shape">Shape</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Pen Pressure Sensitivity
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={settings.preferences.canvas.penPressureSensitivity}
                        onChange={(e) => updateSettings('preferences.canvas.penPressureSensitivity', parseFloat(e.target.value))}
                        className="w-full"
                        title="Pen Pressure Sensitivity"
                        placeholder="Adjust pen pressure sensitivity"
                      />
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {settings.preferences.canvas.penPressureSensitivity}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
              <div>
                <div className="p-6 space-y-6">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Security & Privacy
                  </h2>
                  
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          Two-Factor Authentication
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Add an extra layer of security to your account
                        </p>
                      </div>
                      <button
                        onClick={() => updateSettings('security.twoFactorEnabled', !settings.security.twoFactorEnabled)}
                        className={`px-4 py-2 rounded-lg transition-colors ${
                          settings.security.twoFactorEnabled
                            ? 'bg-green-500 text-white hover:bg-green-600'
                            : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-400 dark:hover:bg-gray-500'
                        }`}
                      >
                        {settings.security.twoFactorEnabled ? 'Enabled' : 'Enable'}
                      </button>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Session Timeout (minutes)
                      </label>
                      <select
                        value={settings.security.sessionTimeout}
                        onChange={(e) => updateSettings('security.sessionTimeout', parseInt(e.target.value))}
                        className="w-full md:w-auto px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        title="Session Timeout"
                        aria-label="Session Timeout"
                      >
                        <option value={30}>30 minutes</option>
                        <option value={60}>1 hour</option>
                        <option value={240}>4 hours</option>
                        <option value={720}>12 hours</option>
                        <option value={1440}>24 hours</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          End-to-End Encryption
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Encrypt your data before it leaves your device
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm ${
                        settings.security.encryptionEnabled
                          ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                          : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                      }`}>
                        {settings.security.encryptionEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  </div>
                </div>
                <div
                  className="bg-blue-500 h-4 rounded-full transition-all duration-300 storage-usage-bar"
                  data-width={((settings.data.storageUsed / settings.data.storageLimit) * 100).toFixed(2)}
                />
                <div className="p-6 space-y-6">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Data & Storage
                  </h2>
                  
                  <div className="space-y-6">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                        Storage Usage
                      </h3>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
                        <div
                          className="bg-blue-500 h-4 rounded-full transition-all duration-300"
                          style={{ width: `${(settings.data.storageUsed / settings.data.storageLimit) * 100}%` }}
                        />
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                        {settings.data.storageUsed} GB of {settings.data.storageLimit} GB used
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Backup Frequency
                      </label>
                        <select
                          id="backup-frequency"
                          value={settings.data.backupFrequency}
                          onChange={(e) => updateSettings('data.backupFrequency', e.target.value)}
                          className="w-full md:w-auto px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          title="Backup Frequency"
                          aria-label="Backup Frequency"
                      >
                        <option value="hourly">Hourly</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Export Format
                      </label>
                      <select
                        value={settings.data.exportFormat}
                        onChange={(e) => updateSettings('data.exportFormat', e.target.value)}
                        className="w-full md:w-auto px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        title="Export Format"
                        aria-label="Export Format"
                      >
                        <option value="json">JSON</option>
                        <option value="markdown">Markdown</option>
                        <option value="pdf">PDF</option>
                        <option value="html">HTML</option>
                      </select>
                    </div>

                    <div className="flex space-x-4">
                      <button 
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                        title="Export All Data"
                      >
                        Export All Data
                      </button>
                      <button 
                        className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                        title="Create Backup"
                      >
                        Create Backup
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Save Button */}
            <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4">
              <button
                onClick={saveSettings}
                disabled={isSaving}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                {isSaving ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Changes</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;