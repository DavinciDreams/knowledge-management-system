import { User } from './index';

// Global type augmentation for Express Request
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export {};
