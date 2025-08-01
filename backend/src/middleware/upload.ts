import multer from 'multer';
import { Request } from 'express';

interface MulterRequest extends Request {
  user?: any;
}

// Configure storage
const storage = multer.memoryStorage();

// File filter function
const fileFilter = (_req: MulterRequest, _file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Allow all file types for now - validation can be done in route handlers
  cb(null, true);
};

// Create multer instance with configuration
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
    files: 10 // Maximum 10 files
  }
});

// Export different upload configurations
export { upload };

export const uploadSingle = (fieldName: string) => upload.single(fieldName);
export const uploadMultiple = (fieldName: string, maxCount: number = 10) => upload.array(fieldName, maxCount);
export const uploadFields = (fields: multer.Field[]) => upload.fields(fields);

// Audio upload specific configuration
export const audioUpload = multer({
  storage,
  fileFilter: (_req: MulterRequest, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/m4a', 'audio/webm'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB for audio files
  }
});

// Document upload specific configuration
export const documentUpload = multer({
  storage,
  fileFilter: (_req: MulterRequest, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only document files are allowed'));
    }
  },
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB for documents
  }
});

// Image upload specific configuration
export const imageUpload = multer({
  storage,
  fileFilter: (_req: MulterRequest, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB for images
  }
});
