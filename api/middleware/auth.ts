import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../../shared/types';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Access token required'
      });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT_SECRET not configured');
      res.status(500).json({
        success: false,
        message: 'Server configuration error'
      });
      return;
    }

    const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
    
    // You might want to fetch the full user from database here
    // For now, we'll use the token payload
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role as 'user' | 'admin',
      username: '', // Will be populated from database if needed
      full_name: '', // Will be populated from database if needed
      subscription_type: 'free', // Will be populated from database if needed
      created_at: '',
      updated_at: ''
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(403).json({
        success: false,
        message: 'Invalid or expired token'
      });
      return;
    }

    console.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    if (req.user.role !== 'admin') {
      res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Admin authorization error:', error);
    res.status(500).json({
      success: false,
      message: 'Authorization failed'
    });
  }
};

export const requirePremium = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    if (req.user.subscription_type === 'free') {
      res.status(403).json({
        success: false,
        message: 'Premium subscription required'
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Premium authorization error:', error);
    res.status(500).json({
      success: false,
      message: 'Authorization failed'
    });
  }
};

// Generic role requirement middleware
export const requireRole = (role: 'user' | 'admin') => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      if (req.user.role !== role) {
        res.status(403).json({
          success: false,
          message: `${role} access required`
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Role authorization error:', error);
      res.status(500).json({
        success: false,
        message: 'Authorization failed'
      });
    }
  };
};

// Optional authentication - doesn't fail if no token provided
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      next();
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      next();
      return;
    }

    const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
    
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role as 'user' | 'admin',
      username: '',
      full_name: '',
      subscription_type: 'free',
      created_at: '',
      updated_at: ''
    };

    next();
  } catch (error) {
    // Ignore token errors for optional auth
    next();
  }
};

// Generate JWT token
export const generateToken = (user: { id: string; email: string; role: string }): string => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET not configured');
  }

  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role
    },
    jwtSecret,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    }
  );
};

// Generate refresh token
export const generateRefreshToken = (user: { id: string; email: string }): string => {
  const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  if (!refreshSecret) {
    throw new Error('JWT_REFRESH_SECRET not configured');
  }

  return jwt.sign(
    {
      userId: user.id,
      email: user.email
    },
    refreshSecret,
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
    }
  );
};

// Verify refresh token
export const verifyRefreshToken = (token: string): JwtPayload => {
  const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  if (!refreshSecret) {
    throw new Error('JWT_REFRESH_SECRET not configured');
  }

  return jwt.verify(token, refreshSecret) as JwtPayload;
};