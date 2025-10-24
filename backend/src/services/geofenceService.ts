import { prisma } from '../index';
import { sendPushNotification } from './firebaseAdmin';

// ジオフェンス監視サービスクラス
export class GeofenceService {
  private static instance: GeofenceService;
  private activeUsers: Map<string, { areaId: string; enteredAt: Date }> = new Map();

  private constructor() {}

  public static getInstance(): GeofenceService {
    if (!GeofenceService.instance) {
      GeofenceService.instance = new GeofenceService();
    }
    return GeofenceService.instance;
  }

  // ユーザーの位置情報をチェックしてジオフェンス入退場を判定
  public async checkUserLocation(userId: string, latitude: number, longitude: number): Promise<void> {
    try {
      // ユーザーが参加しているエリアを取得
      const userAreas = await prisma.areaMember.findMany({
        where: { userId },
        include: {
          area: {
            select: {
              id: true,
              name: true,
              coordinates: true
            }
          }
        }
      });

      // 各エリアでジオフェンス判定
      for (const userArea of userAreas) {
        const area = userArea.area;
        const coordinates = area.coordinates as Array<{latitude: number, longitude: number}>;
        
        // ポリゴン内判定
        const isInside = this.isPointInPolygon([longitude, latitude], coordinates);
        const currentAreaId = this.activeUsers.get(userId)?.areaId;

        if (isInside && currentAreaId !== area.id) {
          // エリアに入場
          await this.handleAreaEntry(userId, area.id, area.name);
        } else if (!isInside && currentAreaId === area.id) {
          // エリアから退場
          await this.handleAreaExit(userId, area.id, area.name);
        }
      }
    } catch (error) {
      console.error('ジオフェンス位置チェックエラー:', error);
    }
  }

  // エリア入場処理
  private async handleAreaEntry(userId: string, areaId: string, areaName: string): Promise<void> {
    try {
      console.log(`🎯 ジオフェンス入場検知 - userId: ${userId}, areaId: ${areaId}, areaName: ${areaName}`);

      // 前のエリアから退場処理
      const currentArea = this.activeUsers.get(userId);
      if (currentArea) {
        await this.handleAreaExit(userId, currentArea.areaId, 'Previous Area');
      }

      // 新しいエリアに入場
      this.activeUsers.set(userId, { areaId, enteredAt: new Date() });

      // 参加ログを作成
      await prisma.participationLog.create({
        data: {
          userId,
          areaId,
          enteredAt: new Date()
        }
      });

      // エリア統計を更新
      await this.updateAreaStatistics(areaId, 'enter');

      // 友達に通知
      await this.notifyFriends(userId, 'entered', areaName);

      // プッシュ通知を送信
      await this.sendEntryNotification(userId, areaName);

    } catch (error) {
      console.error('エリア入場処理エラー:', error);
    }
  }

  // エリア退場処理
  private async handleAreaExit(userId: string, areaId: string, areaName: string): Promise<void> {
    try {
      console.log(`🎯 ジオフェンス退場検知 - userId: ${userId}, areaId: ${areaId}, areaName: ${areaName}`);

      const userEntry = this.activeUsers.get(userId);
      if (!userEntry || userEntry.areaId !== areaId) {
        return; // 既に退場済みまたは異なるエリア
      }

      // 滞在時間を計算
      const exitTime = new Date();
      const durationSeconds = Math.floor((exitTime.getTime() - userEntry.enteredAt.getTime()) / 1000);

      // 参加ログを更新
      await prisma.participationLog.updateMany({
        where: {
          userId,
          areaId,
          exitedAt: null
        },
        data: {
          exitedAt: exitTime,
          durationSeconds
        }
      });

      // アクティブユーザーから削除
      this.activeUsers.delete(userId);

      // エリア統計を更新
      await this.updateAreaStatistics(areaId, 'exit', durationSeconds);

      // 友達に通知
      await this.notifyFriends(userId, 'exited', areaName);

    } catch (error) {
      console.error('エリア退場処理エラー:', error);
    }
  }

  // エリア統計更新
  private async updateAreaStatistics(areaId: string, action: 'enter' | 'exit', durationSeconds?: number): Promise<void> {
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

  // 友達に通知
  private async notifyFriends(userId: string, eventType: 'entered' | 'exited', areaName: string): Promise<void> {
    try {
      const friends = await prisma.friend.findMany({
        where: {
          OR: [
            { userId: userId },
            { friendId: userId }
          ]
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              deviceToken: true
            }
          },
          friend: {
            select: {
              id: true,
              name: true,
              deviceToken: true
            }
          }
        }
      });

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true }
      });

      if (!user) return;

      for (const friendship of friends) {
        const friend = friendship.userId === userId ? friendship.friend : friendship.user;
        if (!friend) continue;

        // WebSocket通知（既存の実装を活用）
        // ここでは簡易的にログ出力
        console.log(`友達通知: ${friend.name}に${user.name}の${areaName}${eventType === 'entered' ? '入場' : '退場'}を通知`);

        // プッシュ通知を送信
        if (friend.deviceToken) {
          await sendPushNotification(
            friend.deviceToken,
            `${user.name}さんが${areaName}に${eventType === 'entered' ? '入場' : '退場'}しました`,
            `${eventType === 'entered' ? '入場' : '退場'}時刻: ${new Date().toLocaleString('ja-JP')}`,
            {
              type: 'geofence_event',
              userId,
              areaName,
              eventType
            }
          );
        }
      }
    } catch (error) {
      console.error('友達通知エラー:', error);
    }
  }

  // 入場通知送信
  private async sendEntryNotification(userId: string, areaName: string): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { deviceToken: true, name: true }
      });

      if (user?.deviceToken) {
        await sendPushNotification(
          user.deviceToken,
          `${areaName}に入場しました`,
          `入場時刻: ${new Date().toLocaleString('ja-JP')}`,
          {
            type: 'area_entry',
            areaName
          }
        );
      }
    } catch (error) {
      console.error('入場通知送信エラー:', error);
    }
  }

  // ポリゴン内判定（点がポリゴン内にあるかチェック）
  private isPointInPolygon(point: [number, number], polygon: Array<{latitude: number, longitude: number}>): boolean {
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

  // ユーザーのアクティブエリアを取得
  public getUserActiveArea(userId: string): { areaId: string; enteredAt: Date } | null {
    return this.activeUsers.get(userId) || null;
  }

  // エリアの現在参加者数を取得
  public getAreaActiveUsers(areaId: string): number {
    let count = 0;
    for (const [, userData] of this.activeUsers) {
      if (userData.areaId === areaId) {
        count++;
      }
    }
    return count;
  }

  // 全アクティブユーザーを取得
  public getAllActiveUsers(): Map<string, { areaId: string; enteredAt: Date }> {
    return new Map(this.activeUsers);
  }
}

// シングルトンインスタンスをエクスポート
export const geofenceService = GeofenceService.getInstance();
