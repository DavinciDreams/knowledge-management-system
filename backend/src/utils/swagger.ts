import swaggerJSDoc from 'swagger-jsdoc';
import { config } from '@/config';

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Universal Knowledge Management System API',
      version: '1.0.0',
      description: `
        A comprehensive knowledge management system that combines OneNote's universal data import capabilities,
        infinite canvas with robust pen input, Excalidraw-like diagramming, Notion's publishing capabilities,
        and AI-first knowledge base functionality with voice-driven interaction, knowledge graph visualization,
        real-time collaboration, and intelligent entity extraction for calendar integration.
      `,
      contact: {
        name: 'API Support',
        email: 'support@example.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: `http://localhost:${config.port}`,
        description: 'Development server',
      },
      {
        url: 'https://api.example.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Authorization header using the Bearer scheme',
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'auth-token',
          description: 'Authentication token stored in cookie',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'string',
              example: 'Error message',
            },
            statusCode: {
              type: 'integer',
              example: 400,
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            email: {
              type: 'string',
              format: 'email',
            },
            name: {
              type: 'string',
            },
            avatar: {
              type: 'string',
              format: 'url',
            },
            settings: {
              type: 'object',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Notebook: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            title: {
              type: 'string',
            },
            description: {
              type: 'string',
            },
            color: {
              type: 'string',
            },
            icon: {
              type: 'string',
            },
            isPublic: {
              type: 'boolean',
            },
            userId: {
              type: 'string',
              format: 'uuid',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Page: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            title: {
              type: 'string',
            },
            content: {
              type: 'object',
            },
            type: {
              type: 'string',
              enum: ['note', 'canvas', 'diagram'],
            },
            notebookId: {
              type: 'string',
              format: 'uuid',
            },
            parentId: {
              type: 'string',
              format: 'uuid',
            },
            order: {
              type: 'integer',
            },
            isPublic: {
              type: 'boolean',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Canvas: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            name: {
              type: 'string',
            },
            description: {
              type: 'string',
            },
            width: {
              type: 'integer',
            },
            height: {
              type: 'integer',
            },
            background: {
              type: 'object',
            },
            userId: {
              type: 'string',
              format: 'uuid',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        CanvasElement: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            type: {
              type: 'string',
              enum: ['shape', 'text', 'image', 'pen'],
            },
            x: {
              type: 'number',
            },
            y: {
              type: 'number',
            },
            width: {
              type: 'number',
            },
            height: {
              type: 'number',
            },
            rotation: {
              type: 'number',
            },
            zIndex: {
              type: 'integer',
            },
            data: {
              type: 'object',
            },
            style: {
              type: 'object',
            },
          },
        },
        KnowledgeNode: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            type: {
              type: 'string',
            },
            title: {
              type: 'string',
            },
            content: {
              type: 'string',
            },
            metadata: {
              type: 'object',
            },
            userId: {
              type: 'string',
              format: 'uuid',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        VoiceNote: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            title: {
              type: 'string',
            },
            audioUrl: {
              type: 'string',
              format: 'url',
            },
            transcript: {
              type: 'string',
            },
            duration: {
              type: 'number',
            },
            language: {
              type: 'string',
            },
            userId: {
              type: 'string',
              format: 'uuid',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization endpoints',
      },
      {
        name: 'Users',
        description: 'User profile management',
      },
      {
        name: 'Notebooks',
        description: 'Notebook management operations',
      },
      {
        name: 'Pages',
        description: 'Page content management',
      },
      {
        name: 'Search',
        description: 'Full-text and semantic search',
      },
      {
        name: 'Canvas',
        description: 'Infinite canvas and drawing operations',
      },
      {
        name: 'Graph',
        description: 'Knowledge graph operations',
      },
      {
        name: 'Voice',
        description: 'Voice note and transcription management',
      },
      {
        name: 'Ingest',
        description: 'File upload and content import',
      },
      {
        name: 'Collaboration',
        description: 'Real-time collaboration features',
      },
    ],
  },
  apis: [
    './src/routes/*.ts', // Path to the API files
    './src/controllers/*.ts', // Path to the controller files
  ],
};

const swaggerSpec = swaggerJSDoc(options);

export default swaggerSpec;
export { swaggerSpec };
