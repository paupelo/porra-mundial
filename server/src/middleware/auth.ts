import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AdminPayload { adminId: string; email: string; }

declare global {
  namespace Express {
    interface Request { admin?: AdminPayload; }
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) { res.status(401).json({ error: 'Sin autenticación' }); return; }
  const token = header.slice(7);
  try {
    req.admin = jwt.verify(token, process.env.JWT_SECRET ?? 'dev-secret') as AdminPayload;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
}
