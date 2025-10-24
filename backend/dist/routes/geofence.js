"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const index_1 = require("../index");
const geofenceService_1 = require("../services/geofenceService");
const router = express_1.default.Router();
router.post('/location-update', async (req, res) => {
    try {
        const { latitude, longitude } = req.body;
        const userId = req.user.id;
        if (!latitude || !longitude) {
            return res.status(400).json({ error: '緯度と経度が必要です' });
        }
        await geofenceService_1.geofenceService.checkUserLocation(userId, latitude, longitude);
        res.json({ success: true });
    }
    catch (error) {
        console.error('ジオフェンス位置更新エラー:', error);
        res.status(500).json({ error: '位置情報の更新に失敗しました' });
    }
});
router.post('/enter', async (req, res) => {
    try {
        const { areaId } = req.body;
        const userId = req.user.id;
        if (!areaId) {
            return res.status(400).json({ error: 'エリアIDが必要です' });
        }
        const area = await index_1.prisma.area.findUnique({
            where: { id: areaId, isDeleted: false }
        });
        if (!area) {
            return res.status(404).json({ error: 'エリアが見つかりません' });
        }
        const membership = await index_1.prisma.areaMember.findFirst({
            where: {
                areaId,
                userId
            }
        });
        if (!membership) {
            return res.status(403).json({ error: 'このエリアのメンバーではありません' });
        }
        const participationLog = await index_1.prisma.participationLog.create({
            data: {
                userId,
                areaId,
                enteredAt: new Date()
            }
        });
        await updateAreaStatistics(areaId, 'enter');
        res.json({
            success: true,
            participationLog: {
                id: participationLog.id,
                areaId: participationLog.areaId,
                enteredAt: participationLog.enteredAt
            }
        });
    }
    catch (error) {
        console.error('エリア入場エラー:', error);
        res.status(500).json({ error: 'エリア入場に失敗しました' });
    }
});
router.post('/exit', async (req, res) => {
    try {
        const { areaId } = req.body;
        const userId = req.user.id;
        if (!areaId) {
            return res.status(400).json({ error: 'エリアIDが必要です' });
        }
        const participationLog = await index_1.prisma.participationLog.findFirst({
            where: {
                userId,
                areaId,
                exitedAt: null
            }
        });
        if (!participationLog) {
            return res.status(404).json({ error: '参加ログが見つかりません' });
        }
        const exitTime = new Date();
        const durationSeconds = Math.floor((exitTime.getTime() - participationLog.enteredAt.getTime()) / 1000);
        const updatedLog = await index_1.prisma.participationLog.update({
            where: { id: participationLog.id },
            data: {
                exitedAt: exitTime,
                durationSeconds
            }
        });
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
    }
    catch (error) {
        console.error('エリア退場エラー:', error);
        res.status(500).json({ error: 'エリア退場に失敗しました' });
    }
});
router.get('/status', async (req, res) => {
    try {
        const userId = req.user.id;
        const activeParticipations = await index_1.prisma.participationLog.findMany({
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
    }
    catch (error) {
        console.error('参加状況取得エラー:', error);
        res.status(500).json({ error: '参加状況の取得に失敗しました' });
    }
});
async function updateAreaStatistics(areaId, action, durationSeconds) {
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
exports.default = router;
