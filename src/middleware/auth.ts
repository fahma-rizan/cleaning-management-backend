import { Request, Response, NextFunction } from 'express';

export interface AuthRequest extends Request {
  admin?: {
    id:    string;
    role:  string;
    email: string;
  };
}

// Mock authenticate — change role here to test different roles
export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  req.admin = {
    id:    '507f1f77bcf86cd799439011',
    role:  'Super Admin',
    email: 'superadmin@cloudlaundry.lk',
  };
  next();
};