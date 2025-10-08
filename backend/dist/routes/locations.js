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
        const { userId, latitude, longitude, timestamp } = req.body || {};
        if (!userId || typeof userId !== 'string') {
            return res.status(400).json({ error: 'userId は必須です' });
        }
        if (typeof latitude !== 'number' || typeof longitude !== 'number') {
            return res.status(400).json({ error: 'latitude と longitude は数値で必須です' });
        }
        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            return res.status(400).json({ error: '緯度経度の範囲が不正です' });
        }
        if (latitude === 0 && longitude === 0) {
            return res.status(400).json({ error: '無効な位置情報です' });
        }
        const createdAt = timestamp ? new Date(timestamp) : undefined;
        const location = await index_1.prisma.location.create({
            data: {
                userId,
                latitude,
                longitude,
                ...(createdAt ? { createdAt } : {})
            }
        });
        index_1.io.emit('locationUpdate', {
            userId,
            latitude,
            longitude,
            timestamp: location.createdAt
        });
        return res.status(201).json({
            success: true,
            location: {
                userId: location.userId,
                latitude: location.latitude,
                longitude: location.longitude,
                timestamp: location.createdAt
            }
        });
    }
    catch (error) {
        console.error('POST /location error:', error);
        return res.status(500).json({ error: '位置情報の保存に失敗しました' });
    }
});
router.get('/:userId([a-f0-9]{24})', async (req, res) => {
    try {
        const { userId } = req.params;
        if (!userId) {
            return res.status(400).json({ error: 'userId は必須です' });
        }
        const latest = await index_1.prisma.location.findFirst({
            where: { userId },
            orderBy: { createdAt: 'desc' }
        });
        if (!latest) {
            return res.status(404).json({ error: '位置情報が見つかりません' });
        }
        return res.json({
            userId: latest.userId,
            latitude: latest.latitude,
            longitude: latest.longitude,
            timestamp: latest.createdAt
        });
    }
    catch (error) {
        console.error('GET /location/:userId error:', error);
        return res.status(500).json({ error: '最新位置情報の取得に失敗しました' });
    }
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
                where: {
                    OR: [
                        { userId: req.user.id },
                        { friendId: req.user.id }
                    ]
                },
                include: {
                    user: { select: { id: true, name: true, profileImage: true } },
                    friend: { select: { id: true, name: true, profileImage: true } }
                }
            });
            const friendIds = [];
            friends.forEach(friend => {
                if (friend.userId === req.user.id && friend.friend) {
                    friendIds.push(friend.friend.id);
                }
                else if (friend.friendId === req.user.id && friend.user) {
                    friendIds.push(friend.user.id);
                }
            });
            const user = await index_1.prisma.user.findUnique({
                where: { id: req.user.id },
                select: { id: true, name: true, profileImage: true }
            });
            const locationUpdateData = {
                action: 'friend_location_update',
                userId: req.user.id,
                userName: user?.name || req.user.name,
                profileImage: user?.profileImage,
                latitude,
                longitude,
                areaId: areaId,
                timestamp: new Date().getTime()
            };
            friendIds.forEach(friendId => {
                index_1.io.to(`user_${friendId}`).emit('location', {
                    type: 'location',
                    data: locationUpdateData
                });
            });
            console.log(`Location API: Position update sent to ${friendIds.length} friends via WebSocket`);
        }
        catch (notificationError) {
            console.error('Failed to send location update via WebSocket:', notificationError);
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
            where: {
                OR: [
                    { userId: req.user.id },
                    { friendId: req.user.id }
                ]
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        profileImage: true
                    }
                },
                friend: {
                    select: {
                        id: true,
                        name: true,
                        profileImage: true
                    }
                }
            }
        });
        const friendIds = [];
        friends.forEach(friend => {
            if (friend.userId === req.user.id && friend.friend) {
                friendIds.push(friend.friend.id);
            }
            else if (friend.friendId === req.user.id && friend.user) {
                friendIds.push(friend.user.id);
            }
        });
        console.log(`友達ID一覧: ${JSON.stringify(friendIds)}`);
        const latestLocationList = await Promise.all(friendIds.map(async (fid) => {
            return index_1.prisma.location.findFirst({
                where: { userId: fid },
                orderBy: { createdAt: 'desc' }
            });
        }));
        const userIdToLatestLocation = new Map();
        latestLocationList.forEach((loc) => {
            if (loc) {
                userIdToLatestLocation.set(loc.userId, loc);
            }
        });
        console.log(`取得した位置情報数: ${userIdToLatestLocation.size}`);
        userIdToLatestLocation.forEach((loc) => {
            console.log(`位置情報 - userId: ${loc.userId}, lat: ${loc.latitude}, lng: ${loc.longitude}, areaId: ${loc.areaId}`);
        });
        const friendsWithLocations = friends
            .map(friend => {
            const friendId = friend.userId === req.user.id ? friend.friend.id : friend.user.id;
            const friendName = friend.userId === req.user.id ? friend.friend.name : friend.user.name;
            const friendProfileImage = friend.userId === req.user.id ? friend.friend.profileImage : friend.user.profileImage;
            const location = userIdToLatestLocation.get(friendId);
            if (!location) {
                console.log(`友達の位置情報がありません - userId: ${friendId}, name: ${friendName}`);
                return {
                    userId: friendId,
                    latitude: null,
                    longitude: null,
                    accuracy: null,
                    timestamp: new Date().toISOString(),
                    areaId: null,
                    userName: friendName,
                    profileImage: friendProfileImage
                };
            }
            if (location.latitude === 0 && location.longitude === 0) {
                console.log(`友達の位置情報が無効です (0,0) - userId: ${friendId}, name: ${friendName}`);
                return {
                    userId: friendId,
                    latitude: null,
                    longitude: null,
                    accuracy: null,
                    timestamp: new Date().toISOString(),
                    areaId: null,
                    userName: friendName,
                    profileImage: friendProfileImage
                };
            }
            return {
                userId: friendId,
                latitude: location.latitude,
                longitude: location.longitude,
                accuracy: 10.0,
                timestamp: location.createdAt.toISOString(),
                areaId: location.areaId || null,
                userName: friendName,
                profileImage: friendProfileImage
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
