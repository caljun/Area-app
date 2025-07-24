import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../index';
import { createError } from '../middleware/errorHandler';

// JWTの型定義
interface JWTPayload {
  userId: string;
}

const router = Router();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  nowId: z.string().min(3, 'Now ID must be at least 3 characters'),
  name: z.string().min(1, 'Name is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  profileImage: z.string().url('Profile image URL is required')
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required')
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
        error: existingUser.email === email ? 'Email already registered' : 'Now ID already taken'
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
        profileImage
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
        error: 'Validation error',
        details: error.errors
      });
    }
    
    console.error('Register error:', error);
    return res.status(500).json({ error: 'Internal server error' });
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
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
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
        name: user.name
      },
      token
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    }
    
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user
router.get('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as JWTPayload;

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        nowId: true,
        name: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    return res.json({ user });
  } catch (error) {
    console.error('Get current user error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 