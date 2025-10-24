"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const index_1 = require("../index");
const router = express_1.default.Router();
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
        const existingLog = await index_1.prisma.participationLog.findFirst({
            where: {
                userId,
                areaId,
                exitedAt: null
            }
        });
        if (existingLog) {
            return res.status(400).json({ error: '既にこのエリアに参加中です' });
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
        console.error('ジオフェンス入場ログ作成エラー:', error);
        res.status(500).json({ error: '参加ログの作成に失敗しました' });
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
        console.error('ジオフェンス退場ログ更新エラー:', error);
        res.status(500).json({ error: '参加ログの更新に失敗しました' });
    }
});
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.user.id;
        if (userId !== currentUserId) {
            const friendship = await index_1.prisma.friend.findFirst({
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
        const participationLogs = await index_1.prisma.participationLog.findMany({
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
            take: 50
        });
        res.json({ participationLogs });
    }
    catch (error) {
        console.error('参加ログ履歴取得エラー:', error);
        res.status(500).json({ error: '参加ログの取得に失敗しました' });
    }
});
router.get('/area/:areaId', async (req, res) => {
    try {
        const { areaId } = req.params;
        const area = await index_1.prisma.area.findUnique({
            where: { id: areaId, isDeleted: false }
        });
        if (!area) {
            return res.status(404).json({ error: 'エリアが見つかりません' });
        }
        const participationLogs = await index_1.prisma.participationLog.findMany({
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
            take: 100
        });
        res.json({ participationLogs });
    }
    catch (error) {
        console.error('エリア参加ログ取得エラー:', error);
        res.status(500).json({ error: 'エリア参加ログの取得に失敗しました' });
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
