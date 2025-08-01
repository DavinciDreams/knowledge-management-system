import React, { useState, useEffect } from 'react';
import { 
  DocumentTextIcon, 
  ChartBarIcon, 
  StarIcon,
  EyeIcon,
  CalendarIcon,
  BriefcaseIcon,
  AcademicCapIcon,
  CodeBracketIcon,
  GlobeAltIcon,
  MapPinIcon,
  EnvelopeIcon,
  PhoneIcon,
  BuildingOfficeIcon
} from '@heroicons/react/24/outline';
import LoadingSpinner from './LoadingSpinner';

interface CVSection {
  id: string;
  title: string;
  content: string;
  lastUpdated: Date;
  wordCount: number;
  linkedNotes: string[];
}

interface CVStats {
  totalSections: number;
  totalWordCount: number;
  completionPercentage: number;
  lastUpdated: Date;
}

interface PersonalInfo {
  name: string;
  title: string;
  email: string;
  phone: string;
  location: string;
  website?: string;
  linkedin?: string;
  github?: string;
}

const CVOverview: React.FC = () => {
  const [cvSections, setCvSections] = useState<CVSection[]>([]);
  const [stats, setStats] = useState<CVStats | null>(null);
  const [personalInfo, setPersonalInfo] = useState<PersonalInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);

  useEffect(() => {
    loadCVData();
  }, []);

  const loadCVData = async () => {
    try {
      setIsLoading(true);
      
      // TODO: Replace with actual API calls
      const mockPersonalInfo: PersonalInfo = {
        name: 'Your Name',
        title: 'Software Engineer & Knowledge Management Specialist',
        email: 'your.email@example.com',
        phone: '+1 (555) 123-4567',
        location: 'San Francisco, CA',
        website: 'https://yourwebsite.com',
        linkedin: 'https://linkedin.com/in/yourprofile',
        github: 'https://github.com/yourusername'
      };

      const mockSections: CVSection[] = [
        {
          id: 'summary',
          title: 'Professional Summary',
          content: 'Experienced software engineer with a passion for knowledge management systems and AI integration. Specialized in building scalable, user-centric applications with modern technologies.',
          lastUpdated: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          wordCount: 28,
          linkedNotes: ['note_1', 'note_2']
        },
        {
          id: 'experience',
          title: 'Work Experience',
          content: `Senior Software Engineer - Tech Corp (2022-Present)
• Led development of knowledge management platform serving 10,000+ users
• Implemented real-time collaboration features with WebSocket technology
• Reduced system response time by 40% through performance optimizations

Software Engineer - StartupCo (2020-2022)
• Built full-stack web applications using React, Node.js, and PostgreSQL
• Designed and implemented RESTful APIs and microservices architecture
• Collaborated with cross-functional teams in Agile development environment`,
          lastUpdated: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          wordCount: 89,
          linkedNotes: ['meeting_notes_1', 'project_retrospective']
        },
        {
          id: 'education',
          title: 'Education',
          content: `Master of Science in Computer Science - University of Technology (2020)
• Thesis: "AI-Driven Knowledge Discovery in Large-Scale Document Collections"
• GPA: 3.8/4.0

Bachelor of Science in Software Engineering - State University (2018)
• Magna Cum Laude
• Relevant Coursework: Data Structures, Algorithms, Database Systems, Human-Computer Interaction`,
          lastUpdated: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          wordCount: 52,
          linkedNotes: ['thesis_notes', 'coursework_summary']
        },
        {
          id: 'skills',
          title: 'Technical Skills',
          content: `Programming Languages: TypeScript, Python, JavaScript, Java, Go
Frontend: React, Vue.js, HTML5, CSS3, Tailwind CSS
Backend: Node.js, Express, FastAPI, PostgreSQL, MongoDB
Cloud & DevOps: AWS, Docker, Kubernetes, CI/CD pipelines
AI/ML: TensorFlow, PyTorch, Hugging Face, OpenAI API
Tools: Git, VS Code, Figma, Jira, Slack`,
          lastUpdated: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          wordCount: 45,
          linkedNotes: ['skill_assessments', 'learning_goals']
        },
        {
          id: 'projects',
          title: 'Key Projects',
          content: `Knowledge Management System (2024)
• Built comprehensive self-hosted platform with AI integration
• Features: infinite canvas, voice notes, real-time collaboration
• Technologies: React, Node.js, PostgreSQL, Neo4j, Docker

Personal Portfolio Website (2023)
• Responsive web application showcasing projects and skills
• Implemented dark mode, animations, and accessibility features
• Technologies: Next.js, TypeScript, Tailwind CSS, Vercel`,
          lastUpdated: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          wordCount: 67,
          linkedNotes: ['project_planning', 'technical_decisions']
        }
      ];

      const mockStats: CVStats = {
        totalSections: mockSections.length,
        totalWordCount: mockSections.reduce((sum, section) => sum + section.wordCount, 0),
        completionPercentage: 85,
        lastUpdated: new Date(Math.max(...mockSections.map(s => s.lastUpdated.getTime())))
      };

      setPersonalInfo(mockPersonalInfo);
      setCvSections(mockSections);
      setStats(mockStats);
    } catch (error) {
      console.error('Failed to load CV data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getSectionIcon = (sectionId: string) => {
    switch (sectionId) {
      case 'summary':
        return <DocumentTextIcon className="w-5 h-5" />;
      case 'experience':
        return <BriefcaseIcon className="w-5 h-5" />;
      case 'education':
        return <AcademicCapIcon className="w-5 h-5" />;
      case 'skills':
        return <CodeBracketIcon className="w-5 h-5" />;
      case 'projects':
        return <ChartBarIcon className="w-5 h-5" />;
      default:
        return <DocumentTextIcon className="w-5 h-5" />;
    }
  };

  const getCompletionColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600 dark:text-green-400';
    if (percentage >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString([], { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

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
            CV Overview
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage and track your professional profile built from your knowledge base
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors">
            Export PDF
          </button>
          <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
            Generate from Notes
          </button>
        </div>
      </div>

      {/* Personal Info Card */}
      {personalInfo && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
          <div className="flex items-start space-x-6">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
              {personalInfo.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {personalInfo.name}
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-400 mb-4">
                {personalInfo.title}
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                    <EnvelopeIcon className="w-4 h-4" />
                    <span>{personalInfo.email}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                    <PhoneIcon className="w-4 h-4" />
                    <span>{personalInfo.phone}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                    <MapPinIcon className="w-4 h-4" />
                    <span>{personalInfo.location}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  {personalInfo.website && (
                    <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                      <GlobeAltIcon className="w-4 h-4" />
                      <a 
                        href={personalInfo.website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Website
                      </a>
                    </div>
                  )}
                  {personalInfo.linkedin && (
                    <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                      <BuildingOfficeIcon className="w-4 h-4" />
                      <a 
                        href={personalInfo.linkedin} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        LinkedIn
                      </a>
                    </div>
                  )}
                  {personalInfo.github && (
                    <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                      <CodeBracketIcon className="w-4 h-4" />
                      <a 
                        href={personalInfo.github} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        GitHub
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <DocumentTextIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Sections</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.totalSections}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                <ChartBarIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Word Count</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.totalWordCount}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
                <StarIcon className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Completion</p>
                <p className={`text-2xl font-bold ${getCompletionColor(stats.completionPercentage)}`}>
                  {stats.completionPercentage}%
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <CalendarIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Last Updated</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {formatDate(stats.lastUpdated)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CV Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {cvSections.map((section) => (
          <div
            key={section.id}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden"
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    {getSectionIcon(section.id)}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {section.title}
                    </h3>
                    <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                      <span>{section.wordCount} words</span>
                      <span>Updated {formatDate(section.lastUpdated)}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedSection(selectedSection === section.id ? null : section.id)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title={selectedSection === section.id ? "Hide section details" : "Show section details"}
                  aria-label={selectedSection === section.id ? "Hide section details" : "Show section details"}
                >
                  <EyeIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
              </div>

              {selectedSection === section.id && (
                <div className="mb-4">
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <pre className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200 font-mono">
                      {section.content}
                    </pre>
                  </div>
                </div>
              )}

              {section.linkedNotes.length > 0 && (
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Linked Notes ({section.linkedNotes.length}):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {section.linkedNotes.map((noteId) => (
                      <button
                        key={noteId}
                        onClick={() => {
                          // TODO: Navigate to linked note
                          console.log('Navigate to note:', noteId);
                        }}
                        className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded-full hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                      >
                        {noteId}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 px-6 py-3">
              <div className="flex items-center justify-between">
                <button className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                  Edit Section
                </button>
                <button className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
                  Regenerate from Notes
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CVOverview;
