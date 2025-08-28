"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const index_1 = require("../index");
const router = (0, express_1.Router)();
const updateLocationSchema = zod_1.z.object({
    latitude: zod_1.z.number().min(-90).max(90),
    longitude: zod_1.z.number().min(-180).max(180)
});
router.post('/', async (req, res) => {
    try {
        const { latitude, longitude } = updateLocationSchema.parse(req.body);
        const location = await index_1.prisma.location.create({
            data: {
                userId: req.user.id,
                latitude,
                longitude
            }
        });
        try {
            const friends = await index_1.prisma.friend.findMany({
                where: { userId: req.user.id },
                include: {
                    friend: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            });
            for (const friend of friends) {
                await index_1.prisma.notification.create({
                    data: {
                        type: 'LOCATION_UPDATE',
                        title: '位置情報更新',
                        message: `${req.user.name}さんの位置情報が更新されました`,
                        data: {
                            userId: req.user.id,
                            userName: req.user.name,
                            latitude,
                            longitude,
                            timestamp: new Date()
                        },
                        recipientId: friend.friend.id,
                        senderId: req.user.id
                    }
                });
            }
        }
        catch (notificationError) {
            console.error('Failed to create location update notifications:', notificationError);
        }
        return res.status(201).json({
            message: '位置情報が更新されました',
            location
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                error: '入力内容に問題があります',
                details: error.errors
            });
        }
        console.error('Update location error:', error);
        return res.status(500).json({ error: '位置情報の更新に失敗しました' });
    }
});
router.get('/friends', async (req, res) => {
    try {
        const friends = await index_1.prisma.friend.findMany({
            where: { userId: req.user.id },
            include: {
                friend: {
                    select: {
                        id: true,
                        name: true,
                        profileImage: true
                    }
                }
            }
        });
        const friendIds = friends.map(f => f.friend.id);
        const locations = await index_1.prisma.location.findMany({
            where: {
                userId: { in: friendIds }
            },
            orderBy: { createdAt: 'desc' },
            distinct: ['userId']
        });
        const friendsWithLocations = friends.map(friend => {
            const location = locations.find(loc => loc.userId === friend.friend.id);
            return {
                ...friend.friend,
                location: location ? {
                    latitude: location.latitude,
                    longitude: location.longitude,
                    updatedAt: location.createdAt
                } : null
            };
        });
        return res.json(friendsWithLocations);
    }
    catch (error) {
        console.error('Get friend locations error:', error);
        return res.status(500).json({ error: '友達の位置情報取得に失敗しました' });
    }
});
router.get('/history', async (req, res) => {
    try {
        const { page = '1', limit = '50' } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const locations = await index_1.prisma.location.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' },
            skip: (pageNum - 1) * limitNum,
            take: limitNum
        });
        const total = await index_1.prisma.location.count({
            where: { userId: req.user.id }
        });
        return res.json({
            locations,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum)
            }
        });
    }
    catch (error) {
        console.error('Get location history error:', error);
        return res.status(500).json({ error: '位置情報履歴の取得に失敗しました' });
    }
});
exports.default = router;
