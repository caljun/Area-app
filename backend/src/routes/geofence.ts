import express from 'express';
import { prisma } from '../index';
import { geofenceService } from '../services/geofenceService';

const router = express.Router();

// ジオフェンス位置更新（フロントエンドからの位置情報受信）
router.post('/location-update', async (req: any, res) => {
  try {
    const { latitude, longitude } = req.body;
    const userId = req.user.id;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: '緯度と経度が必要です' });
    }

    // ジオフェンス監視サービスで位置情報をチェック
    await geofenceService.checkUserLocation(userId, latitude, longitude);

    res.json({ success: true });
  } catch (error) {
    console.error('ジオフェンス位置更新エラー:', error);
    res.status(500).json({ error: '位置情報の更新に失敗しました' });
  }
});

// エリア入場（手動）
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

    // エリアメンバーかどうかチェック
    const membership = await prisma.areaMember.findFirst({
      where: {
        areaId,
        userId
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'このエリアのメンバーではありません' });
    }

    // 参加ログを作成
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
    console.error('エリア入場エラー:', error);
    res.status(500).json({ error: 'エリア入場に失敗しました' });
  }
});

// エリア退場（手動）
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
    console.error('エリア退場エラー:', error);
    res.status(500).json({ error: 'エリア退場に失敗しました' });
  }
});

// 現在の参加状況取得
router.get('/status', async (req: any, res) => {
  try {
    const userId = req.user.id;

    // 現在参加中のエリアを取得
    const activeParticipations = await prisma.participationLog.findMany({
      where: {
        userId,
        exitedAt: null
      },
      include: {
        area: {
          select: {
            id: true,
            name: true,
            imageUrl: true
          }
        }
      }
    });

    res.json({
      activeAreas: activeParticipations.map(log => ({
        areaId: log.area.id,
        areaName: log.area.name,
        areaImageUrl: log.area.imageUrl,
        enteredAt: log.enteredAt
      }))
    });
  } catch (error) {
    console.error('参加状況取得エラー:', error);
    res.status(500).json({ error: '参加状況の取得に失敗しました' });
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
