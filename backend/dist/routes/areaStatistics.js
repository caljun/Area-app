"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const index_1 = require("../index");
const router = express_1.default.Router();
router.get('/:areaId', async (req, res) => {
    try {
        const { areaId } = req.params;
        const area = await index_1.prisma.area.findUnique({
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
        let statistics = await index_1.prisma.areaStatistics.findUnique({
            where: { areaId }
        });
        if (!statistics) {
            statistics = await index_1.prisma.areaStatistics.create({
                data: { areaId }
            });
        }
        const currentParticipants = await index_1.prisma.participationLog.count({
            where: {
                areaId,
                exitedAt: null
            }
        });
        const totalPosts = await index_1.prisma.post.count({
            where: { areaId }
        });
        const updatedStatistics = await index_1.prisma.areaStatistics.update({
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
    }
    catch (error) {
        console.error('エリア統計取得エラー:', error);
        res.status(500).json({ error: 'エリア統計の取得に失敗しました' });
    }
});
router.get('/:areaId/participants', async (req, res) => {
    try {
        const { areaId } = req.params;
        const area = await index_1.prisma.area.findUnique({
            where: { id: areaId, isDeleted: false }
        });
        if (!area) {
            return res.status(404).json({ error: 'エリアが見つかりません' });
        }
        const activeParticipants = await index_1.prisma.participationLog.findMany({
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
        const participants = activeParticipants.map(log => ({
            id: log.user.id,
            name: log.user.name,
            profileImage: log.user.profileImage,
            displayId: log.user.displayId,
            enteredAt: log.enteredAt
        }));
        res.json({ participants });
    }
    catch (error) {
        console.error('エリア参加者一覧取得エラー:', error);
        res.status(500).json({ error: 'エリア参加者の取得に失敗しました' });
    }
});
router.get('/:areaId/history', async (req, res) => {
    try {
        const { areaId } = req.params;
        const { page = 1, limit = 20 } = req.query;
        const area = await index_1.prisma.area.findUnique({
            where: { id: areaId, isDeleted: false }
        });
        if (!area) {
            return res.status(404).json({ error: 'エリアが見つかりません' });
        }
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const posts = await index_1.prisma.post.findMany({
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
            take: parseInt(limit)
        });
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
    }
    catch (error) {
        console.error('エリア履歴取得エラー:', error);
        res.status(500).json({ error: 'エリア履歴の取得に失敗しました' });
    }
});
router.get('/history', async (req, res) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 20 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
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
            skip,
            take: parseInt(limit)
        });
        res.json({ participationLogs });
    }
    catch (error) {
        console.error('全エリア履歴取得エラー:', error);
        res.status(500).json({ error: 'エリア履歴の取得に失敗しました' });
    }
});
exports.default = router;
