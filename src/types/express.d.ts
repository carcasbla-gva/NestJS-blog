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
