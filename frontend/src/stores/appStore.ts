import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { User, Theme, SystemNotification, AppError } from '../types';

interface AppState {
  // User state
  user: User | null;
  isAuthenticated: boolean;
  
  // Theme state
  theme: Theme;
  
  // UI state
  sidebarCollapsed: boolean;
  searchModalOpen: boolean;
  isLoading: boolean;
  
  // Notifications
  notifications: SystemNotification[];
  
  // Error handling
  error: AppError | null;
  
  // Actions
  setUser: (user: User | null) => void;
  setTheme: (theme: Theme) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSearchModalOpen: (open: boolean) => void;
  setLoading: (loading: boolean) => void;
  addNotification: (notification: SystemNotification) => void;
  removeNotification: (id: string) => void;
  markNotificationRead: (id: string) => void;
  setError: (error: AppError | null) => void;
  clearError: () => void;
  logout: () => void;
  reset: () => void;
}

const initialState = {
  user: null,
  isAuthenticated: false,
  theme: 'system' as Theme,
  sidebarCollapsed: false,
  searchModalOpen: false,
  isLoading: false,
  notifications: [],
  error: null,
};

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        setUser: (user) => 
          set((state) => ({ 
            user, 
            isAuthenticated: !!user 
          }), false, 'setUser'),

        setTheme: (theme) => 
          set({ theme }, false, 'setTheme'),

        setSidebarCollapsed: (collapsed) => 
          set({ sidebarCollapsed: collapsed }, false, 'setSidebarCollapsed'),

        setSearchModalOpen: (open) => 
          set({ searchModalOpen: open }, false, 'setSearchModalOpen'),

        setLoading: (loading) => 
          set({ isLoading: loading }, false, 'setLoading'),

        addNotification: (notification) => 
          set((state) => ({
            notifications: [notification, ...state.notifications]
          }), false, 'addNotification'),

        removeNotification: (id) => 
          set((state) => ({
            notifications: state.notifications.filter(n => n.id !== id)
          }), false, 'removeNotification'),

        markNotificationRead: (id) => 
          set((state) => ({
            notifications: state.notifications.map(n => 
              n.id === id ? { ...n, read: true } : n
            )
          }), false, 'markNotificationRead'),

        setError: (error) => 
          set({ error }, false, 'setError'),

        clearError: () => 
          set({ error: null }, false, 'clearError'),

        logout: () => 
          set({ 
            user: null, 
            isAuthenticated: false,
            notifications: []
          }, false, 'logout'),

        reset: () => 
          set(initialState, false, 'reset'),
      }),
      {
        name: 'app-store',
        partialize: (state) => ({
          theme: state.theme,
          sidebarCollapsed: state.sidebarCollapsed,
          user: state.user,
          isAuthenticated: state.isAuthenticated,
        }),
      }
    ),
    {
      name: 'app-store',
    }
  )
);
