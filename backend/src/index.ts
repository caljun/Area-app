import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import rateLimit from 'express-rate-limit';

// Import routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import areaRoutes from './routes/areas';
import friendRoutes from './routes/friends';
import locationRoutes from './routes/locations';
import imageRoutes from './routes/images';
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

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/areas', authMiddleware, areaRoutes);
app.use('/api/friends', authMiddleware, friendRoutes);
app.use('/api/locations', authMiddleware, locationRoutes);
app.use('/api/images', imageRoutes); // 認証不要なエンドポイントがあるため、authMiddlewareを削除 
// app.use('/api/images/upload', authMiddleware, uploadRoutes); 

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', (userId: any) => {
    socket.join(`user_${userId}`);
    console.log(`User ${userId} joined their room`);
  });

  socket.on('updateLocation', (data: any) => {
    // Broadcast location update to friends
    socket.broadcast.to(`user_${data.userId}`).emit('locationUpdate', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
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