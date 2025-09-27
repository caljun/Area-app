import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// Validation schemas
const sendFriendRequestSchema = z.object({
  toUserId: z.string().min(1, 'User ID is required'),
  message: z.string().optional()
});

const respondToFriendRequestSchema = z.object({
  action: z.string().min(1, 'Action is required') // "accept" or "reject"
});

const sendAreaRequestSchema = z.object({
  receiverId: z.string().min(1, 'Receiver ID is required'),
  areaId: z.string().min(1, 'Area ID is required')
});

// Get friends list
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    console.log(`友達一覧取得開始 - userId: ${req.user!.id}`);
    const friends = await prisma.friend.findMany({
      where: {
        OR: [
          { userId: req.user!.id },      // 現在のユーザーが起点の友達関係
          { friendId: req.user!.id }     // 現在のユーザーが対象の友達関係
        ]
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            areaId: true,
            profileImage: true,
            createdAt: true,
            updatedAt: true
          }
        },
        friend: {
          select: {
            id: true,
            name: true,
            areaId: true,
            profileImage: true,
            createdAt: true,
            updatedAt: true
          }
        }
      }
    });

    // 友達関係から現在のユーザー以外のユーザー情報を抽出
    const apiFriends = friends.map(friend => {
      // 現在のユーザーID
      const currentUserId = req.user!.id;
      
      // 友達関係の両方のユーザーをチェックして、現在のユーザー以外を友達として返す
      const friendUser = friend.userId === currentUserId ? friend.friend : friend.user;
      
      return {
        id: friend.id,
        userId: friend.userId,
        friendId: friend.friendId,
        status: 'accepted',
        createdAt: friend.createdAt,
        // iOS側デコードで必須フィールド欠落とならないよう常に含める
        updatedAt: friend.createdAt,
        friend: friendUser
      };
    });

    // 重複を除去（双方向の友達関係がある場合）
    const uniqueFriends = new Map();
    apiFriends.forEach(friend => {
      if (friend.friend && !uniqueFriends.has(friend.friend.id)) {
        uniqueFriends.set(friend.friend.id, friend);
      }
    });

    const finalFriends = Array.from(uniqueFriends.values());

    console.log(`友達取得完了: ${finalFriends.length}人 (元々: ${apiFriends.length}件)`);

    // クライアント互換: ?wrap=true で { friends: [...] } を返す
    const shouldWrap = String(req.query.wrap).toLowerCase() === 'true';
    if (shouldWrap) {
      return res.json({ friends: finalFriends });
    }
    return res.json(finalFriends);
  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get friend profile by ID
router.get('/:friendId', async (req: AuthRequest, res: Response) => {
  try {
    const { friendId } = req.params;

    // MongoDB ObjectIDの形式チェック
    if (!friendId || friendId === 'requests' || !/^[0-9a-fA-F]{24}$/.test(friendId)) {
      console.log(`無効な友達ID: ${friendId}`);
      return res.status(400).json({ error: 'Invalid friend ID' });
    }

    // 友達関係をチェック
    const friendship = await prisma.friend.findFirst({
      where: {
        OR: [
          { userId: req.user!.id, friendId: friendId },
          { userId: friendId, friendId: req.user!.id }
        ]
      } as any,
      include: {
        friend: {
          select: {
            id: true,
            name: true,
            areaId: true,
            profileImage: true,
            createdAt: true,
            updatedAt: true
          }
        }
      }
    });

    if (!friendship) {
      return res.status(404).json({ error: 'Friend not found or not friends' });
    }

    // 友達のプロフィール情報を返す
    const friendProfile = {
      id: friendship.friend.id,
      name: friendship.friend.name,
      areaId: friendship.friend.areaId,
      profileImage: friendship.friend.profileImage,
      createdAt: friendship.friend.createdAt,
      updatedAt: friendship.friend.updatedAt
    };

    return res.json(friendProfile);
  } catch (error) {
    console.error('Get friend profile error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get friend requests
router.get('/requests', async (req: AuthRequest, res: Response) => {
  try {
    const requests = await prisma.friendRequest.findMany({
      where: { 
        receiverId: req.user!.id,
        status: 'PENDING'
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            areaId: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Areaフロントエンドの期待する形式でレスポンスを返す
    const apiRequests = requests.map(request => ({
      id: request.id,
      fromUserId: request.senderId,
      toUserId: request.receiverId,
      status: request.status.toLowerCase(),
      createdAt: request.createdAt,
      fromUser: request.sender ? {
        id: request.sender.id,
        name: request.sender.name,
        areaId: request.sender.areaId
      } : undefined
    }));

    res.json(apiRequests);
  } catch (error) {
    console.error('Get friend requests error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send friend request
router.post('/requests', async (req: AuthRequest, res: Response) => {
  try {
    const { toUserId, message } = sendFriendRequestSchema.parse(req.body);

    // Resolve receiver by id or areaId (handle)
    const resolveReceiver = async (identifier: string) => {
      // Check if identifier is a valid ObjectID (24 hex characters)
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(identifier);
      
      if (isObjectId) {
        // Try by exact user id first (only if it's a valid ObjectID)
        const byId = await prisma.user.findUnique({ where: { id: identifier } });
        if (byId) return byId;
      }
      
      // Fallback to areaId (unique handle)
      const byAreaId = await prisma.user.findUnique({ where: { areaId: identifier } });
      return byAreaId;
    };

    const receiver = await resolveReceiver(toUserId);
    if (!receiver) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent sending request to self
    if (receiver.id === req.user!.id) {
      return res.status(400).json({ error: 'Cannot send friend request to yourself' });
    }

    // Check if already friends
    const existingFriend = await prisma.friend.findFirst({
      where: {
        OR: [
          { userId: req.user!.id, friendId: receiver.id },
          { userId: receiver.id, friendId: req.user!.id }
        ]
      } as any
    });

    if (existingFriend) {
      return res.status(400).json({ error: 'Already friends' });
    }

    // Check if request already exists
    const existingRequest = await prisma.friendRequest.findFirst({
      where: {
        OR: [
          { senderId: req.user!.id, receiverId: receiver.id },
          { senderId: receiver.id, receiverId: req.user!.id }
        ],
        status: 'PENDING'
      } as any
    });

    if (existingRequest) {
      return res.status(400).json({ error: 'Friend request already exists' });
    }

    const request = await prisma.friendRequest.create({
      data: {
        senderId: req.user!.id,
        receiverId: receiver.id
      },
      include: {
        receiver: {
          select: {
            id: true,
            name: true,
            areaId: true
          }
        }
      }
    });

    // 通知を作成
    try {
      await prisma.notification.create({
        data: {
          type: 'FRIEND_REQUEST',
          title: '友達申請',
          message: `${req.user!.name}さんから友達申請が届いています`,
          data: {
            requestId: request.id,
            senderId: req.user!.id,
            senderName: req.user!.name,
            senderAreaId: req.user!.areaId
          },
          recipientId: receiver.id,
          senderId: req.user!.id
        }
      });
    } catch (notificationError) {
      console.error('Failed to create notification:', notificationError);
      // 通知作成に失敗しても友達申請は成功とする
    }

    // フロントのFriendRequestモデルへ整形して返却
    const apiRequest = {
      id: request.id,
      fromUserId: request.senderId,
      toUserId: request.receiverId,
      message: undefined as string | undefined,
      createdAt: request.createdAt,
      status: (request.status as string).toLowerCase(),
    };

    return res.status(201).json(apiRequest);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    }
    
    console.error('Send friend request error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Respond to friend request
router.patch('/requests/:requestId', async (req: AuthRequest, res: Response) => {
  try {
    const { requestId } = req.params;
    const { action } = respondToFriendRequestSchema.parse(req.body);

    const request = await prisma.friendRequest.findFirst({
      where: {
        id: requestId,
        receiverId: req.user!.id,
        status: 'PENDING'
      }
    });

    if (!request) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    const status = action === 'accept' ? 'ACCEPTED' : 'REJECTED';

    await prisma.friendRequest.update({
      where: { id: requestId },
      data: { status }
    });

    if (action === 'accept') {
      // 双方向の友達関係を作成（存在しない場合のみ）
      const senderId = request.senderId;
      const receiverId = request.receiverId;

      // 既存の友達関係をチェック
      const existingFriendship = await prisma.friend.findFirst({
        where: {
          OR: [
            { userId: senderId, friendId: receiverId },
            { userId: receiverId, friendId: senderId }
          ]
        } as any
      });

      if (existingFriendship) {
        return res.status(400).json({ error: 'Already friends' });
      }

      // トランザクションで双方向の友達関係を作成
      const created = await prisma.$transaction(async (tx) => {
        // 既存の友達関係をチェック（重複防止）
        const existingAtoB = await tx.friend.findFirst({
          where: { userId: senderId, friendId: receiverId }
        });
        
        const existingBtoA = await tx.friend.findFirst({
          where: { userId: receiverId, friendId: senderId }
        });

        let aToB, bToA;

        if (!existingAtoB) {
          aToB = await tx.friend.create({
            data: { userId: senderId, friendId: receiverId }
          });
        } else {
          aToB = existingAtoB;
        }

        if (!existingBtoA) {
          bToA = await tx.friend.create({
            data: { userId: receiverId, friendId: senderId }
          });
        } else {
          bToA = existingBtoA;
        }

        return { aToB, bToA };
      });

      // 通知を作成（友達申請承認）
      try {
        await prisma.notification.create({
          data: {
            type: 'FRIEND_REQUEST',
            title: '友達申請が承認されました',
            message: `${req.user!.name}さんが友達申請を承認しました`,
            data: {
              requestId: request.id,
              senderId: req.user!.id,
              senderName: req.user!.name,
              senderAreaId: req.user!.areaId
            },
            recipientId: senderId,
            senderId: req.user!.id
          }
        });
      } catch (notificationError) {
        console.error('Failed to create friend acceptance notification:', notificationError);
        // 通知作成に失敗しても友達関係は成功とする
      }

      // 返却は受信者視点の関係を優先
      return res.json(created.bToA);
    }

    return res.json({
      message: `Friend request ${status.toLowerCase()} successfully`
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    }
    
    console.error('Respond to friend request error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get area requests
router.get('/area-requests', async (req: AuthRequest, res: Response) => {
  try {
    const requests = await prisma.areaRequest.findMany({
      where: { 
        receiverId: req.user!.id,
        status: 'PENDING'
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            areaId: true
          }
        },
        area: {
          select: {
            id: true,
            name: true,
            coordinates: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json({ requests });
  } catch (error) {
    console.error('Get area requests error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Send area request
router.post('/area-request', async (req: AuthRequest, res: Response) => {
  try {
    const { receiverId, areaId } = sendAreaRequestSchema.parse(req.body);

    // Check if they are friends
    const friendship = await prisma.friend.findFirst({
      where: {
        OR: [
          { userId: req.user!.id, friendId: receiverId },
          { userId: receiverId, friendId: req.user!.id }
        ]
      } as any
    });

    if (!friendship) {
      return res.status(400).json({ error: 'Can only share areas with friends' });
    }

    // Check if area belongs to user
    const area = await prisma.area.findFirst({
      where: {
        id: areaId,
        userId: req.user!.id
      }
    });

    if (!area) {
      return res.status(404).json({ error: 'Area not found' });
    }

    // Check if request already exists
    const existingRequest = await prisma.areaRequest.findFirst({
      where: {
        senderId: req.user!.id,
        receiverId,
        areaId,
        status: 'PENDING'
      }
    });

    if (existingRequest) {
      return res.status(400).json({ error: 'Area request already exists' });
    }

    const request = await prisma.areaRequest.create({
      data: {
        senderId: req.user!.id,
        receiverId,
        areaId
      },
      include: {
        receiver: {
          select: {
            id: true,
            name: true,
            areaId: true
          }
        },
        area: {
          select: {
            id: true,
            name: true,
            coordinates: true
          }
        }
      }
    });

    // 通知を作成
    try {
      await prisma.notification.create({
        data: {
          type: 'AREA_INVITE',
          title: 'エリア招待',
          message: `${req.user!.name}さんが「${area.name}」エリアに招待しています`,
          data: {
            requestId: request.id,
            areaId: area.id,
            areaName: area.name,
            senderId: req.user!.id,
            senderName: req.user!.name,
            senderAreaId: req.user!.areaId
          },
          recipientId: receiverId,
          senderId: req.user!.id
        }
      });
    } catch (notificationError) {
      console.error('Failed to create notification:', notificationError);
      // 通知作成に失敗してもエリア招待は成功とする
    }

    return res.status(201).json({
      message: 'Area request sent successfully',
      request
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: '入力内容に問題があります',
        details: error.errors
      });
    }
    
    console.error('Send area request error:', error);
    return res.status(500).json({ error: 'エリアリクエストの送信に失敗しました' });
  }
});

// Respond to area request
router.put('/area-request/:requestId', async (req: AuthRequest, res: Response) => {
  try {
    const { requestId } = req.params;
    const { action } = respondToFriendRequestSchema.parse(req.body);

    const request = await prisma.areaRequest.findFirst({
      where: {
        id: requestId,
        receiverId: req.user!.id,
        status: 'PENDING'
      }
    });

    if (!request) {
      return res.status(404).json({ error: 'Area request not found' });
    }

    const status = action === 'accept' ? 'ACCEPTED' : 'REJECTED';

    await prisma.areaRequest.update({
      where: { id: requestId },
      data: { status }
    });

    return res.json({
      message: `Area request ${status.toLowerCase()} successfully`
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    }
    
    console.error('Respond to area request error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get online friends
router.get('/online', async (req: AuthRequest, res: Response) => {
  try {
    // 友達のオンライン状態を取得（簡易版）
    // 実際の実装では、WebSocketやRedis等を使用してリアルタイム状態を管理
    const friends = await prisma.friend.findMany({
      where: { userId: req.user!.id },
      include: {
        friend: {
          select: {
            id: true,
            name: true,
            areaId: true,
            profileImage: true,
            updatedAt: true
          }
        }
      }
    });

    // 簡易的なオンライン判定（最後の更新から5分以内をオンラインとする）
    const onlineFriends = friends.map(friend => ({
      id: friend.friend.id,
      name: friend.friend.name,
      areaId: friend.friend.areaId,
      profileImage: friend.friend.profileImage,
      isOnline: new Date().getTime() - friend.friend.updatedAt.getTime() < 5 * 60 * 1000, // 5分以内
      lastSeen: friend.friend.updatedAt
    }));

    res.json({ friends: onlineFriends });
  } catch (error) {
    console.error('Get online friends error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Cancel friend request
router.delete('/requests/:requestId', async (req: AuthRequest, res: Response) => {
  try {
    const { requestId } = req.params;

    const request = await prisma.friendRequest.findFirst({
      where: {
        id: requestId,
        senderId: req.user!.id,
        status: 'PENDING'
      }
    });

    if (!request) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    await prisma.friendRequest.delete({
      where: { id: requestId }
    });

    return res.status(204).send();
  } catch (error) {
    console.error('Cancel friend request error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove friend
router.delete('/:friendId', async (req: AuthRequest, res: Response) => {
  try {
    const { friendId } = req.params;

    const friendship = await prisma.friend.findFirst({
      where: {
        OR: [
          { userId: req.user!.id, friendId: friendId },
          { userId: friendId, friendId: req.user!.id }
        ]
      } as any
    });

    if (!friendship) {
      return res.status(404).json({ error: 'Friendship not found' });
    }

    await prisma.friend.delete({
      where: { id: friendship.id }
    });

    return res.status(204).send();
  } catch (error) {
    console.error('Remove friend error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 