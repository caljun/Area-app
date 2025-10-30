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
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📍 HTTP API: 位置情報更新受信');
        console.log(`👤 userId: ${req.user.id}`);
        console.log(`🗺️  位置: (${latitude}, ${longitude})`);
        console.log(`📏 精度: ${accuracy || 'N/A'}m`);
        console.log(`🏠 エリアID: ${areaId || 'なし'}`);
        console.log(`⏰ 時刻: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`);
        const [location] = await index_1.prisma.$transaction([
            index_1.prisma.location.create({
                data: {
                    userId: req.user.id,
                    latitude,
                    longitude,
                    areaId: areaId || null
                }
            }),
            index_1.prisma.user.update({
                where: { id: req.user.id },
                data: { updatedAt: new Date() }
            })
        ]);
        console.log(`✅ 位置情報保存完了 - locationId: ${location.id}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        const user = await index_1.prisma.user.findUnique({ where: { id: req.user.id }, select: { areaId: true } });
        const serverAreaId = user?.areaId || null;
        const isInArea = !!serverAreaId && !!areaId && serverAreaId === areaId;
        if (!isInArea) {
            console.log(`🚫 HTTP API: エリア外またはエリア不一致のため更新を無視 user.areaId=${serverAreaId}, body.areaId=${areaId || 'null'}`);
            return res.status(403).json({ success: false, message: 'Outside joined area', areaId: serverAreaId, isInArea: false });
        }
        try {
            const roomName = `area_${serverAreaId}`;
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
                areaId: serverAreaId,
                timestamp: new Date().getTime()
            };
            index_1.io.to(roomName).emit('location', { type: 'location', data: locationUpdateData });
            console.log(`🌐 WebSocket通知送信: エリアbroadcast room=${roomName}`);
        }
        catch (notificationError) {
            console.error('Failed to send location update via WebSocket:', notificationError);
        }
        return res.status(200).json({
            success: true,
            message: '位置情報が更新されました',
            areaId: serverAreaId,
            isInArea: true
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
        const me = await index_1.prisma.user.findUnique({ where: { id: req.user.id }, select: { areaId: true } });
        const currentAreaId = me?.areaId || null;
        if (!currentAreaId) {
            console.log('🚫 友達位置情報: エリア外のため返却ゼロ');
            return res.json([]);
        }
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
        const friendIdsSet = new Set();
        friends.forEach(friend => {
            if (friend.userId === req.user.id && friend.friend) {
                friendIdsSet.add(friend.friend.id);
            }
            else if (friend.friendId === req.user.id && friend.user) {
                friendIdsSet.add(friend.user.id);
            }
        });
        const friendIds = Array.from(friendIdsSet);
        console.log(`友達ID一覧（重複排除後）: ${JSON.stringify(friendIds)}`);
        const validSince = new Date(Date.now() - 30 * 60 * 1000);
        const latestLocationList = await Promise.all(friendIds.map(async (fid) => {
            return index_1.prisma.location.findFirst({
                where: {
                    userId: fid,
                    areaId: currentAreaId,
                    createdAt: { gte: validSince }
                },
                orderBy: { createdAt: 'desc' }
            });
        }));
        const userIdToLatestLocation = new Map();
        latestLocationList.forEach((loc) => {
            if (loc) {
                userIdToLatestLocation.set(loc.userId, loc);
            }
        });
        console.log(`取得した位置情報数: ${userIdToLatestLocation.size} (30分以内の有効データ)`);
        userIdToLatestLocation.forEach((loc) => {
            const timeAgo = Math.round((Date.now() - loc.createdAt.getTime()) / 1000 / 60);
            console.log(`位置情報 - userId: ${loc.userId}, lat: ${loc.latitude}, lng: ${loc.longitude}, areaId: ${loc.areaId}, ${timeAgo}分前`);
        });
        const friendsWithLocationsMap = new Map();
        friends.forEach(friend => {
            const friendId = friend.userId === req.user.id ? friend.friend.id : friend.user.id;
            const friendName = friend.userId === req.user.id ? friend.friend.name : friend.user.name;
            const friendProfileImage = friend.userId === req.user.id ? friend.friend.profileImage : friend.user.profileImage;
            if (friendsWithLocationsMap.has(friendId)) {
                return;
            }
            const location = userIdToLatestLocation.get(friendId);
            if (!location) {
                console.log(`友達の位置情報がありません - userId: ${friendId}, name: ${friendName}`);
                friendsWithLocationsMap.set(friendId, {
                    userId: friendId,
                    latitude: null,
                    longitude: null,
                    accuracy: null,
                    timestamp: new Date().toISOString(),
                    areaId: null,
                    userName: friendName,
                    profileImage: friendProfileImage
                });
                return;
            }
            if (location.latitude === 0 && location.longitude === 0) {
                console.log(`友達の位置情報が無効です (0,0) - userId: ${friendId}, name: ${friendName}`);
                friendsWithLocationsMap.set(friendId, {
                    userId: friendId,
                    latitude: null,
                    longitude: null,
                    accuracy: null,
                    timestamp: new Date().toISOString(),
                    areaId: null,
                    userName: friendName,
                    profileImage: friendProfileImage
                });
                return;
            }
            friendsWithLocationsMap.set(friendId, {
                userId: friendId,
                latitude: location.latitude,
                longitude: location.longitude,
                accuracy: 10.0,
                timestamp: location.createdAt.toISOString(),
                areaId: currentAreaId,
                userName: friendName,
                profileImage: friendProfileImage
            });
        });
        const friendsWithLocations = Array.from(friendsWithLocationsMap.values());
        console.log(`友達位置情報レスポンス（重複排除後）: ${friendsWithLocations.length}件`);
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
