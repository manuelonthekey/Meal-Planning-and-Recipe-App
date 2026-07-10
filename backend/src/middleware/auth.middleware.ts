import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../db';

export interface AuthRequest extends Request {
  user?: any;
}

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No token provided' } });
    return;
  }

  try {
    const secret = process.env.JWT_SECRET || 'secret';
    const decoded = jwt.verify(token, secret) as { id: string, email: string };
    
    // Verify user exists in database
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    
    if (!user) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not found' } });
      return;
    }
    
    req.user = user;
    next();
  } catch (err) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Invalid token' } });
  }
};
