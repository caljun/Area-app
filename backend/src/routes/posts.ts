import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// Validation schemas
const createPostSchema = z.object({
  content: z.string().min(1, '投稿内容は必須です'),
  imageUrl: z.string().url('画像URLの形式が正しくありません').optional(),
  location: z.object({
    type: z.literal('Point'),
    coordinates: z.array(z.number()).length(2) // [longitude, latitude]
  }),
  areaId: z.string().min(1, 'エリアIDは必須です')
});

const updatePostSchema = z.object({
  content: z.string().min(1, '投稿内容は必須です').optional(),
  imageUrl: z.string().url('画像URLの形式が正しくありません').optional()
});

const commentSchema = z.object({
  content: z.string().min(1, 'コメント内容は必須です')
});

// GeoFence判定関数（点がポリゴン内にあるかチェック）
function isPointInPolygon(point: [number, number], polygon: Array<{latitude: number, longitude: number}>): boolean {
  const [x, y] = point;
  let inside = false;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].longitude;
    const yi = polygon[i].latitude;
    const xj = polygon[j].longitude;
    const yj = polygon[j].latitude;
    
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  
  return inside;
}

// 投稿作成
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { content, imageUrl, location, areaId } = createPostSchema.parse(req.body);
    
    // エリアの存在確認
    const area = await prisma.area.findUnique({
      where: { id: areaId },
      select: { 
        id: true, 
        name: true, 
        coordinates: true,
        userId: true,
        areaMembers: {
          where: { userId: req.user!.id }
        }
      }
    });

    if (!area) {
      return res.status(404).json({ error: 'エリアが見つかりません' });
    }

    // エリアのメンバーかどうかチェック
    const isOwner = area.userId === req.user!.id;
    const isMember = area.areaMembers.length > 0;
    
    if (!isOwner && !isMember) {
      return res.status(403).json({ error: 'このエリアのメンバーではありません' });
    }

    // 投稿位置がエリア内かどうかを判定
    const coordinates = area.coordinates as Array<{latitude: number, longitude: number}>;
    const isInArea = isPointInPolygon([location.coordinates[0], location.coordinates[1]], coordinates);
    
    if (!isInArea) {
      return res.status(403).json({ error: 'エリア内でのみ投稿可能です' });
    }

    // ユーザー情報を取得
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { name: true, profileImage: true }
    });

    // 投稿を作成
    const post = await prisma.post.create({
      data: {
        content,
        imageUrl,
        location,
        areaId,
        userId: req.user!.id,
        userName: user?.name,
        userProfileImage: user?.profileImage
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profileImage: true
          }
        },
        area: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    res.status(201).json(post);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: '入力内容に問題があります',
        details: error.errors
      });
    }
    
    console.error('Create post error:', error);
    res.status(500).json({ error: '投稿の作成に失敗しました' });
  }
});

// 投稿一覧取得（エリア別）
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { areaId, page = '1', limit = '20' } = req.query;
    
    if (!areaId) {
      return res.status(400).json({ error: 'エリアIDは必須です' });
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // エリアのメンバーかどうかチェック
    const area = await prisma.area.findFirst({
      where: {
        id: areaId as string,
        OR: [
          { userId: req.user!.id },
          { 
            areaMembers: {
              some: { userId: req.user!.id }
            }
          }
        ]
      }
    });

    if (!area) {
      return res.status(404).json({ error: 'エリアが見つかりません' });
    }

    // 投稿を取得
    const posts = await prisma.post.findMany({
      where: { areaId: areaId as string },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profileImage: true
          }
        },
        area: {
          select: {
            id: true,
            name: true
          }
        },
        likes: {
          where: { userId: req.user!.id }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limitNum
    });

    // いいね状態を設定
    const postsWithLikeStatus = posts.map(post => ({
      ...post,
      isLiked: post.likes.length > 0,
      likes: undefined // likesフィールドを除外
    }));

    const total = await prisma.post.count({
      where: { areaId: areaId as string }
    });

    res.json({
      posts: postsWithLikeStatus,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ error: '投稿の取得に失敗しました' });
  }
});

// 投稿詳細取得
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profileImage: true
          }
        },
        area: {
          select: {
            id: true,
            name: true
          }
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                profileImage: true
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        likes: {
          where: { userId: req.user!.id }
        }
      }
    });

    if (!post) {
      return res.status(404).json({ error: '投稿が見つかりません' });
    }

    // エリアのメンバーかどうかチェック
    const area = await prisma.area.findFirst({
      where: {
        id: post.areaId,
        OR: [
          { userId: req.user!.id },
          { 
            areaMembers: {
              some: { userId: req.user!.id }
            }
          }
        ]
      }
    });

    if (!area) {
      return res.status(403).json({ error: 'このエリアのメンバーではありません' });
    }

    const postWithLikeStatus = {
      ...post,
      isLiked: post.likes.length > 0,
      likes: undefined // likesフィールドを除外
    };

    res.json(postWithLikeStatus);
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ error: '投稿の取得に失敗しました' });
  }
});

// 投稿更新
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = updatePostSchema.parse(req.body);

    // 投稿の存在確認と所有者チェック
    const existingPost = await prisma.post.findFirst({
      where: {
        id,
        userId: req.user!.id
      }
    });

    if (!existingPost) {
      return res.status(404).json({ error: '投稿が見つからないか、編集権限がありません' });
    }

    const post = await prisma.post.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profileImage: true
          }
        },
        area: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    res.json(post);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: '入力内容に問題があります',
        details: error.errors
      });
    }
    
    console.error('Update post error:', error);
    res.status(500).json({ error: '投稿の更新に失敗しました' });
  }
});

// 投稿削除
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // 投稿の存在確認と所有者チェック
    const existingPost = await prisma.post.findFirst({
      where: {
        id,
        userId: req.user!.id
      }
    });

    if (!existingPost) {
      return res.status(404).json({ error: '投稿が見つからないか、削除権限がありません' });
    }

    await prisma.post.delete({
      where: { id }
    });

    res.status(204).send();
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: '投稿の削除に失敗しました' });
  }
});

// いいね機能
router.post('/:id/like', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { isLiked } = req.body;

    // 投稿の存在確認
    const post = await prisma.post.findUnique({
      where: { id }
    });

    if (!post) {
      return res.status(404).json({ error: '投稿が見つかりません' });
    }

    if (isLiked) {
      // いいねを追加
      await prisma.postLike.upsert({
        where: {
          postId_userId: {
            postId: id,
            userId: req.user!.id
          }
        },
        update: {},
        create: {
          postId: id,
          userId: req.user!.id
        }
      });

      // いいね数を更新
      await prisma.post.update({
        where: { id },
        data: {
          likeCount: { increment: 1 }
        }
      });
    } else {
      // いいねを削除
      await prisma.postLike.deleteMany({
        where: {
          postId: id,
          userId: req.user!.id
        }
      });

      // いいね数を更新
      await prisma.post.update({
        where: { id },
        data: {
          likeCount: { decrement: 1 }
        }
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ error: 'いいねの処理に失敗しました' });
  }
});

// コメント追加
router.post('/:id/comments', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { content } = commentSchema.parse(req.body);

    // 投稿の存在確認
    const post = await prisma.post.findUnique({
      where: { id }
    });

    if (!post) {
      return res.status(404).json({ error: '投稿が見つかりません' });
    }

    // ユーザー情報を取得
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { name: true, profileImage: true }
    });

    // コメントを作成
    const comment = await prisma.comment.create({
      data: {
        content,
        postId: id,
        userId: req.user!.id,
        userName: user?.name,
        userProfileImage: user?.profileImage
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profileImage: true
          }
        }
      }
    });

    // コメント数を更新
    await prisma.post.update({
      where: { id },
      data: {
        commentCount: { increment: 1 }
      }
    });

    res.status(201).json(comment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: '入力内容に問題があります',
        details: error.errors
      });
    }
    
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'コメントの追加に失敗しました' });
  }
});

// 近くの投稿取得
router.get('/nearby', async (req: AuthRequest, res: Response) => {
  try {
    const { lat, lng, radius = '1000' } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: '緯度と経度は必須です' });
    }

    const latitude = parseFloat(lat as string);
    const longitude = parseFloat(lng as string);
    const radiusMeters = parseInt(radius as string);

    // 近くの投稿を取得（簡易版 - 実際の実装ではGeoJSONクエリを使用）
    const posts = await prisma.post.findMany({
      where: {
        location: {
          // MongoDBのGeoJSONクエリを使用
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [longitude, latitude]
            },
            $maxDistance: radiusMeters
          }
        }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profileImage: true
          }
        },
        area: {
          select: {
            id: true,
            name: true
          }
        },
        likes: {
          where: { userId: req.user!.id }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    // いいね状態を設定
    const postsWithLikeStatus = posts.map(post => ({
      ...post,
      isLiked: post.likes.length > 0,
      likes: undefined // likesフィールドを除外
    }));

    res.json(postsWithLikeStatus);
  } catch (error) {
    console.error('Get nearby posts error:', error);
    res.status(500).json({ error: '近くの投稿の取得に失敗しました' });
  }
});

export default router;
