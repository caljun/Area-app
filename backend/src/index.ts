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
import chatRoutes from './routes/chat';
// import uploadRoutes from './routes/upload'; 

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';

// Import database
import { PrismaClient } from '@prisma/client';

// Import Firebase Admin
import { initializeFirebaseAdmin, sendPushNotificationToMultiple, sendAreaEntryExitNotification } from './services/firebaseAdmin';

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
export const io = new Server(server, {
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
    // Firebase Admin SDKの初期化
    initializeFirebaseAdmin();
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
// 高頻度APIではユーザー単位で緩い制限を適用するため、グローバルは外す
// app.use(limiter);
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
      isNewUser: false,
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
// 認証済みかつ高頻度のルートはユーザーIDをキーにした緩い制限を適用
const authedKeyedLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分
  max: 600, // 600req/分 (10req/秒)
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => req.user?.id || req.ip,
});

app.use('/api/friends', authMiddleware, authedKeyedLimiter, friendRoutes);
app.use('/api/locations', authMiddleware, authedKeyedLimiter, locationRoutes);
app.use('/api/location', authMiddleware, locationRoutes); // フロントエンドの期待するエンドポイント
app.use('/api/images', imageRoutes); // 認証不要なエンドポイントがあるため、authMiddlewareを削除 
app.use('/api/notifications', authMiddleware, notificationRoutes);
app.use('/api/chat', authMiddleware, chatRoutes);
// app.use('/api/images/upload', authMiddleware, uploadRoutes); 

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('WebSocket: User connected:', socket.id);

  // 認証処理（クエリパラメータから認証情報を取得）
  const token = socket.handshake.query.token as string;
  const userId = socket.handshake.query.userId as string;
  
  if (token && userId) {
    // クエリパラメータから認証
    jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret', async (err, decoded) => {
      if (err) {
        console.log('WebSocket authentication failed:', err.message);
        socket.emit('auth_error', { message: 'Invalid token' });
        return;
      }
      
      try {
        const user = await prisma.user.findUnique({
          where: { id: (decoded as JWTPayload).userId },
          select: { id: true, name: true, profileImage: true }
        });
        
        if (user) {
          socket.data.userId = user.id;
          socket.data.userName = user.name;
          socket.data.profileImage = user.profileImage;
          
          // ユーザールームに参加
          socket.join(`user_${user.id}`);
          
          // 認証成功を通知
          socket.emit('connection', {
            type: 'connection',
            data: {
              status: 'connected',
              userId: user.id,
              userName: user.name
            }
          });
          
          console.log(`WebSocket: User ${user.name} (${user.id}) authenticated and joined room`);
          
          // オンライン状態を友達に通知
          socket.broadcast.emit('friendStatusUpdate', {
            userId: user.id,
            isOnline: true,
            lastSeen: new Date()
          });
        } else {
          socket.emit('auth_error', { message: 'Invalid user' });
        }
      } catch (error) {
        console.error('WebSocket user lookup error:', error);
        socket.emit('auth_error', { message: 'User lookup failed' });
      }
    });
  } else {
    // 従来の認証イベント処理
    socket.on('authenticate', async (token: string) => {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as JWTPayload;
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: { id: true, name: true, profileImage: true }
        });
        
        if (user) {
          socket.data.userId = user.id;
          socket.data.userName = user.name;
          socket.data.profileImage = user.profileImage;
          
          socket.join(`user_${user.id}`);
          socket.emit('authenticated', { userId: user.id });
          console.log(`WebSocket: User ${user.name} (${user.id}) authenticated`);
        } else {
          socket.emit('auth_error', { message: 'Invalid user' });
        }
      } catch (error) {
        socket.emit('auth_error', { message: 'Invalid token' });
      }
    });
  }

  // 位置情報更新の処理（Socket.ioイベントのみ）
  // 標準WebSocketメッセージハンドラーは削除して重複を防ぐ
  socket.on('location_update', async (data: any) => {
    await handleLocationUpdate(socket, data);
  });
  
  // 位置情報更新の共通処理関数
  async function handleLocationUpdate(socket: any, data: any) {
    if (!socket.data.userId) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }
    
    try {
      // 📍 詳細ログ出力
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🌐 WebSocket: 位置情報更新受信');
      console.log(`👤 userId: ${socket.data.userId}`);
      console.log(`🗺️  位置: (${data.latitude}, ${data.longitude})`);
      console.log(`🏠 エリアID: ${data.areaId || 'なし'}`);
      console.log(`⏰ 時刻: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`);
      
      // 前回の位置情報を取得（エリア入退場判定用）
      const previousLocation = await prisma.location.findFirst({
        where: { userId: socket.data.userId },
        orderBy: { createdAt: 'desc' }
      });
      
      // データベースに位置情報を保存
      const location = await prisma.location.create({
        data: {
          userId: socket.data.userId,
          latitude: data.latitude,
          longitude: data.longitude,
          areaId: data.areaId || null
        }
      });
      
      console.log(`✅ 位置情報保存完了 - locationId: ${location.id}`);
      
      // エリア入退場の判定
      const previousAreaId = previousLocation?.areaId || null;
      const currentAreaId = data.areaId || null;
      const isAreaEntry = !previousAreaId && currentAreaId; // エリアに入った
      const isAreaExit = previousAreaId && !currentAreaId; // エリアから出た
      const isAreaChange = previousAreaId && currentAreaId && previousAreaId !== currentAreaId; // エリア変更
      
      if (isAreaEntry || isAreaExit || isAreaChange) {
        console.log(`🎯 エリア状態変化検知: ${isAreaEntry ? '入場' : isAreaExit ? '退場' : '変更'} (${previousAreaId || 'なし'} → ${currentAreaId || 'なし'})`);
      }

      // 位置情報更新データ
      const locationUpdateData = {
        action: 'friend_location_update',
        userId: socket.data.userId,
        userName: socket.data.userName,
        profileImage: socket.data.profileImage,
        latitude: data.latitude,
        longitude: data.longitude,
        areaId: data.areaId,
        timestamp: location.createdAt.getTime()
      };

      // エリアが指定されている場合はエリア単位でbroadcast（優先）
      if (data.areaId && socket.data.currentAreaId === data.areaId) {
        // 同じエリアの全員に送信（自分以外）
        const roomName = `area_${data.areaId}`;
        const socketsInRoom = await io.in(roomName).fetchSockets();
        const recipientCount = socketsInRoom.length - 1; // 自分を除く
        
        socket.to(roomName).emit('location', {
          type: 'location',
          data: locationUpdateData
        });
        
        console.log(`🌐 WebSocket通知送信: エリア単位broadcast完了`);
        console.log(`📍 送信先エリアID: ${data.areaId}`);
        console.log(`📍 Room名: ${roomName}`);
        console.log(`👥 Room内のSocket数: ${socketsInRoom.length}人（自分含む）`);
        console.log(`📤 送信先: ${recipientCount}人（自分除く）`);
        console.log(`🔑 送信者socketId: ${socket.id}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        
        // エリアbroadcastで送信したのでreturn
        return;
      }
      
      // エリアが指定されていない場合は友達単位で個別送信（従来の方式・フォールバック）
      console.log(`🔄 エリアID未指定またはエリア未参加 - 友達単位で個別送信`);
      
      // 友達の位置情報を取得
      const friends = await prisma.friend.findMany({
        where: {
          OR: [
            { userId: socket.data.userId },
            { friendId: socket.data.userId }
          ]
        },
        include: {
          user: { select: { id: true } },
          friend: { select: { id: true } }
        }
      });

      // 友達IDを抽出（重複を排除）
      const friendIdsSet = new Set<string>();
      friends.forEach(friend => {
        if (friend.userId === socket.data.userId && friend.friend) {
          friendIdsSet.add(friend.friend.id);
        } else if (friend.friendId === socket.data.userId && friend.user) {
          friendIdsSet.add(friend.user.id);
        }
      });
      const friendIds = Array.from(friendIdsSet);

      // 各友達のルームに送信
      friendIds.forEach(friendId => {
        io.to(`user_${friendId}`).emit('location', {
          type: 'location',
          data: locationUpdateData
        });
      });

      console.log(`🌐 WebSocket通知送信: ${friendIds.length}人の友達に個別送信完了`);
      if (friendIds.length > 0) {
        console.log(`📤 送信先友達ID: ${friendIds.join(', ')}`);
      }
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      // 📱 Push通知送信（WebSocket未接続の友達向け）
      if (friendIds.length > 0) {
        try {
          // 友達のデバイストークンを取得
          const friendsWithTokens = await prisma.user.findMany({
            where: {
              id: { in: friendIds },
              deviceToken: { not: null }
            },
            select: {
              id: true,
              deviceToken: true,
              name: true
            }
          });
          
          const deviceTokens = friendsWithTokens
            .map(friend => friend.deviceToken)
            .filter((token): token is string => token !== null);
          
          if (deviceTokens.length > 0) {
            const userName = socket.data.userName || 'ユーザー';
            
            // エリア入退場時のみ通知表示、通常移動はサイレントPush
            if (isAreaEntry || isAreaExit || isAreaChange) {
              // エリア入退場通知（通知表示あり）
              let title = '';
              let body = '';
              
              if (isAreaEntry) {
                title = '友達がエリアに入りました';
                body = `${userName}さんがエリアに入りました`;
              } else if (isAreaExit) {
                title = '友達がエリアから出ました';
                body = `${userName}さんがエリアから出ました`;
              } else if (isAreaChange) {
                title = '友達がエリアを変更しました';
                body = `${userName}さんがエリアを変更しました`;
              }
              
              await sendAreaEntryExitNotification(
                deviceTokens,
                title,
                body,
                {
                  action: 'area_entry_exit',
                  userId: socket.data.userId,
                  userName: userName,
                  areaId: currentAreaId || '',
                  previousAreaId: previousAreaId || '',
                  latitude: String(data.latitude),
                  longitude: String(data.longitude),
                  timestamp: String(Date.now())
                }
              );
              
              console.log(`📱 エリア入退場通知送信完了: ${deviceTokens.length}人の友達に送信`);
            } else {
              // 通常の移動（サイレントPush）
              await sendPushNotificationToMultiple(
                deviceTokens,
                '友達が移動しました',
                `${userName}さんが位置を更新しました`,
                {
                  action: 'friend_moved',
                  userId: socket.data.userId,
                  userName: userName,
                  areaId: data.areaId || '',
                  latitude: String(data.latitude),
                  longitude: String(data.longitude),
                  timestamp: String(Date.now())
                }
              );
              
              console.log(`📱 サイレントPush送信完了: ${deviceTokens.length}人の友達に送信`);
            }
          }
        } catch (pushError) {
          console.error('Push通知送信エラー:', pushError);
          // Push通知のエラーはWebSocket送信には影響させない
        }
      }
      
    } catch (error) {
      console.error('WebSocket: Failed to process location update:', error);
      socket.emit('error', { message: 'Failed to update location' });
    }
  }

  // エリアに参加（エリア単位のRoom作成）
  socket.on('joinArea', async (data: { areaId: string }) => {
    if (!socket.data.userId) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }
    
    const { areaId } = data;
    
    // エリアのRoomに参加
    socket.join(`area_${areaId}`);
    
    // 現在のエリアを記録
    socket.data.currentAreaId = areaId;
    
    // ルーム参加確認（デバッグ用）
    const rooms = Array.from(socket.rooms);
    
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🏠 WebSocket: ユーザーがエリアに参加`);
    console.log(`👤 userId: ${socket.data.userId}`);
    console.log(`👤 userName: ${socket.data.userName || 'unknown'}`);
    console.log(`🗺️  areaId: ${areaId}`);
    console.log(`🔑 socketId: ${socket.id}`);
    console.log(`🚪 参加中のRooms: ${rooms.join(', ')}`);
    console.log(`⏰ 時刻: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    // エリア内の他のユーザーに通知
    socket.to(`area_${areaId}`).emit('location', {
      type: 'location',
      data: {
        action: 'user_joined_area',
        userId: socket.data.userId,
        userName: socket.data.userName,
        profileImage: socket.data.profileImage,
        areaId: areaId,
        timestamp: Date.now()
      }
    });
    
    // 参加確認を送信
    socket.emit('areaJoined', { areaId, success: true });
  });
  
  // エリアから退出
  socket.on('leaveArea', async (data: { areaId: string }) => {
    if (!socket.data.userId) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }
    
    const { areaId } = data;
    
    // エリアのRoomから退出
    socket.leave(`area_${areaId}`);
    
    // 現在のエリアをクリア
    if (socket.data.currentAreaId === areaId) {
      socket.data.currentAreaId = null;
    }
    
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🚪 WebSocket: ユーザーがエリアから退出`);
    console.log(`👤 userId: ${socket.data.userId}`);
    console.log(`🗺️  areaId: ${areaId}`);
    console.log(`⏰ 時刻: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    // エリア内の他のユーザーに通知
    socket.to(`area_${areaId}`).emit('location', {
      type: 'location',
      data: {
        action: 'user_left_area',
        userId: socket.data.userId,
        userName: socket.data.userName,
        areaId: areaId,
        timestamp: Date.now()
      }
    });
    
    // 退出確認を送信
    socket.emit('areaLeft', { areaId, success: true });
  });

  socket.on('join', (userId: string) => {
    if (socket.data.userId === userId) {
      socket.join(`user_${userId}`);
      console.log(`WebSocket: User ${userId} joined their room`);
      
      // オンライン状態を友達に通知
      socket.broadcast.emit('friendStatusUpdate', {
        userId: userId,
        isOnline: true,
        lastSeen: new Date()
      });
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
      console.log(`WebSocket: User ${socket.data.userName} (${socket.data.userId}) disconnected`);
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