import { User } from '../entities/user.entity';

declare module 'express-session' {
  interface SessionData {
    userId?: number;
    csrfToken?: string;
    lastUsername?: string;
    flash?: {
      type: 'success' | 'error' | 'info';
      message: string;
    };
    viewedPosts?: number[];
    viewedImages?: number[];
    likedImages?: number[];
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export {};
