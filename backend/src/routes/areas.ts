import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma, io } from '../index';
import { AuthRequest } from '../middleware/auth';
import { sendPushNotificationToMultiple } from '../services/firebaseAdmin';

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

// Get user's areas (owned + member areas)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    // 1. 自分が作成したエリアを取得
    const ownedAreas = await prisma.area.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' }
    });

    // 2. 自分がメンバーとして参加しているエリアを取得
    const memberAreas = await prisma.areaMember.findMany({
      where: { userId: req.user!.id },
      include: {
        area: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // 3. 重複を避けるために、所有エリアのIDセットを作成
    const ownedAreaIds = new Set(ownedAreas.map(area => area.id));

    // 4. メンバーエリアから所有エリアを除外
    const uniqueMemberAreas = memberAreas
      .filter(member => !ownedAreaIds.has(member.area.id))
      .map(member => member.area);

    // 5. すべてのエリアを結合
    const allAreas = [...ownedAreas, ...uniqueMemberAreas];

    // SwiftUIアプリの期待する形式でレスポンスを返す
    const apiAreas = await Promise.all(allAreas.map(async (area) => {
      // メンバー数を取得（所有者も含む）
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
        onlineCount,
        isOwner: area.userId === req.user!.id  // 所有者かどうかのフラグを追加
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
      // メンバー数を取得（所有者も含む）
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

// Get areas created by the authenticated user (owned only)
router.get('/created', async (req: AuthRequest, res: Response) => {
  try {
    const areas = await prisma.area.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' }
    });

    const apiAreas = await Promise.all(areas.map(async (area) => {
      // メンバー数を取得（所有者も含む）
      const memberCount = await prisma.areaMember.count({
        where: { areaId: area.id }
      });

      // オンラインメンバー数を取得（簡易版）
      const onlineCount = await prisma.areaMember.count({
        where: {
          areaId: area.id,
          user: {
            updatedAt: {
              gte: new Date(Date.now() - 5 * 60 * 1000)
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
        onlineCount,
        isOwner: true
      };
    }));

    return res.json(apiAreas);
  } catch (error) {
    console.error('Get created areas error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get areas the authenticated user has joined (member but not owner)
router.get('/joined', async (req: AuthRequest, res: Response) => {
  try {
    console.log(`参加エリア一覧取得開始 - userId: ${req.user!.id}`);

    const memberships = await prisma.areaMember.findMany({
      where: { userId: req.user!.id },
      include: { 
        area: {
          select: {
            id: true,
            name: true,
            coordinates: true,
            userId: true,
            isPublic: true,
            imageUrl: true,
            createdAt: true,
            updatedAt: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`参加エリアメンバーシップ取得完了 - 件数: ${memberships.length}`);

    // 各メンバーシップの詳細をログ出力
    for (const membership of memberships) {
      if (membership.area) {
        console.log(`メンバーシップ詳細 - areaId: ${membership.area.id}, areaName: ${membership.area.name}, areaOwner: ${membership.area.userId}, currentUser: ${req.user!.id}, isOwner: ${membership.area.userId === req.user!.id}, addedBy: ${membership.addedBy}`);
      } else {
        console.log(`メンバーシップ詳細 - areaId: ${membership.areaId}, area: null`);
      }
    }

    // Exclude areas owned by the user to ensure "joined" means non-owned memberships
    // プロフィール表示用：作成したエリアは除外する
    const joinedAreas = memberships
      .filter(m => m.area && m.area.userId !== req.user!.id) // 作成者は除外
      .map(m => m.area!);

    console.log(`参加エリアフィルタリング完了 - 参加エリア数: ${joinedAreas.length} (作成エリア除外後)`);
    
    // フィルタリング後の詳細ログ
    for (const area of joinedAreas) {
      console.log(`参加エリア詳細 - areaId: ${area.id}, areaName: ${area.name}, areaOwner: ${area.userId} (作成者: ${req.user!.id})`);
    }

    const apiAreas = await Promise.all(joinedAreas.map(async (area) => {
      // メンバー数を取得（所有者も含む）
      const memberCount = await prisma.areaMember.count({
        where: { areaId: area.id }
      });

      // オンラインメンバー数を取得（簡易版）
      const onlineCount = await prisma.areaMember.count({
        where: {
          areaId: area.id,
          user: {
            updatedAt: {
              gte: new Date(Date.now() - 5 * 60 * 1000)
            }
          }
        }
      });

      console.log(`参加エリア詳細 - 名前: ${area.name}, ID: ${area.id}, メンバー数: ${memberCount}`);

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
        onlineCount,
        isOwner: area.userId === req.user!.id // 正しいisOwner判定
      };
    }));

    console.log(`参加エリア一覧取得完了 - エリア数: ${apiAreas.length}`);
    return res.json(apiAreas);
  } catch (error) {
    console.error('Get joined areas error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get areas for location sharing (including owned areas)
// 位置情報共有用：作成したエリアも含める
router.get('/for-location-sharing', async (req: AuthRequest, res: Response) => {
  try {
    console.log(`位置情報共有用エリア一覧取得開始 - userId: ${req.user!.id}`);

    const memberships = await prisma.areaMember.findMany({
      where: { userId: req.user!.id },
      include: { 
        area: {
          select: {
            id: true,
            name: true,
            coordinates: true,
            userId: true,
            isPublic: true,
            imageUrl: true,
            createdAt: true,
            updatedAt: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`位置情報共有用メンバーシップ取得完了 - 件数: ${memberships.length}`);

    // 位置情報共有用：作成したエリアも含める
    const areasForLocationSharing = memberships
      .filter(m => m.area) // エリアが存在するもののみ
      .map(m => m.area!);

    console.log(`位置情報共有用エリアフィルタリング完了 - エリア数: ${areasForLocationSharing.length} (作成エリア含む)`);

    const apiAreas = await Promise.all(areasForLocationSharing.map(async (area) => {
      // メンバー数を取得（所有者も含む）
      const memberCount = await prisma.areaMember.count({
        where: { areaId: area.id }
      });

      // オンラインメンバー数を取得（簡易版）
      const onlineCount = await prisma.areaMember.count({
        where: {
          areaId: area.id,
          user: {
            updatedAt: {
              gte: new Date(Date.now() - 5 * 60 * 1000)
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
        onlineCount,
        isOwner: area.userId === req.user!.id
      };
    }));

    console.log(`位置情報共有用エリア一覧取得完了 - エリア数: ${apiAreas.length}`);
    return res.json(apiAreas);
  } catch (error) {
    console.error('Get areas for location sharing error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get area invites (for recipient) - MUST be before /:id route
router.get('/invites', async (req: AuthRequest, res: Response) => {
  try {
    // ユーザーIDの検証
    if (!req.user?.id) {
      return res.status(401).json({ error: '認証が必要です' });
    }

    console.log(`エリア招待一覧取得開始 - userId: ${req.user.id}`);

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

    console.log(`エリア招待一覧取得完了 - 招待数: ${invites.length}`);

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

    console.log(`エリア招待API形式変換完了 - 招待数: ${apiInvites.length}`);

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

    // Server-side validations aligned with iOS spec
    // 1) Enforce max 5 areas per user
    const existingCount = await prisma.area.count({ where: { userId: req.user!.id } });
    if (existingCount >= 5) {
      return res.status(400).json({ error: '作成できるエリアは最大5件までです' });
    }

    // 2) Enforce geofence radius within 100–800 meters using polygon's minimum enclosing circle (approx)
    // Compute centroid and max distance to vertices as an approximation of circumradius
    const latitudes = coordinates.map(c => c.latitude);
    const longitudes = coordinates.map(c => c.longitude);
    const centroidLat = latitudes.reduce((a, b) => a + b, 0) / latitudes.length;
    const centroidLng = longitudes.reduce((a, b) => a + b, 0) / longitudes.length;

    // Haversine distance in meters
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const earthRadiusM = 6371000;
    const maxRadiusM = coordinates.reduce((max, c) => {
      const dLat = toRad(c.latitude - centroidLat);
      const dLng = toRad(c.longitude - centroidLng);
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(toRad(centroidLat)) * Math.cos(toRad(c.latitude)) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const distance = 2 * earthRadiusM * Math.asin(Math.min(1, Math.sqrt(a)));
      return Math.max(max, distance);
    }, 0);

    if (maxRadiusM < 100 || maxRadiusM > 800) {
      return res.status(400).json({ error: 'エリアの半径は100m以上800m以下である必要があります' });
    }

    // トランザクションでエリア作成と所有者のメンバー登録を同時に実行
    const result = await prisma.$transaction(async (tx) => {
      // エリアを作成
      const area = await tx.area.create({
        data: {
          name,
          coordinates,
          isPublic,
          userId: req.user!.id
        }
      });

      // エリア所有者をAreaMemberに自動登録
      await tx.areaMember.create({
        data: {
          areaId: area.id,
          userId: req.user!.id,
          addedBy: req.user!.id // 自分自身が追加者
        }
      });

      return area;
    });

    // SwiftUIアプリの期待する形式でレスポンスを返す
    const apiArea = {
      id: result.id,
      name: result.name,
      coordinates: result.coordinates,
      userId: result.userId,
      isPublic: result.isPublic,
      imageUrl: result.imageUrl,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt
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

    console.log(`エリアメンバー取得リクエスト - areaId: ${id}, userId: ${req.user!.id}`);

    // Check if user has access to this area (owner, public, or member)
    const area = await prisma.area.findFirst({
      where: {
        id,
        OR: [
          { userId: req.user!.id }, // エリアの所有者
          { isPublic: true }, // 公開エリア
          { 
            // エリアのメンバーとして参加している
            areaMembers: {
              some: {
                userId: req.user!.id
              }
            }
          }
        ]
      } as any
    });

    if (!area) {
      console.log(`エリアアクセス拒否 - areaId: ${id}, userId: ${req.user!.id}`);
      return res.status(404).json({ error: 'Area not found' });
    }

    console.log(`エリアアクセス許可 - areaId: ${id}, areaName: ${area.name}, isOwner: ${area.userId === req.user!.id}`);

    // AreaMemberテーブルからメンバーを取得（所有者も含む）
    const members = await prisma.areaMember.findMany({
      where: { areaId: id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            displayId: true,
            profileImage: true,
            createdAt: true,
            updatedAt: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    // 友達関係を確認（フロント側で友達申請ボタンの表示判定に使用）
    const memberIds = members.map(m => m.user.id);
    
    const friendships = await prisma.friend.findMany({
      where: {
        OR: [
          { userId: req.user!.id, friendId: { in: memberIds } },
          { friendId: req.user!.id, userId: { in: memberIds } }
        ]
      } as any
    });

    const friendIds = new Set();
    friendships.forEach(friendship => {
      if (friendship.userId === req.user!.id) {
        friendIds.add(friendship.friendId);
      } else {
        friendIds.add(friendship.userId);
      }
    });

    // 全メンバーを返す（フロント側で友達申請ボタンの表示判定を行う）
    const filteredMembers = members;
    
    console.log(`エリアメンバー取得: 全${members.length}人（友達: ${friendIds.size}人）`);

    // SwiftUIアプリの期待する形式でレスポンスを返す（Userオブジェクトの配列）
    const memberUsers = filteredMembers.map(member => ({
      id: member.user.id,
      name: member.user.name,
      displayId: member.user.displayId,
      profileImage: member.user.profileImage,
      createdAt: member.user.createdAt || new Date(),
      updatedAt: member.user.updatedAt || new Date(),
      isFriend: friendIds.has(member.user.id), // 友達関係の情報を追加
      isCurrentUser: member.user.id === req.user!.id // 自分自身かどうかの情報を追加
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
    const { invitedUserId } = req.body; // invitedUserIdで友達を検索

    console.log(`エリア招待リクエスト - areaId: ${id}, invitedUserId: ${invitedUserId}, invitedBy: ${req.user!.id}`);

    if (!invitedUserId) {
      return res.status(400).json({ error: 'Invited User ID is required' });
    }

    // invitedUserIdからユーザー情報を取得
    const targetUser = await prisma.user.findUnique({
      where: { id: invitedUserId },
      select: { id: true, name: true }
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userId = targetUser.id;

    // Check if area belongs to user
    const area = await prisma.area.findFirst({
      where: {
        id,
        userId: req.user!.id
      }
    });

    if (!area) {
      console.log(`エリアが見つからないかアクセス拒否 - areaId: ${id}, userId: ${req.user!.id}`);
      return res.status(404).json({ error: 'Area not found or access denied' });
    }

    console.log(`エリア確認完了 - areaName: ${area.name}`);

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
      console.log(`友達関係がありません - userId: ${req.user!.id}, friendId: ${userId}`);
      return res.status(400).json({ error: 'Can only invite friends to areas' });
    }

    console.log(`友達関係確認完了`);

    // Check if already a member
    const existingMember = await prisma.areaMember.findFirst({
      where: {
        areaId: id,
        userId: userId
      }
    });

    if (existingMember) {
      console.log(`既にエリアメンバーです - areaId: ${id}, userId: ${userId}`);
      return res.status(400).json({ error: 'User is already a member of this area' });
    }

    // Check if invitation already exists (PENDING or REJECTED)
    const existingInvite = await prisma.areaInvitation.findFirst({
      where: {
        areaId: id,
        invitedUserId: userId,
        status: {
          in: ['PENDING', 'REJECTED']
        }
      }
    });

    if (existingInvite) {
      if (existingInvite.status === 'PENDING') {
        console.log(`既に招待済みです - areaId: ${id}, userId: ${userId}, status: PENDING`);
        return res.status(400).json({ error: 'Invitation already sent' });
      } else if (existingInvite.status === 'REJECTED') {
        console.log(`以前に拒否された招待があります - areaId: ${id}, userId: ${userId}, status: REJECTED`);
        // 拒否された招待がある場合は、新しい招待を作成する前に古い招待を削除
        await prisma.areaInvitation.delete({
          where: { id: existingInvite.id }
        });
        console.log(`古い招待を削除しました - invitationId: ${existingInvite.id}`);
      }
    }

    // Create invitation
    const invitation = await prisma.areaInvitation.create({
      data: {
        areaId: id,
        invitedUserId: userId,
        invitedBy: req.user!.id
      }
    });

    console.log(`エリア招待作成完了 - invitationId: ${invitation.id}`);

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
      console.log(`エリア招待通知作成完了`);
    } catch (notificationError) {
      console.error('Failed to create area invite notification:', notificationError);
      // 通知作成に失敗しても招待は成功とする
    }

    // Firebase Push通知を送信
    try {
      console.log(`📱 エリア招待プッシュ通知送信開始 - invitedUserId: ${userId}, areaName: ${area.name}`);
      
      // 招待されたユーザーのデバイストークンを取得
      const invitedUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { deviceToken: true, name: true }
      });

      console.log(`📱 招待ユーザー情報取得 - name: ${invitedUser?.name}, hasDeviceToken: ${invitedUser?.deviceToken ? 'YES' : 'NO'}`);

      if (invitedUser && invitedUser.deviceToken) {
        console.log(`📱 デバイストークン確認 - token: ${invitedUser.deviceToken.substring(0, 20)}...`);
        
        const result = await sendPushNotificationToMultiple(
          [invitedUser.deviceToken],
          'エリア招待',
          `${req.user!.name}さんがあなたをエリア「${area.name}」に招待しました`,
          {
            type: 'area_invite',
            invitationId: invitation.id,
            areaId: area.id,
            areaName: area.name,
            senderId: req.user!.id,
            senderName: req.user!.name || 'Unknown'
          }
        );
        
        console.log(`✅ エリア招待プッシュ通知送信完了 - invitedUserId: ${userId}, areaName: ${area.name}, 成功: ${result.successCount}, 失敗: ${result.failureCount}`);
      } else {
        console.log(`❌ プッシュ通知送信スキップ - デバイストークンなし (userId: ${userId}, name: ${invitedUser?.name})`);
      }
    } catch (pushError) {
      console.error('❌ エリア招待プッシュ通知送信エラー:', pushError);
      // プッシュ通知送信に失敗してもエリア招待は成功とする
    }

    // WebSocket通知も送信（リアルタイム通知）
    try {
      // 招待ユーザーのWebSocket接続を確認してリアルタイム通知を送信
      const invitedUserSocket = Array.from(io.sockets.sockets.values())
        .find(socket => socket.data.userId === userId);
      
      if (invitedUserSocket) {
        invitedUserSocket.emit('area_invite', {
          type: 'area_invite',
          invitationId: invitation.id,
          areaId: area.id,
          areaName: area.name,
          senderId: req.user!.id,
          senderName: req.user!.name || 'Unknown',
          message: `${req.user!.name}さんがあなたをエリア「${area.name}」に招待しました`
        });
        
        console.log(`エリア招待WebSocket通知送信完了 - invitedUserId: ${userId}, areaName: ${area.name}`);
      } else {
        console.log(`招待ユーザーのWebSocket接続が見つかりません - invitedUserId: ${userId}`);
      }
    } catch (websocketError) {
      console.error('エリア招待WebSocket通知送信エラー:', websocketError);
      // WebSocket通知送信に失敗してもエリア招待は成功とする
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

    console.log(`エリア招待応答リクエスト - inviteId: ${inviteId}, action: ${action}, userId: ${req.user!.id}`);
    console.log(`リクエストボディ全体:`, JSON.stringify(req.body, null, 2));
    console.log(`actionの型: ${typeof action}, 値: "${action}"`);

    if (!action || !['accept', 'reject'].includes(action)) {
      console.log(`無効なアクション: ${action}`);
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
      console.log(`エリア招待が見つかりません - inviteId: ${inviteId}, userId: ${req.user!.id}`);
      return res.status(404).json({ error: 'エリア招待が見つかりません' });
    }

    console.log(`エリア招待を発見 - areaId: ${invite.areaId}, invitedBy: ${invite.invitedBy}`);

    const status = action === 'accept' ? 'ACCEPTED' : 'REJECTED';

    await prisma.areaInvitation.update({
      where: { id: inviteId },
      data: { 
        status,
        updatedAt: new Date()
      }
    });

    console.log(`エリア招待ステータス更新完了 - status: ${status}`);

    if (action === 'accept') {
      // 既にメンバーかどうかチェック
      const existingMember = await prisma.areaMember.findFirst({
        where: {
          areaId: invite.areaId,
          userId: req.user!.id
        }
      });

      if (existingMember) {
        console.log(`既にエリアメンバーです - areaId: ${invite.areaId}, userId: ${req.user!.id}, memberId: ${existingMember.id}`);
      } else {
        // エリアメンバーとして追加
        const newMember = await prisma.areaMember.create({
          data: {
            areaId: invite.areaId,
            userId: req.user!.id,
            addedBy: invite.invitedBy
          }
        });
        console.log(`エリアメンバー追加完了 - memberId: ${newMember.id}, areaId: ${invite.areaId}, userId: ${req.user!.id}, addedBy: ${invite.invitedBy}`);
        
        // 追加後に確認のため、作成されたレコードを再取得
        const verifyMember = await prisma.areaMember.findFirst({
          where: {
            areaId: invite.areaId,
            userId: req.user!.id
          },
          include: {
            area: {
              select: {
                id: true,
                name: true,
                userId: true
              }
            }
          }
        });
        
        if (verifyMember) {
          console.log(`エリアメンバー追加確認完了 - エリア名: ${verifyMember.area.name}, エリア所有者: ${verifyMember.area.userId}, メンバー: ${verifyMember.userId}`);
        } else {
          console.error(`エリアメンバー追加確認失敗 - areaId: ${invite.areaId}, userId: ${req.user!.id}`);
        }
      }
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