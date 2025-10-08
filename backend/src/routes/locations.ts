import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma, io } from '../index';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// Validation schemas
const updateLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180)
});

// Spec-compliant: POST /location
// { userId, latitude, longitude, timestamp }
router.post('/', async (req: Request, res: Response) => {
  try {
    const { userId, latitude, longitude, timestamp } = req.body || {};

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'userId は必須です' });
    }
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({ error: 'latitude と longitude は数値で必須です' });
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({ error: '緯度経度の範囲が不正です' });
    }
    if (latitude === 0 && longitude === 0) {
      return res.status(400).json({ error: '無効な位置情報です' });
    }

    const createdAt = timestamp ? new Date(timestamp) : undefined;

    const location = await prisma.location.create({
      data: {
        userId,
        latitude,
        longitude,
        ...(createdAt ? { createdAt } : {})
      }
    });

    // WebSocket push to all clients (or clients can filter by userId)
    io.emit('locationUpdate', {
      userId,
      latitude,
      longitude,
      timestamp: location.createdAt
    });

    return res.status(201).json({
      success: true,
      location: {
        userId: location.userId,
        latitude: location.latitude,
        longitude: location.longitude,
        timestamp: location.createdAt
      }
    });
  } catch (error) {
    console.error('POST /location error:', error);
    return res.status(500).json({ error: '位置情報の保存に失敗しました' });
  }
});

// Spec-compliant: GET /location/:userId -> latest
// Note: Restrict :userId to a 24-hex MongoDB ObjectId to avoid matching static routes like 'sharing' or 'friends'
router.get('/:userId([a-f0-9]{24})', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ error: 'userId は必須です' });
    }

    const latest = await prisma.location.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    if (!latest) {
      return res.status(404).json({ error: '位置情報が見つかりません' });
    }

    return res.json({
      userId: latest.userId,
      latitude: latest.latitude,
      longitude: latest.longitude,
      timestamp: latest.createdAt
    });
  } catch (error) {
    console.error('GET /location/:userId error:', error);
    return res.status(500).json({ error: '最新位置情報の取得に失敗しました' });
  }
});

// Update user location
router.post('/update', async (req: AuthRequest, res: Response) => {
  try {
    const { latitude, longitude, accuracy, timestamp, areaId } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: '緯度と経度が必要です' });
    }
    
    // 位置情報が0,0の場合は無効として拒否
    if (latitude === 0 && longitude === 0) {
      console.log(`無効な位置情報が送信されました (0,0) - userId: ${req.user!.id}`);
      return res.status(400).json({ error: '無効な位置情報です' });
    }

    console.log(`位置情報更新 - userId: ${req.user!.id}, lat: ${latitude}, lng: ${longitude}, areaId: ${areaId}`);
    
    const location = await prisma.location.create({
      data: {
        userId: req.user!.id,
        latitude,
        longitude,
        areaId: areaId || null
      }
    });
    
    console.log(`位置情報保存完了 - locationId: ${location.id}`);

    // エリア内にいるかチェック
    let isInArea = false;
    if (areaId) {
      const area = await prisma.area.findUnique({
        where: { id: areaId }
      });
      
      if (area) {
        // 簡易的なエリア内判定（実際の実装ではより正確なポリゴン判定が必要）
        const coords = area.coordinates as any;
        if (coords && Array.isArray(coords) && coords.length >= 3) {
          // ここでポリゴン内判定を行う（簡易版）
          isInArea = true; // 仮実装
        }
      }
    }

    // 友達に位置情報更新通知を送信（WebSocket経由）
    try {
      const friends = await prisma.friend.findMany({
        where: {
          OR: [
            { userId: req.user!.id },
            { friendId: req.user!.id }
          ]
        },
        include: {
          user: { select: { id: true, name: true, profileImage: true } },
          friend: { select: { id: true, name: true, profileImage: true } }
        }
      });

      // 友達IDを抽出
      const friendIds: string[] = [];
      friends.forEach(friend => {
        if (friend.userId === req.user!.id && friend.friend) {
          friendIds.push(friend.friend.id);
        } else if (friend.friendId === req.user!.id && friend.user) {
          friendIds.push(friend.user.id);
        }
      });

      // ユーザー情報を取得（profileImageを含む）
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { id: true, name: true, profileImage: true }
      });

      // WebSocket経由で友達に位置情報更新を通知
      const locationUpdateData = {
        action: 'friend_location_update',
        userId: req.user!.id,
        userName: user?.name || req.user!.name,
        profileImage: user?.profileImage,
        latitude,
        longitude,
        areaId: areaId,
        timestamp: new Date().getTime()
      };

      // 各友達のルームに送信
      friendIds.forEach(friendId => {
        io.to(`user_${friendId}`).emit('location', {
          type: 'location',
          data: locationUpdateData
        });
      });

      console.log(`Location API: Position update sent to ${friendIds.length} friends via WebSocket`);
      
    } catch (notificationError) {
      console.error('Failed to send location update via WebSocket:', notificationError);
      // WebSocket送信に失敗しても位置情報更新は成功とする
    }

    return res.status(200).json({
      success: true,
      message: '位置情報が更新されました',
      areaId: areaId || null,
      isInArea
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: '入力内容に問題があります',
        details: error.errors
      });
    }
    
    console.error('Update location error:', error);
    return res.status(500).json({ error: '位置情報の更新に失敗しました' });
  }
});

// Get friend locations
router.get('/friends', async (req: AuthRequest, res: Response) => {
  try {
    const friends = await prisma.friend.findMany({
      where: {
        OR: [
          { userId: req.user!.id },
          { friendId: req.user!.id }
        ]
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profileImage: true
          }
        },
        friend: {
          select: {
            id: true,
            name: true,
            profileImage: true
          }
        }
      }
    });

    // 双方向の友達関係から友達IDを抽出
    const friendIds: string[] = [];
    friends.forEach(friend => {
      if (friend.userId === req.user!.id && friend.friend) {
        friendIds.push(friend.friend.id);
      } else if (friend.friendId === req.user!.id && friend.user) {
        friendIds.push(friend.user.id);
      }
    });
    console.log(`友達ID一覧: ${JSON.stringify(friendIds)}`);
    
    // ユーザーごとに「本当に最新の1件」を厳密に取得
    const latestLocationList = await Promise.all(
      friendIds.map(async (fid) => {
        return prisma.location.findFirst({
          where: { userId: fid },
          orderBy: { createdAt: 'desc' }
        });
      })
    );

    // userId -> 最新位置 のマップを作成
    const userIdToLatestLocation = new Map<string, typeof latestLocationList[number]>();
    latestLocationList.forEach((loc) => {
      if (loc) {
        userIdToLatestLocation.set(loc.userId, loc);
      }
    });

    console.log(`取得した位置情報数: ${userIdToLatestLocation.size}`);
    userIdToLatestLocation.forEach((loc) => {
      console.log(`位置情報 - userId: ${loc!.userId}, lat: ${loc!.latitude}, lng: ${loc!.longitude}, areaId: ${loc!.areaId}`);
    });

    // 友達情報と位置情報を結合
    const friendsWithLocations = friends
      .map(friend => {
        // 双方向の友達関係から正しい友達IDを取得
        const friendId = friend.userId === req.user!.id ? friend.friend!.id : friend.user!.id;
        const friendName = friend.userId === req.user!.id ? friend.friend!.name : friend.user!.name;
        const friendProfileImage = friend.userId === req.user!.id ? friend.friend!.profileImage : friend.user!.profileImage;
        
        const location = userIdToLatestLocation.get(friendId);
        
        // 位置情報がない場合は、位置情報なしとして返す
        if (!location) {
          console.log(`友達の位置情報がありません - userId: ${friendId}, name: ${friendName}`);
          return {
            userId: friendId,
            latitude: null, // 位置情報なしを示す
            longitude: null,
            accuracy: null,
            timestamp: new Date().toISOString(), // 現在時刻
            areaId: null,
            userName: friendName,
            profileImage: friendProfileImage
          };
        }
        
        // 位置情報が0,0の場合は除外（無効な位置情報）
        if (location.latitude === 0 && location.longitude === 0) {
          console.log(`友達の位置情報が無効です (0,0) - userId: ${friendId}, name: ${friendName}`);
          return {
            userId: friendId,
            latitude: null, // 位置情報なしを示す
            longitude: null,
            accuracy: null,
            timestamp: new Date().toISOString(), // 現在時刻
            areaId: null,
            userName: friendName,
            profileImage: friendProfileImage
          };
        }
        
        return {
          userId: friendId,
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: 10.0, // デフォルト精度
          timestamp: location.createdAt.toISOString(),
          areaId: location.areaId || null,
          userName: friendName,
          profileImage: friendProfileImage
        };
      });

    // デバッグログ: レスポンス内容を確認
    console.log('友達位置情報レスポンス:', JSON.stringify(friendsWithLocations, null, 2));
    
    // Areaフロントエンドの期待する形式でレスポンスを返す
    return res.json(friendsWithLocations);
  } catch (error) {
    console.error('Get friend locations error:', error);
    return res.status(500).json({ error: '友達の位置情報取得に失敗しました' });
  }
});

// Get location history
router.get('/history', async (req: AuthRequest, res: Response) => {
  try {
    const { page = '1', limit = '50' } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    const locations = await prisma.location.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum
    });

    const total = await prisma.location.count({
      where: { userId: req.user!.id }
    });

    return res.json({
      locations,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get location history error:', error);
    return res.status(500).json({ error: '位置情報履歴の取得に失敗しました' });
  }
});

// Get location sharing settings
router.get('/sharing', async (req: AuthRequest, res: Response) => {
  try {
    // 簡易的な位置共有設定（実際の実装では専用テーブルを作成）
    const settings = {
      enabled: true, // デフォルトで有効
      friends: [] as string[], // 共有対象の友達IDリスト（明示的にstring[]型を指定）
      lastUpdated: new Date().toISOString() // ISO8601形式で返す
    };

    return res.json(settings);
  } catch (error) {
    console.error('Get location sharing settings error:', error);
    return res.status(500).json({ error: '位置共有設定の取得に失敗しました' });
  }
});

// Update location sharing settings
router.put('/sharing', async (req: AuthRequest, res: Response) => {
  try {
    const { enabled, friends } = req.body;
    
    console.log('Location sharing settings update request:', { enabled, friends });

    // 簡易的な位置共有設定の更新（実際の実装では専用テーブルを作成）
    const settings = {
      enabled: enabled !== undefined ? enabled : true,
      friends: Array.isArray(friends) ? friends : [] as string[], // 配列であることを保証
      lastUpdated: new Date().toISOString() // ISO8601形式で返す
    };
    
    console.log('Location sharing settings response:', settings);

    return res.json(settings);
  } catch (error) {
    console.error('Update location sharing settings error:', error);
    return res.status(500).json({ error: '位置共有設定の更新に失敗しました' });
  }
});

export default router; 