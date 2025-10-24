import express from 'express';
import { prisma } from '../index';

const router = express.Router();

// エリア統計情報取得
router.get('/:areaId', async (req: any, res) => {
  try {
    const { areaId } = req.params;

    // エリアの存在確認
    const area = await prisma.area.findUnique({
      where: { id: areaId, isDeleted: false },
      select: {
        id: true,
        name: true,
        imageUrl: true
      }
    });

    if (!area) {
      return res.status(404).json({ error: 'エリアが見つかりません' });
    }

    // エリア統計を取得または作成
    let statistics = await prisma.areaStatistics.findUnique({
      where: { areaId }
    });

    if (!statistics) {
      statistics = await prisma.areaStatistics.create({
        data: { areaId }
      });
    }

    // 現在の参加者数をリアルタイムで計算
    const currentParticipants = await prisma.participationLog.count({
      where: {
        areaId,
        exitedAt: null
      }
    });

    // 総投稿数を計算
    const totalPosts = await prisma.post.count({
      where: { areaId }
    });

    // 統計情報を更新
    const updatedStatistics = await prisma.areaStatistics.update({
      where: { areaId },
      data: {
        currentParticipants,
        totalPosts
      }
    });

    res.json({
      area: {
        id: area.id,
        name: area.name,
        imageUrl: area.imageUrl
      },
      statistics: {
        currentParticipants: updatedStatistics.currentParticipants,
        totalPosts: updatedStatistics.totalPosts,
        totalVisits: updatedStatistics.totalVisits,
        averageStayTimeSeconds: updatedStatistics.averageStayTimeSeconds,
        lastActivity: updatedStatistics.lastActivity
      }
    });
  } catch (error) {
    console.error('エリア統計取得エラー:', error);
    res.status(500).json({ error: 'エリア統計の取得に失敗しました' });
  }
});

// エリア参加者一覧取得
router.get('/:areaId/participants', async (req: any, res) => {
  try {
    const { areaId } = req.params;

    // エリアの存在確認
    const area = await prisma.area.findUnique({
      where: { id: areaId, isDeleted: false }
    });

    if (!area) {
      return res.status(404).json({ error: 'エリアが見つかりません' });
    }

    // 現在参加中のユーザーを取得
    const activeParticipants = await prisma.participationLog.findMany({
      where: {
        areaId,
        exitedAt: null
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profileImage: true,
            displayId: true
          }
        }
      },
      orderBy: { enteredAt: 'desc' }
    });

    // 参加者情報を整形
    const participants = activeParticipants.map(log => ({
      id: log.user.id,
      name: log.user.name,
      profileImage: log.user.profileImage,
      displayId: log.user.displayId,
      enteredAt: log.enteredAt
    }));

    res.json({ participants });
  } catch (error) {
    console.error('エリア参加者一覧取得エラー:', error);
    res.status(500).json({ error: 'エリア参加者の取得に失敗しました' });
  }
});

// エリア履歴取得
router.get('/:areaId/history', async (req: any, res) => {
  try {
    const { areaId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    // エリアの存在確認
    const area = await prisma.area.findUnique({
      where: { id: areaId, isDeleted: false }
    });

    if (!area) {
      return res.status(404).json({ error: 'エリアが見つかりません' });
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    // エリアの履歴（投稿）を取得
    const posts = await prisma.post.findMany({
      where: { areaId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profileImage: true
          }
        },
        _count: {
          select: {
            comments: true,
            likes: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit as string)
    });

    // 投稿情報を整形
    const history = posts.map(post => ({
      id: post.id,
      content: post.content,
      imageUrl: post.imageUrl,
      location: post.location,
      user: {
        id: post.user.id,
        name: post.user.name,
        profileImage: post.user.profileImage
      },
      likeCount: post.likeCount,
      commentCount: post.commentCount,
      createdAt: post.createdAt
    }));

    res.json({ history });
  } catch (error) {
    console.error('エリア履歴取得エラー:', error);
    res.status(500).json({ error: 'エリア履歴の取得に失敗しました' });
  }
});

// 全エリア履歴取得（ユーザーが参加したエリアの履歴）
router.get('/history', async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    // ユーザーが参加したエリアの履歴を取得
    const participationLogs = await prisma.participationLog.findMany({
      where: { userId },
      include: {
        area: {
          select: {
            id: true,
            name: true,
            imageUrl: true
          }
        }
      },
      orderBy: { enteredAt: 'desc' },
      skip,
      take: parseInt(limit as string)
    });

    res.json({ participationLogs });
  } catch (error) {
    console.error('全エリア履歴取得エラー:', error);
    res.status(500).json({ error: 'エリア履歴の取得に失敗しました' });
  }
});

export default router;
