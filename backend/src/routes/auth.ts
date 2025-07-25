import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../index';
import { createError } from '../middleware/errorHandler';
import { authMiddleware, AuthRequest } from '../middleware/auth';

// JWTの型定義
interface JWTPayload {
  userId: string;
}

const router = Router();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('メールアドレスの形式が正しくありません'),
  nowId: z.string().min(3, 'Now IDは3文字以上で入力してください'),
  name: z.string().min(1, 'ユーザー名は必須です'),
  password: z.string().min(6, 'パスワードは6文字以上で入力してください'),
  profileImage: z.string().url('プロフィール画像のURLが正しくありません').optional()
});

const loginSchema = z.object({
  email: z.string().email('メールアドレスの形式が正しくありません'),
  password: z.string().min(1, 'パスワードは必須です')
});

// Register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, nowId, name, password, profileImage } = registerSchema.parse(req.body);

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { nowId }
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json({
        error: existingUser.email === email ? 'このメールアドレスは既に登録されています' : 'このNow IDは既に使用されています'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        nowId,
        name,
        password: hashedPassword,
        profileImage: profileImage || null
      },
      select: {
        id: true,
        email: true,
        nowId: true,
        name: true,
        profileImage: true,
        createdAt: true
      }
    });

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id } as JWTPayload,
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as any
    );

    return res.status(201).json({
      message: 'User registered successfully',
      user,
      token
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: '入力内容に問題があります',
        details: error.errors
      });
    }
    
    console.error('Register error:', error);
    return res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません' });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id } as JWTPayload,
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as any
    );

    return res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        nowId: user.nowId,
        name: user.name,
        profileImage: user.profileImage
      },
      token
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: '入力内容に問題があります',
        details: error.errors
      });
    }
    
    console.error('Login error:', error);
    return res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// Get current user
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // 最新のユーザー情報を取得（profileImageを含む）
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        nowId: true,
        name: true,
        profileImage: true,
        createdAt: true
      }
    });
    
    return res.json({ user });
  } catch (error) {
    console.error('Get current user error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 