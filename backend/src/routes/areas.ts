import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// Validation schemas
const createAreaSchema = z.object({
  name: z.string().min(1, 'Area name is required'),
  coordinates: z.array(z.object({
    latitude: z.number(),
    longitude: z.number()
  })).min(3, 'At least 3 coordinates are required'),
  isPublic: z.boolean().optional()
});

const updateAreaSchema = z.object({
  name: z.string().min(1, 'Area name is required').optional(),
  coordinates: z.array(z.object({
    latitude: z.number(),
    longitude: z.number()
  })).min(3, 'At least 3 coordinates are required').optional(),
  isPublic: z.boolean().optional()
});

// Get user's areas
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const areas = await prisma.area.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' }
    });

    // SwiftUIアプリの期待する形式でレスポンスを返す
    const apiAreas = await Promise.all(areas.map(async (area) => {
      // メンバー数を取得
      const memberCount = await prisma.areaMember.count({
        where: { areaId: area.id }
      });
      
      // オンラインメンバー数を取得（簡易版）
      const onlineCount = await prisma.areaMember.count({
        where: { 
          areaId: area.id,
          user: {
            updatedAt: {
              gte: new Date(Date.now() - 5 * 60 * 1000) // 5分以内
            }
          }
        }
      });

      return {
        id: area.id,
        name: area.name,
        coordinates: area.coordinates,
        userId: area.userId,
        isPublic: area.isPublic,
        imageUrl: area.imageUrl,
        createdAt: area.createdAt,
        updatedAt: area.updatedAt,
        memberCount,
        onlineCount
      };
    }));

    res.json(apiAreas);
  } catch (error) {
    console.error('Get areas error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get public areas
router.get('/public', async (req: Request, res: Response) => {
  try {
    const areas = await prisma.area.findMany({
      where: { isPublic: true },
      orderBy: { createdAt: 'desc' }
    });

    // SwiftUIアプリの期待する形式でレスポンスを返す
    const apiAreas = await Promise.all(areas.map(async (area) => {
      // メンバー数を取得
      const memberCount = await prisma.areaMember.count({
        where: { areaId: area.id }
      });
      
      // オンラインメンバー数を取得（簡易版）
      const onlineCount = await prisma.areaMember.count({
        where: { 
          areaId: area.id,
          user: {
            updatedAt: {
              gte: new Date(Date.now() - 5 * 60 * 1000) // 5分以内
            }
          }
        }
      });

      return {
        id: area.id,
        name: area.name,
        coordinates: area.coordinates,
        userId: area.userId,
        isPublic: area.isPublic,
        imageUrl: area.imageUrl,
        createdAt: area.createdAt,
        updatedAt: area.updatedAt,
        memberCount,
        onlineCount
      };
    }));

    res.json(apiAreas);
  } catch (error) {
    console.error('Get public areas error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get area invites (for recipient) - MUST be before /:id route
router.get('/invites', async (req: AuthRequest, res: Response) => {
  try {
    // ユーザーIDの検証
    if (!req.user?.id) {
      return res.status(401).json({ error: '認証が必要です' });
    }

    const invites = await prisma.areaInvitation.findMany({
      where: { 
        invitedUserId: req.user.id,
        status: 'PENDING'
      },
      include: {
        area: {
          select: {
            id: true,
            name: true,
            coordinates: true,
            isPublic: true
          }
        },
        invitedByUser: {
          select: {
            id: true,
            name: true,
            areaId: true,
            profileImage: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // SwiftUIアプリの期待する形式でレスポンスを返す
    const apiInvites = invites.map(invite => ({
      id: invite.id,
      areaId: invite.areaId,
      areaName: invite.area.name,
      areaCoordinates: invite.area.coordinates,
      areaIsPublic: invite.area.isPublic,
      fromUserId: invite.invitedBy,
      fromUserName: invite.invitedByUser?.name || 'Unknown',
      fromUserAreaId: invite.invitedByUser?.areaId || 'Unknown',
      fromUserProfileImage: invite.invitedByUser?.profileImage || null,
      toUserId: invite.invitedUserId,
      status: invite.status.toLowerCase(),
      createdAt: invite.createdAt,
      updatedAt: invite.updatedAt
    }));

    return res.json({
      invites: apiInvites,
      count: apiInvites.length
    });
  } catch (error) {
    console.error('Get area invites error:', error);
    
    // より詳細なエラーハンドリング
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack trace:', error.stack);
    }
    
    return res.status(500).json({ 
      error: 'エリア招待の取得に失敗しました',
      details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
    });
  }
});

// Get area by ID
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const area = await prisma.area.findFirst({
      where: {
        id,
        OR: [
          { userId: req.user!.id },
          { isPublic: true }
        ]
      } as any
    });

    if (!area) {
      return res.status(404).json({ error: 'Area not found' });
    }

    // SwiftUIアプリの期待する形式でレスポンスを返す
    const apiArea = {
      id: area.id,
      name: area.name,
      coordinates: area.coordinates,
      userId: area.userId,
      isPublic: area.isPublic,
      imageUrl: area.imageUrl,
      createdAt: area.createdAt,
      updatedAt: area.updatedAt
    };

    return res.json(apiArea);
  } catch (error) {
    console.error('Get area error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});



// Create area
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, coordinates, isPublic = false } = createAreaSchema.parse(req.body);

    const area = await prisma.area.create({
      data: {
        name,
        coordinates,
        isPublic,
        userId: req.user!.id
      }
    });

    // SwiftUIアプリの期待する形式でレスポンスを返す
    const apiArea = {
      id: area.id,
      name: area.name,
      coordinates: area.coordinates,
      userId: area.userId,
      isPublic: area.isPublic,
      imageUrl: area.imageUrl,
      createdAt: area.createdAt,
      updatedAt: area.updatedAt
    };

    return res.status(201).json(apiArea);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: '入力内容に問題があります',
        details: error.errors
      });
    }
    
    console.error('Create area error:', error);
    return res.status(500).json({ error: 'エリアの作成に失敗しました' });
  }
});

// Update area (PATCH method for partial updates)
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = updateAreaSchema.parse(req.body);

    // Check if area exists and belongs to user
    const existingArea = await prisma.area.findFirst({
      where: {
        id,
        userId: req.user!.id
      }
    });

    if (!existingArea) {
      return res.status(404).json({ error: 'エリアが見つかりません' });
    }

    const area = await prisma.area.update({
      where: { id },
      data: updateData
    });

    return res.json({
      message: 'エリアの更新が完了しました',
      area
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: '入力内容に問題があります',
        details: error.errors
      });
    }
    
    console.error('Update area error:', error);
    return res.status(500).json({ error: 'エリアの更新に失敗しました' });
  }
});

// Delete area
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if area exists and belongs to user
    const existingArea = await prisma.area.findFirst({
      where: {
        id,
        userId: req.user!.id
      }
    });

    if (!existingArea) {
      return res.status(404).json({ error: 'Area not found' });
    }

    await prisma.area.delete({
      where: { id }
    });

    return res.status(204).send();
  } catch (error) {
    console.error('Delete area error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get area members
router.get('/:id/members', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if user has access to this area
    const area = await prisma.area.findFirst({
      where: {
        id,
        OR: [
          { userId: req.user!.id },
          { isPublic: true }
        ]
      } as any
    });

    if (!area) {
      return res.status(404).json({ error: 'Area not found' });
    }

    const members = await prisma.areaMember.findMany({
      where: { areaId: id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            areaId: true,
            profileImage: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    // SwiftUIアプリの期待する形式でレスポンスを返す（Userオブジェクトの配列）
    const memberUsers = members.map(member => ({
      id: member.user.id,
      name: member.user.name,
      areaId: member.user.areaId,
      profileImage: member.user.profileImage
    }));
    return res.json(memberUsers);
  } catch (error) {
    console.error('Get area members error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Add member to area
router.post('/:id/members', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Check if area belongs to user
    const area = await prisma.area.findFirst({
      where: {
        id,
        userId: req.user!.id
      }
    });

    if (!area) {
      return res.status(404).json({ error: 'Area not found or access denied' });
    }

    // Check if they are friends
    const friendship = await prisma.friend.findFirst({
      where: {
        OR: [
          { userId: req.user!.id, friendId: userId },
          { userId: userId, friendId: req.user!.id }
        ]
      } as any
    });

    if (!friendship) {
      return res.status(400).json({ error: 'Can only add friends to areas' });
    }

    // Check if already a member
    const existingMember = await prisma.areaMember.findFirst({
      where: {
        areaId: id,
        userId: userId
      }
    });

    if (existingMember) {
      return res.status(400).json({ error: 'User is already a member of this area' });
    }

    const member = await prisma.areaMember.create({
      data: {
        areaId: id,
        userId: userId,
        addedBy: req.user!.id
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            areaId: true,
            profileImage: true
          }
        }
      }
    });

    return res.status(201).json({
      message: 'Member added successfully',
      member
    });
  } catch (error) {
    console.error('Add area member error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove member from area
router.delete('/:id/members/:userId', async (req: AuthRequest, res: Response) => {
  try {
    const { id, userId } = req.params;

    // Check if area belongs to user
    const area = await prisma.area.findFirst({
      where: {
        id,
        userId: req.user!.id
      }
    });

    if (!area) {
      return res.status(404).json({ error: 'Area not found or access denied' });
    }

    // Check if member exists
    const member = await prisma.areaMember.findFirst({
      where: {
        areaId: id,
        userId: userId
      }
    });

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    await prisma.areaMember.delete({
      where: { id: member.id }
    });

    return res.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Remove area member error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get areas where user is a member
router.get('/memberships', async (req: AuthRequest, res: Response) => {
  try {
    const memberships = await prisma.areaMember.findMany({
      where: { userId: req.user!.id },
      include: {
        area: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                areaId: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json({ memberships });
  } catch (error) {
    console.error('Get area memberships error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Invite friend to area
router.post('/:id/invite', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = req.body; // フロントエンドのAreaAPI.swiftに合わせてuserIdに変更

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Check if area belongs to user
    const area = await prisma.area.findFirst({
      where: {
        id,
        userId: req.user!.id
      }
    });

    if (!area) {
      return res.status(404).json({ error: 'Area not found or access denied' });
    }

    // Check if they are friends
    const friendship = await prisma.friend.findFirst({
      where: {
        OR: [
          { userId: req.user!.id, friendId: userId },
          { userId: userId, friendId: req.user!.id }
        ]
      } as any
    });

    if (!friendship) {
      return res.status(400).json({ error: 'Can only invite friends to areas' });
    }

    // Check if already a member
    const existingMember = await prisma.areaMember.findFirst({
      where: {
        areaId: id,
        userId: userId
      }
    });

    if (existingMember) {
      return res.status(400).json({ error: 'User is already a member of this area' });
    }

    // Check if invitation already exists
    const existingInvite = await prisma.areaInvitation.findFirst({
      where: {
        areaId: id,
        invitedUserId: userId,
        status: 'PENDING'
      }
    });

    if (existingInvite) {
      return res.status(400).json({ error: 'Invitation already sent' });
    }

    // Create invitation
    const invitation = await prisma.areaInvitation.create({
      data: {
        areaId: id,
        invitedUserId: userId,
        invitedBy: req.user!.id
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
            invitationId: invitation.id,
            areaId: area.id,
            areaName: area.name,
            senderId: req.user!.id,
            senderName: req.user!.name
          },
          recipientId: userId,
          senderId: req.user!.id
        }
      });
    } catch (notificationError) {
      console.error('Failed to create area invite notification:', notificationError);
      // 通知作成に失敗しても招待は成功とする
    }

    return res.status(201).json({
      message: 'Invitation sent successfully',
      invitation
    });
  } catch (error) {
    console.error('Invite to area error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Join area
router.post('/:id/join', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if area exists and is public
    const area = await prisma.area.findFirst({
      where: {
        id,
        isPublic: true
      }
    });

    if (!area) {
      return res.status(404).json({ error: 'Area not found or not public' });
    }

    // Check if already a member
    const existingMember = await prisma.areaMember.findFirst({
      where: {
        areaId: id,
        userId: req.user!.id
      }
    });

    if (existingMember) {
      return res.status(400).json({ error: 'Already a member of this area' });
    }

    const member = await prisma.areaMember.create({
      data: {
        areaId: id,
        userId: req.user!.id,
        addedBy: req.user!.id
      }
    });

    return res.status(201).json({
      message: 'Joined area successfully',
      member
    });
  } catch (error) {
    console.error('Join area error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Leave area
router.delete('/:id/leave', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if member exists
    const member = await prisma.areaMember.findFirst({
      where: {
        areaId: id,
        userId: req.user!.id
      }
    });

    if (!member) {
      return res.status(404).json({ error: 'Not a member of this area' });
    }

    // Cannot leave if you own the area
    const area = await prisma.area.findFirst({
      where: { id }
    });

    if (area?.userId === req.user!.id) {
      return res.status(400).json({ error: 'Cannot leave area you own' });
    }

    await prisma.areaMember.delete({
      where: { id: member.id }
    });

    return res.json({ message: 'Left area successfully' });
  } catch (error) {
    console.error('Leave area error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Search areas
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { q, lat, lng, radius = 10 } = req.query;

    let whereClause: any = {};

    if (q) {
      whereClause.name = {
        contains: q as string,
        mode: 'insensitive'
      };
    }

    if (lat && lng) {
      // Simple distance calculation (can be improved with proper geospatial queries)
      whereClause.isPublic = true;
    }

    const areas = await prisma.area.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            areaId: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    res.json(areas);
  } catch (error) {
    console.error('Search areas error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get nearby areas
router.get('/nearby', async (req: Request, res: Response) => {
  try {
    const { lat, lng, radius = 10 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const areas = await prisma.area.findMany({
      where: { isPublic: true },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            areaId: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    // Simple distance filtering (can be improved with proper geospatial queries)
    const nearbyAreas = areas.filter(area => {
      const coords = area.coordinates as any;
      if (!coords || !Array.isArray(coords) || coords.length === 0) return false;
      
      // Calculate distance from center point
      const centerLat = coords.reduce((sum: number, coord: any) => sum + coord.latitude, 0) / coords.length;
      const centerLng = coords.reduce((sum: number, coord: any) => sum + coord.longitude, 0) / coords.length;
      
      const distance = Math.sqrt(
        Math.pow(parseFloat(lat as string) - centerLat, 2) + 
        Math.pow(parseFloat(lng as string) - centerLng, 2)
      ) * 111; // Rough conversion to km
      
      return distance <= parseFloat(radius as string);
    });

    res.json(nearbyAreas);
  } catch (error) {
    console.error('Get nearby areas error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// Respond to area invite
router.patch('/invites/:inviteId', async (req: AuthRequest, res: Response) => {
  try {
    const { inviteId } = req.params;
    const { action } = req.body; // "accept" or "reject"

    if (!action || !['accept', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'アクションは "accept" または "reject" である必要があります' });
    }

    const invite = await prisma.areaInvitation.findFirst({
      where: {
        id: inviteId,
        invitedUserId: req.user!.id,
        status: 'PENDING'
      }
    });

    if (!invite) {
      return res.status(404).json({ error: 'エリア招待が見つかりません' });
    }

    const status = action === 'accept' ? 'ACCEPTED' : 'REJECTED';

    await prisma.areaInvitation.update({
      where: { id: inviteId },
      data: { 
        status,
        updatedAt: new Date()
      }
    });

    if (action === 'accept') {
      // エリアメンバーとして追加
      await prisma.areaMember.create({
        data: {
          areaId: invite.areaId,
          userId: req.user!.id,
          addedBy: invite.invitedBy
        }
      });
    }

    return res.json({
      message: `エリア招待を${action === 'accept' ? '承認' : '拒否'}しました`
    });
  } catch (error) {
    console.error('Respond to area invite error:', error);
    return res.status(500).json({ error: 'エリア招待への応答に失敗しました' });
  }
});

export default router; 