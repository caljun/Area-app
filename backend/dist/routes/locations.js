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
router.post('/update', async (req, res) => {
    try {
        const { latitude, longitude, accuracy, timestamp, areaId } = req.body;
        if (!latitude || !longitude) {
            return res.status(400).json({ error: '緯度と経度が必要です' });
        }
        if (latitude === 0 && longitude === 0) {
            console.log(`無効な位置情報が送信されました (0,0) - userId: ${req.user.id}`);
            return res.status(400).json({ error: '無効な位置情報です' });
        }
        console.log(`位置情報更新 - userId: ${req.user.id}, lat: ${latitude}, lng: ${longitude}, areaId: ${areaId}`);
        const location = await index_1.prisma.location.create({
            data: {
                userId: req.user.id,
                latitude,
                longitude,
                areaId: areaId || null
            }
        });
        console.log(`位置情報保存完了 - locationId: ${location.id}`);
        let isInArea = false;
        if (areaId) {
            const area = await index_1.prisma.area.findUnique({
                where: { id: areaId }
            });
            if (area) {
                const coords = area.coordinates;
                if (coords && Array.isArray(coords) && coords.length >= 3) {
                    isInArea = true;
                }
            }
        }
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
        return res.status(200).json({
            success: true,
            message: '位置情報が更新されました',
            areaId: areaId || null,
            isInArea
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
        console.log(`友達ID一覧: ${JSON.stringify(friendIds)}`);
        const locations = await index_1.prisma.location.findMany({
            where: {
                userId: { in: friendIds }
            },
            orderBy: { createdAt: 'desc' },
            distinct: ['userId']
        });
        console.log(`取得した位置情報数: ${locations.length}`);
        locations.forEach(loc => {
            console.log(`位置情報 - userId: ${loc.userId}, lat: ${loc.latitude}, lng: ${loc.longitude}, areaId: ${loc.areaId}`);
        });
        const friendsWithLocations = friends
            .map(friend => {
            const location = locations.find(loc => loc.userId === friend.friend.id);
            if (!location) {
                console.log(`友達の位置情報がありません - userId: ${friend.friend.id}, name: ${friend.friend.name}`);
                return {
                    userId: friend.friend.id,
                    latitude: null,
                    longitude: null,
                    accuracy: null,
                    timestamp: new Date().toISOString(),
                    areaId: null,
                    userName: friend.friend.name,
                    profileImage: friend.friend.profileImage
                };
            }
            if (location.latitude === 0 && location.longitude === 0) {
                console.log(`友達の位置情報が無効です (0,0) - userId: ${friend.friend.id}, name: ${friend.friend.name}`);
                return {
                    userId: friend.friend.id,
                    latitude: null,
                    longitude: null,
                    accuracy: null,
                    timestamp: new Date().toISOString(),
                    areaId: null,
                    userName: friend.friend.name,
                    profileImage: friend.friend.profileImage
                };
            }
            return {
                userId: friend.friend.id,
                latitude: location.latitude,
                longitude: location.longitude,
                accuracy: 10.0,
                timestamp: location.createdAt.toISOString(),
                areaId: location.areaId || null,
                userName: friend.friend.name,
                profileImage: friend.friend.profileImage
            };
        });
        console.log('友達位置情報レスポンス:', JSON.stringify(friendsWithLocations, null, 2));
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
router.get('/sharing', async (req, res) => {
    try {
        const settings = {
            enabled: true,
            friends: [],
            lastUpdated: new Date().toISOString()
        };
        return res.json(settings);
    }
    catch (error) {
        console.error('Get location sharing settings error:', error);
        return res.status(500).json({ error: '位置共有設定の取得に失敗しました' });
    }
});
router.put('/sharing', async (req, res) => {
    try {
        const { enabled, friends } = req.body;
        console.log('Location sharing settings update request:', { enabled, friends });
        const settings = {
            enabled: enabled !== undefined ? enabled : true,
            friends: Array.isArray(friends) ? friends : [],
            lastUpdated: new Date().toISOString()
        };
        console.log('Location sharing settings response:', settings);
        return res.json(settings);
    }
    catch (error) {
        console.error('Update location sharing settings error:', error);
        return res.status(500).json({ error: '位置共有設定の更新に失敗しました' });
    }
});
exports.default = router;
