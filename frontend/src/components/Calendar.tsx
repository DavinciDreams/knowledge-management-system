import React, { useState, useEffect } from 'react';
import { 
  CalendarDaysIcon, 
  ChevronLeftIcon, 
  ChevronRightIcon,
  PlusIcon,
  ClockIcon,
  UserGroupIcon,
  MapPinIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import LoadingSpinner from './LoadingSpinner';

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  attendees?: string[];
  type: 'meeting' | 'deadline' | 'reminder' | 'note_reference';
  linkedNoteId?: string;
  color: string;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
}

const Calendar: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showEventModal, setShowEventModal] = useState(false);

  useEffect(() => {
    loadEvents();
    generateCalendarDays();
  }, [currentDate]);

  const loadEvents = async () => {
    try {
      setIsLoading(true);
      // TODO: Replace with actual API call
      const mockEvents: CalendarEvent[] = [
        {
          id: '1',
          title: 'Team Standup',
          description: 'Daily team synchronization meeting',
          startTime: new Date(2024, currentDate.getMonth(), 15, 9, 0),
          endTime: new Date(2024, currentDate.getMonth(), 15, 9, 30),
          attendees: ['john@example.com', 'jane@example.com'],
          type: 'meeting',
          color: 'bg-blue-500'
        },
        {
          id: '2',
          title: 'Project Deadline: Knowledge Base MVP',
          description: 'First version of the knowledge management system',
          startTime: new Date(2024, currentDate.getMonth(), 20, 17, 0),
          endTime: new Date(2024, currentDate.getMonth(), 20, 17, 0),
          type: 'deadline',
          color: 'bg-red-500'
        },
        {
          id: '3',
          title: 'Review Meeting Notes',
          description: 'Follow up on action items from Q4 planning',
          startTime: new Date(2024, currentDate.getMonth(), 18, 14, 0),
          endTime: new Date(2024, currentDate.getMonth(), 18, 15, 0),
          type: 'note_reference',
          linkedNoteId: 'note_123',
          color: 'bg-green-500'
        },
        {
          id: '4',
          title: 'Client Presentation',
          description: 'Present knowledge management solution to client',
          startTime: new Date(2024, currentDate.getMonth(), 25, 10, 0),
          endTime: new Date(2024, currentDate.getMonth(), 25, 11, 30),
          location: 'Conference Room A',
          attendees: ['client@company.com'],
          type: 'meeting',
          color: 'bg-purple-500'
        }
      ];
      
      setEvents(mockEvents);
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Get first day of the month and how many days to show from previous month
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const startingDayOfWeek = firstDayOfMonth.getDay();
    
    // Generate calendar grid (6 weeks x 7 days = 42 days)
    const days: CalendarDay[] = [];
    const today = new Date();
    
    // Previous month days
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      days.push({
        date,
        isCurrentMonth: false,
        isToday: false,
        events: getEventsForDate(date)
      });
    }
    
    // Current month days
    for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
      const date = new Date(year, month, day);
      days.push({
        date,
        isCurrentMonth: true,
        isToday: date.toDateString() === today.toDateString(),
        events: getEventsForDate(date)
      });
    }
    
    // Next month days to fill the grid
    const remainingDays = 42 - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);
      days.push({
        date,
        isCurrentMonth: false,
        isToday: false,
        events: getEventsForDate(date)
      });
    }
    
    setCalendarDays(days);
  };

  const getEventsForDate = (date: Date): CalendarEvent[] => {
    return events.filter(event => {
      const eventDate = new Date(event.startTime);
      return eventDate.toDateString() === date.toDateString();
    });
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const selectDate = (date: Date) => {
    setSelectedDate(date);
  };

  const formatEventTime = (event: CalendarEvent) => {
    const start = event.startTime.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    const end = event.endTime.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    if (event.type === 'deadline') {
      return `Due ${start}`;
    }
    
    return `${start} - ${end}`;
  };

  const getEventIcon = (type: CalendarEvent['type']) => {
    switch (type) {
      case 'meeting':
        return <UserGroupIcon className="w-4 h-4" />;
      case 'deadline':
        return <ClockIcon className="w-4 h-4" />;
      case 'note_reference':
        return <DocumentTextIcon className="w-4 h-4" />;
      default:
        return <CalendarDaysIcon className="w-4 h-4" />;
    }
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
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
        <div className="flex items-center space-x-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Calendar
          </h1>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => navigateMonth('prev')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Previous month"
            >
              <ChevronLeftIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 min-w-[180px] text-center">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <button
              onClick={() => navigateMonth('next')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Next month"
            >
              <ChevronRightIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>
        <button
          onClick={() => setShowEventModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          title="Create new event"
        >
          <PlusIcon className="w-5 h-5" />
          <span>New Event</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
            {/* Week day headers */}
            <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
              {weekDays.map((day) => (
                <div
                  key={day}
                  className="p-4 text-center text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7">
              {calendarDays.map((day, index) => (
                <div
                  key={index}
                  className={`min-h-[120px] p-2 border-b border-r border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                    !day.isCurrentMonth ? 'bg-gray-50 dark:bg-gray-800' : ''
                  } ${
                    day.isToday ? 'bg-blue-50 dark:bg-blue-900' : ''
                  }`}
                  onClick={() => selectDate(day.date)}
                >
                  <div className={`text-sm font-medium mb-1 ${
                    !day.isCurrentMonth 
                      ? 'text-gray-400 dark:text-gray-600' 
                      : day.isToday 
                        ? 'text-blue-600 dark:text-blue-400' 
                        : 'text-gray-900 dark:text-white'
                  }`}>
                    {day.date.getDate()}
                  </div>
                  
                  <div className="space-y-1">
                    {day.events.slice(0, 3).map((event) => (
                      <div
                        key={event.id}
                        className={`text-xs p-1 rounded text-white truncate ${event.color}`}
                        title={event.title}
                      >
                        {event.title}
                      </div>
                    ))}
                    {day.events.length > 3 && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        +{day.events.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Event Details / Upcoming Events */}
        <div className="space-y-6">
          {/* Selected Date Events */}
          {selectedDate && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {selectedDate.toLocaleDateString([], { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </h3>
              
              {getEventsForDate(selectedDate).length > 0 ? (
                <div className="space-y-3">
                  {getEventsForDate(selectedDate).map((event) => (
                    <div
                      key={event.id}
                      className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`p-1 rounded ${event.color} text-white`}>
                          {getEventIcon(event.type)}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {event.title}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {formatEventTime(event)}
                          </p>
                          {event.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {event.description}
                            </p>
                          )}
                          {event.location && (
                            <div className="flex items-center space-x-1 text-sm text-gray-500 dark:text-gray-400 mt-1">
                              <MapPinIcon className="w-4 h-4" />
                              <span>{event.location}</span>
                            </div>
                          )}
                          {event.linkedNoteId && (
                            <button
                              onClick={() => {
                                // TODO: Navigate to linked note
                                console.log('Navigate to note:', event.linkedNoteId);
                              }}
                              className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-1"
                            >
                              View linked note
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600 dark:text-gray-400 text-center py-4">
                  No events on this date
                </p>
              )}
            </div>
          )}

          {/* Upcoming Events */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Upcoming Events
            </h3>
            
            <div className="space-y-3">
              {events
                .filter(event => event.startTime > new Date())
                .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
                .slice(0, 5)
                .map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center space-x-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer"
                    onClick={() => selectDate(event.startTime)}
                  >
                    <div className={`p-1 rounded ${event.color} text-white`}>
                      {getEventIcon(event.type)}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                        {event.title}
                      </h4>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {event.startTime.toLocaleDateString()} at {formatEventTime(event)}
                      </p>
                    </div>
                  </div>
                ))}
              
              {events.filter(event => event.startTime > new Date()).length === 0 && (
                <p className="text-gray-600 dark:text-gray-400 text-center py-4">
                  No upcoming events
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Calendar;
