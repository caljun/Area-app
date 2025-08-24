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
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { latitude, longitude } = updateLocationSchema.parse(req.body);

    const location = await prisma.location.create({
      data: {
        userId: req.user!.id,
        latitude,
        longitude
      }
    });

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

    return res.status(201).json({
      message: '位置情報が更新されました',
      location
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
      where: { userId: req.user!.id },
      include: {
        friend: {
          select: {
            id: true,
            name: true,
            nowId: true,
            profileImage: true
          }
        }
      }
    });

    const friendIds = friends.map(f => f.friend.id);
    
    // 最新の位置情報を取得
    const locations = await prisma.location.findMany({
      where: {
        userId: { in: friendIds }
      },
      orderBy: { createdAt: 'desc' },
      distinct: ['userId']
    });

    // 友達情報と位置情報を結合
    const friendsWithLocations = friends.map(friend => {
      const location = locations.find(loc => loc.userId === friend.friend.id);
      return {
        ...friend.friend,
        location: location ? {
          latitude: location.latitude,
          longitude: location.longitude,
          updatedAt: location.createdAt
        } : null
      };
    });

    return res.json({ friends: friendsWithLocations });
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

export default router; 