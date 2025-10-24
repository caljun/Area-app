import express from 'express';
import { prisma } from '../index';

const router = express.Router();

// ジオフェンス入場ログ作成
router.post('/enter', async (req: any, res) => {
  try {
    const { areaId } = req.body;
    const userId = req.user.id;

    if (!areaId) {
      return res.status(400).json({ error: 'エリアIDが必要です' });
    }

    // エリアの存在確認
    const area = await prisma.area.findUnique({
      where: { id: areaId, isDeleted: false }
    });

    if (!area) {
      return res.status(404).json({ error: 'エリアが見つかりません' });
    }

    // 既に未完了の参加ログがあるかチェック
    const existingLog = await prisma.participationLog.findFirst({
      where: {
        userId,
        areaId,
        exitedAt: null
      }
    });

    if (existingLog) {
      return res.status(400).json({ error: '既にこのエリアに参加中です' });
    }

    // 新しい参加ログを作成
    const participationLog = await prisma.participationLog.create({
      data: {
        userId,
        areaId,
        enteredAt: new Date()
      }
    });

    // エリア統計を更新
    await updateAreaStatistics(areaId, 'enter');

    res.json({
      success: true,
      participationLog: {
        id: participationLog.id,
        areaId: participationLog.areaId,
        enteredAt: participationLog.enteredAt
      }
    });
  } catch (error) {
    console.error('ジオフェンス入場ログ作成エラー:', error);
    res.status(500).json({ error: '参加ログの作成に失敗しました' });
  }
});

// ジオフェンス退場ログ更新
router.post('/exit', async (req: any, res) => {
  try {
    const { areaId } = req.body;
    const userId = req.user.id;

    if (!areaId) {
      return res.status(400).json({ error: 'エリアIDが必要です' });
    }

    // 未完了の参加ログを検索
    const participationLog = await prisma.participationLog.findFirst({
      where: {
        userId,
        areaId,
        exitedAt: null
      }
    });

    if (!participationLog) {
      return res.status(404).json({ error: '参加ログが見つかりません' });
    }

    // 滞在時間を計算
    const exitTime = new Date();
    const durationSeconds = Math.floor((exitTime.getTime() - participationLog.enteredAt.getTime()) / 1000);

    // 参加ログを更新
    const updatedLog = await prisma.participationLog.update({
      where: { id: participationLog.id },
      data: {
        exitedAt: exitTime,
        durationSeconds
      }
    });

    // エリア統計を更新
    await updateAreaStatistics(areaId, 'exit', durationSeconds);

    res.json({
      success: true,
      participationLog: {
        id: updatedLog.id,
        areaId: updatedLog.areaId,
        enteredAt: updatedLog.enteredAt,
        exitedAt: updatedLog.exitedAt,
        durationSeconds: updatedLog.durationSeconds
      }
    });
  } catch (error) {
    console.error('ジオフェンス退場ログ更新エラー:', error);
    res.status(500).json({ error: '参加ログの更新に失敗しました' });
  }
});

// ユーザーの参加ログ履歴取得
router.get('/user/:userId', async (req: any, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    // 自分のログまたは友達のログのみ取得可能
    if (userId !== currentUserId) {
      // 友達関係をチェック
      const friendship = await prisma.friend.findFirst({
        where: {
          OR: [
            { userId: currentUserId, friendId: userId },
            { userId: userId, friendId: currentUserId }
          ]
        }
      });

      if (!friendship) {
        return res.status(403).json({ error: 'アクセス権限がありません' });
      }
    }

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
      take: 50 // 最新50件
    });

    res.json({ participationLogs });
  } catch (error) {
    console.error('参加ログ履歴取得エラー:', error);
    res.status(500).json({ error: '参加ログの取得に失敗しました' });
  }
});

// エリアの参加ログ取得
router.get('/area/:areaId', async (req: any, res) => {
  try {
    const { areaId } = req.params;

    // エリアの存在確認
    const area = await prisma.area.findUnique({
      where: { id: areaId, isDeleted: false }
    });

    if (!area) {
      return res.status(404).json({ error: 'エリアが見つかりません' });
    }

    const participationLogs = await prisma.participationLog.findMany({
      where: { areaId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profileImage: true
          }
        }
      },
      orderBy: { enteredAt: 'desc' },
      take: 100 // 最新100件
    });

    res.json({ participationLogs });
  } catch (error) {
    console.error('エリア参加ログ取得エラー:', error);
    res.status(500).json({ error: 'エリア参加ログの取得に失敗しました' });
  }
});

// エリア統計更新ヘルパー関数
async function updateAreaStatistics(areaId: string, action: 'enter' | 'exit', durationSeconds?: number) {
  try {
    // エリア統計を取得または作成
    let statistics = await prisma.areaStatistics.findUnique({
      where: { areaId }
    });

    if (!statistics) {
      statistics = await prisma.areaStatistics.create({
        data: { areaId }
      });
    }

    if (action === 'enter') {
      // 入場時：現在の参加者数を増加
      await prisma.areaStatistics.update({
        where: { areaId },
        data: {
          currentParticipants: { increment: 1 },
          totalVisits: { increment: 1 },
          lastActivity: new Date()
        }
      });
    } else if (action === 'exit') {
      // 退場時：現在の参加者数を減少
      await prisma.areaStatistics.update({
        where: { areaId },
        data: {
          currentParticipants: { decrement: 1 },
          lastActivity: new Date()
        }
      });

      // 平均滞在時間を更新
      if (durationSeconds) {
        const allLogs = await prisma.participationLog.findMany({
          where: {
            areaId,
            durationSeconds: { not: null }
          },
          select: { durationSeconds: true }
        });

        const totalDuration = allLogs.reduce((sum, log) => sum + (log.durationSeconds || 0), 0);
        const averageStayTime = allLogs.length > 0 ? Math.floor(totalDuration / allLogs.length) : 0;

        await prisma.areaStatistics.update({
          where: { areaId },
          data: { averageStayTimeSeconds: averageStayTime }
        });
      }
    }
  } catch (error) {
    console.error('エリア統計更新エラー:', error);
  }
}

export default router;
