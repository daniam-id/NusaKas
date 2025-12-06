import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service.js';
import type { User, JwtPayload } from '../types/index.js';

export interface AuthenticatedRequest extends Request {
  user?: User;
  jwtPayload?: JwtPayload;
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: 'Missing or invalid authorization header',
    });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const payload = authService.verifyToken(token);
    req.jwtPayload = payload;

    authService.getUserById(payload.userId)
      .then((user) => {
        if (!user) {
          res.status(401).json({
            success: false,
            error: 'User not found',
          });
          return;
        }
        req.user = user;
        next();
      })
      .catch(() => {
        res.status(500).json({
          success: false,
          error: 'Failed to fetch user',
        });
      });
  } catch {
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
    });
  }
}

export function optionalAuthMiddleware(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.substring(7);

  try {
    const payload = authService.verifyToken(token);
    req.jwtPayload = payload;

    authService.getUserById(payload.userId)
      .then((user) => {
        if (user) {
          req.user = user;
        }
        next();
      })
      .catch(() => {
        next();
      });
  } catch {
    next();
  }
}
