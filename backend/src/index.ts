import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';

// Import routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import areaRoutes from './routes/areas';
import friendRoutes from './routes/friends';
import locationRoutes from './routes/locations';
import imageRoutes from './routes/images';
import notificationRoutes from './routes/notifications';
// import uploadRoutes from './routes/upload'; 

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';

// Import database
import { PrismaClient } from '@prisma/client';

// 型の問題を回避
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      PORT?: string;
      NODE_ENV?: string;
      DATABASE_URL?: string;
      JWT_SECRET?: string;
      JWT_EXPIRES_IN?: string;
      CORS_ORIGIN?: string;
      RATE_LIMIT_WINDOW_MS?: string;
      RATE_LIMIT_MAX_REQUESTS?: string;
      CLOUDINARY_CLOUD_NAME?: string;
      CLOUDINARY_API_KEY?: string;
      CLOUDINARY_API_SECRET?: string;
      MAPBOX_ACCESS_TOKEN?: string;
    }
  }
}

// JWTの型定義
interface JWTPayload {
  userId: string;
}

// Load environment variables
dotenv.config();

// 環境変数の検証
const requiredEnvVars = [
  'JWT_SECRET',
  'DATABASE_URL',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars);
  process.exit(1);
}

// デバッグ用：環境変数の確認（本番環境では詳細を出力しない）
if (process.env.NODE_ENV === 'development') {
  console.log('🔍 Environment variables check:');
  console.log('CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME);
  console.log('CLOUDINARY_API_KEY:', process.env.CLOUDINARY_API_KEY);
  console.log('CLOUDINARY_API_SECRET:', !!process.env.CLOUDINARY_API_SECRET);
}

const app = express();
// プロキシ設定をより安全に設定
app.set('trust proxy', 1); // または特定のプロキシIPを指定
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:8081",
    methods: ["GET", "POST"]
  }
});

// Initialize Prisma
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// データベース接続テスト
prisma.$connect()
  .then(() => {
    console.log('✅ Database connected successfully');
  })
  .catch((error) => {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  });

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // limit each IP to 100 requests per windowMs
  message: 'リクエストが多すぎます。しばらく時間をおいてから再試行してください。',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});

// 認証エンドポイント用の厳しいレート制限
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5回まで
  message: 'ログイン試行回数が上限に達しました。しばらく時間をおいてから再試行してください。',
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:8081",
  credentials: true
}));
app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Session validation API for SwiftUI app (requires authentication)
app.get('/api/session', authLimiter, authMiddleware, async (req: any, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        areaId: true,
        name: true,
        profileImage: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'ユーザーが見つかりません' });
    }

    // プロフィールの完全性をチェック
    const missingFields = [];
    if (!user.name) missingFields.push('name');
    if (!user.areaId) missingFields.push('areaId');
    if (!user.profileImage) missingFields.push('profileImage');
    const profileComplete = missingFields.length === 0;

    return res.json({
      token: req.headers.authorization?.replace('Bearer ', ''),
      user: {
        id: user.id,
        email: user.email,
        areaId: user.areaId,
        name: user.name,
        profileImage: user.profileImage,
        createdAt: user.createdAt
      },
      profileComplete,
      missingFields
    });
  } catch (error) {
    console.error('Session validation error:', error);
    return res.status(500).json({ error: 'セッション検証に失敗しました' });
  }
});

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/areas', authMiddleware, areaRoutes);
app.use('/api/friends', authMiddleware, friendRoutes);
app.use('/api/locations', authMiddleware, locationRoutes);
app.use('/api/images', imageRoutes); // 認証不要なエンドポイントがあるため、authMiddlewareを削除 
app.use('/api/notifications', authMiddleware, notificationRoutes);
// app.use('/api/images/upload', authMiddleware, uploadRoutes); 

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // 認証処理
  socket.on('authenticate', async (token: string) => {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as JWTPayload;
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, name: true }
      });
      
      if (user) {
        socket.data.userId = user.id;
        socket.data.userName = user.name;
        socket.emit('authenticated', { userId: user.id });
        console.log(`User ${user.name} (${user.id}) authenticated`);
      } else {
        socket.emit('auth_error', { message: 'Invalid user' });
      }
    } catch (error) {
      socket.emit('auth_error', { message: 'Invalid token' });
    }
  });

  socket.on('join', (userId: string) => {
    if (socket.data.userId === userId) {
      socket.join(`user_${userId}`);
      console.log(`User ${userId} joined their room`);
      
      // オンライン状態を友達に通知
      socket.broadcast.emit('friendStatusUpdate', {
        userId: userId,
        isOnline: true,
        lastSeen: new Date()
      });
    }
  });

  socket.on('updateLocation', async (data: any) => {
    if (socket.data.userId === data.userId) {
      try {
        // データベースに位置情報を保存
        await prisma.location.create({
          data: {
            userId: data.userId,
            latitude: data.latitude,
            longitude: data.longitude
          }
        });

        // 友達に位置情報をブロードキャスト
        socket.broadcast.emit('locationUpdate', {
          ...data,
          timestamp: new Date()
        });
      } catch (error) {
        console.error('Failed to save location:', error);
      }
    }
  });

  socket.on('updateStatus', (data: any) => {
    if (socket.data.userId === data.userId) {
      socket.broadcast.emit('friendStatusUpdate', {
        userId: data.userId,
        isOnline: data.isOnline,
        lastSeen: data.lastSeen
      });
    }
  });

  socket.on('disconnect', () => {
    if (socket.data.userId) {
      // オフライン状態を友達に通知
      socket.broadcast.emit('friendStatusUpdate', {
        userId: socket.data.userId,
        isOnline: false,
        lastSeen: new Date()
      });
      console.log(`User ${socket.data.userName} (${socket.data.userId}) disconnected`);
    }
  });
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 CORS origin: ${process.env.CORS_ORIGIN || "http://localhost:8081"}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`☁️ Cloudinary config check:`, {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? '✅' : '❌',
    api_key: process.env.CLOUDINARY_API_KEY ? '✅' : '❌',
    api_secret: process.env.CLOUDINARY_API_SECRET ? '✅' : '❌'
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await prisma.$disconnect();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// グローバルエラーハンドラー
process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception:', error);
  console.error('Stack trace:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// WebSocketエラーハンドラー
io.on('error', (error) => {
  console.error('🚨 WebSocket error:', error);
});

server.on('error', (error) => {
  console.error('🚨 Server error:', error);
});