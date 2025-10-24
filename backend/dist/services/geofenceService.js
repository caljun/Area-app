"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.geofenceService = exports.GeofenceService = void 0;
const index_1 = require("../index");
const firebaseAdmin_1 = require("./firebaseAdmin");
class GeofenceService {
    constructor() {
        this.activeUsers = new Map();
    }
    static getInstance() {
        if (!GeofenceService.instance) {
            GeofenceService.instance = new GeofenceService();
        }
        return GeofenceService.instance;
    }
    async checkUserLocation(userId, latitude, longitude) {
        try {
            const userAreas = await index_1.prisma.areaMember.findMany({
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
            for (const userArea of userAreas) {
                const area = userArea.area;
                const coordinates = area.coordinates;
                const isInside = this.isPointInPolygon([longitude, latitude], coordinates);
                const currentAreaId = this.activeUsers.get(userId)?.areaId;
                if (isInside && currentAreaId !== area.id) {
                    await this.handleAreaEntry(userId, area.id, area.name);
                }
                else if (!isInside && currentAreaId === area.id) {
                    await this.handleAreaExit(userId, area.id, area.name);
                }
            }
        }
        catch (error) {
            console.error('ジオフェンス位置チェックエラー:', error);
        }
    }
    async handleAreaEntry(userId, areaId, areaName) {
        try {
            console.log(`🎯 ジオフェンス入場検知 - userId: ${userId}, areaId: ${areaId}, areaName: ${areaName}`);
            const currentArea = this.activeUsers.get(userId);
            if (currentArea) {
                await this.handleAreaExit(userId, currentArea.areaId, 'Previous Area');
            }
            this.activeUsers.set(userId, { areaId, enteredAt: new Date() });
            await index_1.prisma.participationLog.create({
                data: {
                    userId,
                    areaId,
                    enteredAt: new Date()
                }
            });
            await this.updateAreaStatistics(areaId, 'enter');
            await this.notifyFriends(userId, 'entered', areaName);
            await this.sendEntryNotification(userId, areaName);
        }
        catch (error) {
            console.error('エリア入場処理エラー:', error);
        }
    }
    async handleAreaExit(userId, areaId, areaName) {
        try {
            console.log(`🎯 ジオフェンス退場検知 - userId: ${userId}, areaId: ${areaId}, areaName: ${areaName}`);
            const userEntry = this.activeUsers.get(userId);
            if (!userEntry || userEntry.areaId !== areaId) {
                return;
            }
            const exitTime = new Date();
            const durationSeconds = Math.floor((exitTime.getTime() - userEntry.enteredAt.getTime()) / 1000);
            await index_1.prisma.participationLog.updateMany({
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
            this.activeUsers.delete(userId);
            await this.updateAreaStatistics(areaId, 'exit', durationSeconds);
            await this.notifyFriends(userId, 'exited', areaName);
        }
        catch (error) {
            console.error('エリア退場処理エラー:', error);
        }
    }
    async updateAreaStatistics(areaId, action, durationSeconds) {
        try {
            let statistics = await index_1.prisma.areaStatistics.findUnique({
                where: { areaId }
            });
            if (!statistics) {
                statistics = await index_1.prisma.areaStatistics.create({
                    data: { areaId }
                });
            }
            if (action === 'enter') {
                await index_1.prisma.areaStatistics.update({
                    where: { areaId },
                    data: {
                        currentParticipants: { increment: 1 },
                        totalVisits: { increment: 1 },
                        lastActivity: new Date()
                    }
                });
            }
            else if (action === 'exit') {
                await index_1.prisma.areaStatistics.update({
                    where: { areaId },
                    data: {
                        currentParticipants: { decrement: 1 },
                        lastActivity: new Date()
                    }
                });
                if (durationSeconds) {
                    const allLogs = await index_1.prisma.participationLog.findMany({
                        where: {
                            areaId,
                            durationSeconds: { not: null }
                        },
                        select: { durationSeconds: true }
                    });
                    const totalDuration = allLogs.reduce((sum, log) => sum + (log.durationSeconds || 0), 0);
                    const averageStayTime = allLogs.length > 0 ? Math.floor(totalDuration / allLogs.length) : 0;
                    await index_1.prisma.areaStatistics.update({
                        where: { areaId },
                        data: { averageStayTimeSeconds: averageStayTime }
                    });
                }
            }
        }
        catch (error) {
            console.error('エリア統計更新エラー:', error);
        }
    }
    async notifyFriends(userId, eventType, areaName) {
        try {
            const friends = await index_1.prisma.friend.findMany({
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
            const user = await index_1.prisma.user.findUnique({
                where: { id: userId },
                select: { name: true }
            });
            if (!user)
                return;
            for (const friendship of friends) {
                const friend = friendship.userId === userId ? friendship.friend : friendship.user;
                if (!friend)
                    continue;
                console.log(`友達通知: ${friend.name}に${user.name}の${areaName}${eventType === 'entered' ? '入場' : '退場'}を通知`);
                if (friend.deviceToken) {
                    await (0, firebaseAdmin_1.sendPushNotification)(friend.deviceToken, `${user.name}さんが${areaName}に${eventType === 'entered' ? '入場' : '退場'}しました`, `${eventType === 'entered' ? '入場' : '退場'}時刻: ${new Date().toLocaleString('ja-JP')}`, {
                        type: 'geofence_event',
                        userId,
                        areaName,
                        eventType
                    });
                }
            }
        }
        catch (error) {
            console.error('友達通知エラー:', error);
        }
    }
    async sendEntryNotification(userId, areaName) {
        try {
            const user = await index_1.prisma.user.findUnique({
                where: { id: userId },
                select: { deviceToken: true, name: true }
            });
            if (user?.deviceToken) {
                await (0, firebaseAdmin_1.sendPushNotification)(user.deviceToken, `${areaName}に入場しました`, `入場時刻: ${new Date().toLocaleString('ja-JP')}`, {
                    type: 'area_entry',
                    areaName
                });
            }
        }
        catch (error) {
            console.error('入場通知送信エラー:', error);
        }
    }
    isPointInPolygon(point, polygon) {
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
    getUserActiveArea(userId) {
        return this.activeUsers.get(userId) || null;
    }
    getAreaActiveUsers(areaId) {
        let count = 0;
        for (const [, userData] of this.activeUsers) {
            if (userData.areaId === areaId) {
                count++;
            }
        }
        return count;
    }
    getAllActiveUsers() {
        return new Map(this.activeUsers);
    }
}
exports.GeofenceService = GeofenceService;
exports.geofenceService = GeofenceService.getInstance();
