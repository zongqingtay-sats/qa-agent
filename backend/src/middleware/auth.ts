import { Request, Response, NextFunction } from 'express';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

// Augment Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Reads user info from headers injected by the frontend proxy.
 * Auth is handled entirely by NextAuth in the frontend — the backend
 * trusts the forwarded headers and does not verify tokens.
 */
export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const id = req.headers['x-user-id'] as string || '';
  const email = req.headers['x-user-email'] as string || '';
  const name = req.headers['x-user-name'] as string || '';

  req.user = { id: id || 'anonymous', email, name };
  next();
}
