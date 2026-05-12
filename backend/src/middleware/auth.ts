import { Request, Response, NextFunction } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { appConfig } from '../config';

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

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJWKS(tenantId: string) {
  const key = tenantId;
  if (!jwksCache.has(key)) {
    const jwksUrl = new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`);
    jwksCache.set(key, createRemoteJWKSet(jwksUrl));
  }
  return jwksCache.get(key)!;
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // Skip auth if disabled or Azure AD is not configured
  if (appConfig.authDisabled || !appConfig.azureAdClientId || !appConfig.azureAdTenantId) {
    req.user = { id: 'dev-user', email: 'dev@localhost', name: 'Developer' };
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: { message: 'Missing or invalid Authorization header' } });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const JWKS = getJWKS(appConfig.azureAdTenantId);
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://login.microsoftonline.com/${appConfig.azureAdTenantId}/v2.0`,
      audience: appConfig.azureAdClientId,
    });

    req.user = {
      id: (payload.oid as string) || (payload.sub as string) || '',
      email: (payload.preferred_username as string) || (payload.email as string) || '',
      name: (payload.name as string) || '',
    };

    next();
  } catch (err) {
    console.error('Auth token verification failed:', (err as Error).message);
    res.status(401).json({ error: { message: 'Invalid or expired token' } });
  }
}
