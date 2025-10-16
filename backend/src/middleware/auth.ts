import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../index';

// JWTの型定義
interface JWTPayload {
  userId: string;
}

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    areaId: string;
    name: string;
  };
  file?: Express.Multer.File;
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '認証が必要です' });
    }

    const token = authHeader.substring(7);
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      return res.status(500).json({ error: 'サーバー設定エラー' });
    }

    const decoded = jwt.verify(token, secret) as JWTPayload;
    
    // Verify user still exists in database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        displayId: true,
        name: true
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'ユーザーが見つかりません' });
    }

    req.user = user;
    return next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: '認証トークンが無効です' });
    }
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: '認証トークンの有効期限が切れています' });
    }
    
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
}; 