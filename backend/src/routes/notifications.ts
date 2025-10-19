import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma, io } from '../index';
import { AuthRequest } from '../middleware/auth';
import { sendPushNotification } from '../services/firebaseAdmin';

const router = Router();

// Validation schemas
const createNotificationSchema = z.object({
  type: z.enum(['FRIEND_REQUEST', 'AREA_INVITE', 'LOCATION_UPDATE', 'GENERAL']),
  title: z.string().min(1, 'タイトルは必須です'),
  message: z.string().min(1, 'メッセージは必須です'),
  data: z.record(z.any()).optional(),
  recipientId: z.string().min(1, '受信者IDは必須です')
});

const updateNotificationSchema = z.object({
  isRead: z.boolean().optional(),
  isDeleted: z.boolean().optional()
});

// 通知を作成
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { type, title, message, data, recipientId } = createNotificationSchema.parse(req.body);

    // 受信者が存在するかチェック
    const recipient = await prisma.user.findUnique({
      where: { id: recipientId }
    });

    if (!recipient) {
      return res.status(404).json({ error: '受信者が見つかりません' });
    }

    const notification = await prisma.notification.create({
      data: {
        type,
        title,
        message,
        data: data || {},
        recipientId,
        senderId: req.user!.id
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            profileImage: true
          }
        }
      }
    });

    return res.status(201).json({
      message: '通知が作成されました',
      notification
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: '入力内容に問題があります',
        details: error.errors
      });
    }
    
    console.error('Create notification error:', error);
    return res.status(500).json({ error: '通知の作成に失敗しました' });
  }
});

// ユーザーの通知一覧を取得
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { page = '1', limit = '20', unreadOnly = 'false' } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const unreadOnlyBool = unreadOnly === 'true';

    const whereClause: any = {
      recipientId: req.user!.id,
      isDeleted: false
    };

    if (unreadOnlyBool) {
      whereClause.isRead = false;
    }

    const notifications = await prisma.notification.findMany({
      where: whereClause,
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            profileImage: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum
    });

    const total = await prisma.notification.count({
      where: whereClause
    });

    const unreadCount = await prisma.notification.count({
      where: {
        recipientId: req.user!.id,
        isRead: false,
        isDeleted: false
      }
    });

    return res.json({
      notifications,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      },
      unreadCount
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    return res.status(500).json({ error: '通知の取得に失敗しました' });
  }
});

// 特定の通知を取得
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const notification = await prisma.notification.findFirst({
      where: {
        id,
        recipientId: req.user!.id,
        isDeleted: false
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            profileImage: true
          }
        }
      }
    });

    if (!notification) {
      return res.status(404).json({ error: '通知が見つかりません' });
    }

    return res.json({ notification });
  } catch (error) {
    console.error('Get notification error:', error);
    return res.status(500).json({ error: '通知の取得に失敗しました' });
  }
});

// 通知を既読にする
router.put('/:id/read', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const notification = await prisma.notification.findFirst({
      where: {
        id,
        recipientId: req.user!.id,
        isDeleted: false
      }
    });

    if (!notification) {
      return res.status(404).json({ error: '通知が見つかりません' });
    }

    const updatedNotification = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            profileImage: true
          }
        }
      }
    });

    return res.json({
      message: '通知を既読にしました',
      notification: updatedNotification
    });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    return res.status(500).json({ error: '通知の更新に失敗しました' });
  }
});

// 通知を更新
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = updateNotificationSchema.parse(req.body);

    const notification = await prisma.notification.findFirst({
      where: {
        id,
        recipientId: req.user!.id,
        isDeleted: false
      }
    });

    if (!notification) {
      return res.status(404).json({ error: '通知が見つかりません' });
    }

    const updatedNotification = await prisma.notification.update({
      where: { id },
      data: updateData,
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            profileImage: true
          }
        }
      }
    });

    return res.json({
      message: '通知が更新されました',
      notification: updatedNotification
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: '入力内容に問題があります',
        details: error.errors
      });
    }
    
    console.error('Update notification error:', error);
    return res.status(500).json({ error: '通知の更新に失敗しました' });
  }
});

// 通知を削除
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const notification = await prisma.notification.findFirst({
      where: {
        id,
        recipientId: req.user!.id,
        isDeleted: false
      }
    });

    if (!notification) {
      return res.status(404).json({ error: '通知が見つかりません' });
    }

    await prisma.notification.update({
      where: { id },
      data: { isDeleted: true }
    });

    return res.json({ message: '通知が削除されました' });
  } catch (error) {
    console.error('Delete notification error:', error);
    return res.status(500).json({ error: '通知の削除に失敗しました' });
  }
});

// 全通知を既読にする
router.put('/read-all', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.notification.updateMany({
      where: {
        recipientId: req.user!.id,
        isRead: false,
        isDeleted: false
      },
      data: { isRead: true }
    });

    return res.json({ message: '全通知を既読にしました' });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    return res.status(500).json({ error: '通知の更新に失敗しました' });
  }
});

// 通知設定を取得
router.get('/settings', async (req: AuthRequest, res: Response) => {
  try {
    let settings = await prisma.notificationSettings.findUnique({
      where: { userId: req.user!.id }
    });

    if (!settings) {
      // デフォルト設定を作成
      settings = await prisma.notificationSettings.create({
        data: {
          userId: req.user!.id,
          friendRequests: true,
          areaInvites: true,
          locationUpdates: true,
          generalNotifications: true,
          pushEnabled: true,
          emailEnabled: false
        }
      });
    }

    return res.json({ settings });
  } catch (error) {
    console.error('Get notification settings error:', error);
    return res.status(500).json({ error: '通知設定の取得に失敗しました' });
  }
});

// 通知設定を更新
router.put('/settings', async (req: AuthRequest, res: Response) => {
  try {
    const updateData = z.object({
      friendRequests: z.boolean().optional(),
      areaInvites: z.boolean().optional(),
      locationUpdates: z.boolean().optional(),
      generalNotifications: z.boolean().optional(),
      pushEnabled: z.boolean().optional(),
      emailEnabled: z.boolean().optional()
    }).parse(req.body);

    const settings = await prisma.notificationSettings.upsert({
      where: { userId: req.user!.id },
      update: updateData,
      create: {
        userId: req.user!.id,
        ...updateData
      }
    });

    return res.json({
      message: '通知設定が更新されました',
      settings
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: '入力内容に問題があります',
        details: error.errors
      });
    }
    
    console.error('Update notification settings error:', error);
    return res.status(500).json({ error: '通知設定の更新に失敗しました' });
  }
});

// デバイストークンを登録
router.post('/device-token', async (req: AuthRequest, res: Response) => {
  try {
    const { deviceToken } = z.object({
      deviceToken: z.string().min(1, 'デバイストークンは必須です')
    }).parse(req.body);

    console.log(`📱 デバイストークン登録開始 - userId: ${req.user!.id}, token: ${deviceToken.substring(0, 20)}...`);

    // デバイストークンを更新または作成
    const updatedUser = await prisma.user.update({
      where: { id: req.user!.id },
      data: { deviceToken }
    });

    console.log(`✅ デバイストークン登録完了 - userId: ${req.user!.id}, name: ${updatedUser.name}`);

    return res.json({
      message: 'デバイストークンが登録されました',
      deviceToken: deviceToken.substring(0, 20) + '...' // セキュリティのため一部のみ返す
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ デバイストークン登録 - バリデーションエラー:', error.errors);
      return res.status(400).json({
        error: '入力内容に問題があります',
        details: error.errors
      });
    }
    
    console.error('❌ デバイストークン登録エラー:', error);
    return res.status(500).json({ error: 'デバイストークンの登録に失敗しました' });
  }
});

// Firebase Push通知とWebSocket通知を送信
router.post('/send-push', async (req: AuthRequest, res: Response) => {
  try {
    const { recipientId, title, body, data } = z.object({
      recipientId: z.string().min(1, '受信者IDは必須です'),
      title: z.string().min(1, 'タイトルは必須です'),
      body: z.string().min(1, 'メッセージは必須です'),
      data: z.record(z.any()).optional()
    }).parse(req.body);

    // 受信者のデバイストークンを取得
    const recipient = await prisma.user.findUnique({
      where: { id: recipientId },
      select: { deviceToken: true, name: true }
    });

    let pushNotificationSent = false;
    let websocketSent = false;

    // Firebase Push通知を送信
    if (recipient && recipient.deviceToken) {
      try {
        const success = await sendPushNotification(
          recipient.deviceToken,
          title,
          body,
          data || {}
        );
        
        if (success) {
          console.log(`プッシュ通知送信成功 - recipientId: ${recipientId}, title: ${title}`);
          pushNotificationSent = true;
        } else {
          console.log(`プッシュ通知送信失敗 - recipientId: ${recipientId}`);
        }
      } catch (pushError) {
        console.error('プッシュ通知送信エラー:', pushError);
      }
    } else {
      console.log(`受信者のデバイストークンが設定されていません - recipientId: ${recipientId}`);
    }

    // WebSocket通知を送信
    try {
      const recipientSocket = Array.from(io.sockets.sockets.values())
        .find(socket => socket.data.userId === recipientId);
      
      if (recipientSocket) {
        recipientSocket.emit('general_notification', {
          type: 'general_notification',
          title,
          body,
          data: data || {},
          senderId: req.user!.id,
          message: body
        });
        
        console.log(`WebSocket通知送信成功 - recipientId: ${recipientId}, title: ${title}`);
        websocketSent = true;
      } else {
        console.log(`受信者のWebSocket接続が見つかりません - recipientId: ${recipientId}`);
      }
    } catch (websocketError) {
      console.error('WebSocket通知送信エラー:', websocketError);
    }

    // 通知をデータベースに保存
    await prisma.notification.create({
      data: {
        type: 'GENERAL',
        title,
        message: body,
        data: data || {},
        recipientId,
        senderId: req.user!.id
      }
    });

    return res.json({
      message: '通知が送信されました',
      pushNotificationSent,
      websocketSent
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: '入力内容に問題があります',
        details: error.errors
      });
    }
    
    console.error('Send notification error:', error);
    return res.status(500).json({ error: '通知の送信に失敗しました' });
  }
});

export default router;
