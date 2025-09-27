import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// Validation schemas
const updateLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180)
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

    // 友達に位置情報更新通知を送信
    try {
      const friends = await prisma.friend.findMany({
        where: { userId: req.user!.id },
        include: {
          friend: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      // 各友達に通知を作成
      for (const friend of friends) {
        await prisma.notification.create({
          data: {
            type: 'LOCATION_UPDATE',
            title: '位置情報更新',
            message: `${req.user!.name}さんの位置情報が更新されました`,
            data: {
              userId: req.user!.id,
              userName: req.user!.name,
              latitude,
              longitude,
              timestamp: new Date()
            },
            recipientId: friend.friend.id,
            senderId: req.user!.id
          }
        });
      }
    } catch (notificationError) {
      console.error('Failed to create location update notifications:', notificationError);
      // 通知作成に失敗しても位置情報更新は成功とする
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
    
    // 最新の位置情報を取得
    const locations = await prisma.location.findMany({
      where: {
        userId: { in: friendIds }
      },
      orderBy: { createdAt: 'desc' },
      distinct: ['userId']
    });
    
    console.log(`取得した位置情報数: ${locations.length}`);
    locations.forEach(loc => {
      console.log(`位置情報 - userId: ${loc.userId}, lat: ${loc.latitude}, lng: ${loc.longitude}, areaId: ${loc.areaId}`);
    });

    // 友達情報と位置情報を結合
    const friendsWithLocations = friends
      .map(friend => {
        const location = locations.find(loc => loc.userId === friend.friend.id);
        
        // 位置情報がない場合は、位置情報なしとして返す
        if (!location) {
          console.log(`友達の位置情報がありません - userId: ${friend.friend.id}, name: ${friend.friend.name}`);
          return {
            userId: friend.friend.id,
            latitude: null, // 位置情報なしを示す
            longitude: null,
            accuracy: null,
            timestamp: new Date().toISOString(), // 現在時刻
            areaId: null,
            userName: friend.friend.name,
            profileImage: friend.friend.profileImage
          };
        }
        
        // 位置情報が0,0の場合は除外（無効な位置情報）
        if (location.latitude === 0 && location.longitude === 0) {
          console.log(`友達の位置情報が無効です (0,0) - userId: ${friend.friend.id}, name: ${friend.friend.name}`);
          return {
            userId: friend.friend.id,
            latitude: null, // 位置情報なしを示す
            longitude: null,
            accuracy: null,
            timestamp: new Date().toISOString(), // 現在時刻
            areaId: null,
            userName: friend.friend.name,
            profileImage: friend.friend.profileImage
          };
        }
        
        return {
          userId: friend.friend.id,
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: 10.0, // デフォルト精度
          timestamp: location.createdAt.toISOString(),
          areaId: location.areaId || null,
          userName: friend.friend.name,
          profileImage: friend.friend.profileImage
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