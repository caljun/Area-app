"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const index_1 = require("../index");
const router = (0, express_1.Router)();
const sendFriendRequestSchema = zod_1.z.object({
    toUserId: zod_1.z.string().min(1, 'User ID is required'),
    message: zod_1.z.string().optional()
});
const respondToFriendRequestSchema = zod_1.z.object({
    action: zod_1.z.string().min(1, 'Action is required')
});
const sendAreaRequestSchema = zod_1.z.object({
    receiverId: zod_1.z.string().min(1, 'Receiver ID is required'),
    areaId: zod_1.z.string().min(1, 'Area ID is required')
});
router.get('/', async (req, res) => {
    try {
        console.log(`友達一覧取得開始 - userId: ${req.user.id}`);
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
                        areaId: true,
                        profileImage: true,
                        createdAt: true,
                        updatedAt: true
                    }
                },
                friend: {
                    select: {
                        id: true,
                        name: true,
                        areaId: true,
                        profileImage: true,
                        createdAt: true,
                        updatedAt: true
                    }
                }
            }
        });
        const apiFriends = friends.map(friend => {
            const currentUserId = req.user.id;
            const friendUser = friend.userId === currentUserId ? friend.friend : friend.user;
            return {
                id: friend.id,
                userId: friend.userId,
                friendId: friend.friendId,
                status: 'accepted',
                createdAt: friend.createdAt,
                updatedAt: friend.createdAt,
                friend: friendUser
            };
        });
        const uniqueFriends = new Map();
        apiFriends.forEach(friend => {
            if (friend.friend && !uniqueFriends.has(friend.friend.id)) {
                uniqueFriends.set(friend.friend.id, friend);
            }
        });
        const finalFriends = Array.from(uniqueFriends.values());
        console.log(`友達取得完了: ${finalFriends.length}人 (元々: ${apiFriends.length}件)`);
        const shouldWrap = String(req.query.wrap).toLowerCase() === 'true';
        if (shouldWrap) {
            return res.json({ friends: finalFriends });
        }
        return res.json(finalFriends);
    }
    catch (error) {
        console.error('Get friends error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/requests', async (req, res) => {
    try {
        console.log(`友達申請一覧取得開始 - userId: ${req.user.id}`);
        const requests = await index_1.prisma.friendRequest.findMany({
            where: {
                receiverId: req.user.id,
                status: 'PENDING'
            },
            include: {
                sender: {
                    select: {
                        id: true,
                        name: true,
                        areaId: true,
                        profileImage: true,
                        createdAt: true,
                        updatedAt: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        console.log(`友達申請一覧取得完了 - 申請数: ${requests.length}`);
        const apiRequests = requests.map(request => {
            const apiRequest = {
                id: request.id,
                fromUserId: request.senderId,
                toUserId: request.receiverId,
                status: request.status.toLowerCase(),
                createdAt: request.createdAt,
                fromUser: request.sender ? {
                    id: request.sender.id,
                    name: request.sender.name,
                    areaId: request.sender.areaId,
                    profileImage: request.sender.profileImage,
                    createdAt: request.sender.createdAt,
                    updatedAt: request.sender.updatedAt
                } : undefined
            };
            console.log(`友達申請レスポンス: id=${apiRequest.id}, fromUser=${apiRequest.fromUser?.name || 'undefined'}`);
            return apiRequest;
        });
        res.json(apiRequests);
    }
    catch (error) {
        console.error('Get friend requests error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/:friendId', async (req, res) => {
    try {
        const { friendId } = req.params;
        if (!friendId || friendId === 'requests' || !/^[0-9a-fA-F]{24}$/.test(friendId)) {
            console.log(`無効な友達ID: ${friendId}`);
            return res.status(400).json({ error: 'Invalid friend ID' });
        }
        const friendship = await index_1.prisma.friend.findFirst({
            where: {
                OR: [
                    { userId: req.user.id, friendId: friendId },
                    { userId: friendId, friendId: req.user.id }
                ]
            },
            include: {
                friend: {
                    select: {
                        id: true,
                        name: true,
                        areaId: true,
                        profileImage: true,
                        createdAt: true,
                        updatedAt: true
                    }
                }
            }
        });
        if (!friendship) {
            return res.status(404).json({ error: 'Friend not found or not friends' });
        }
        const friendProfile = {
            id: friendship.friend.id,
            name: friendship.friend.name,
            areaId: friendship.friend.areaId,
            profileImage: friendship.friend.profileImage,
            createdAt: friendship.friend.createdAt,
            updatedAt: friendship.friend.updatedAt
        };
        return res.json(friendProfile);
    }
    catch (error) {
        console.error('Get friend profile error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/requests', async (req, res) => {
    try {
        const { toUserId, message } = sendFriendRequestSchema.parse(req.body);
        const resolveReceiver = async (identifier) => {
            const isObjectId = /^[0-9a-fA-F]{24}$/.test(identifier);
            if (isObjectId) {
                const byId = await index_1.prisma.user.findUnique({ where: { id: identifier } });
                if (byId)
                    return byId;
            }
            const byDisplayId = await index_1.prisma.user.findUnique({ where: { displayId: identifier } });
            return byDisplayId;
        };
        const receiver = await resolveReceiver(toUserId);
        if (!receiver) {
            return res.status(404).json({ error: 'User not found' });
        }
        if (receiver.id === req.user.id) {
            return res.status(400).json({ error: 'Cannot send friend request to yourself' });
        }
        const existingFriend = await index_1.prisma.friend.findFirst({
            where: {
                OR: [
                    { userId: req.user.id, friendId: receiver.id },
                    { userId: receiver.id, friendId: req.user.id }
                ]
            }
        });
        if (existingFriend) {
            return res.status(400).json({ error: 'Already friends' });
        }
        const existingRequest = await index_1.prisma.friendRequest.findFirst({
            where: {
                OR: [
                    { senderId: req.user.id, receiverId: receiver.id },
                    { senderId: receiver.id, receiverId: req.user.id }
                ],
                status: 'PENDING'
            }
        });
        if (existingRequest) {
            return res.status(400).json({ error: 'Friend request already exists' });
        }
        const request = await index_1.prisma.friendRequest.create({
            data: {
                senderId: req.user.id,
                receiverId: receiver.id
            },
            include: {
                receiver: {
                    select: {
                        id: true,
                        name: true,
                        areaId: true
                    }
                }
            }
        });
        try {
            await index_1.prisma.notification.create({
                data: {
                    type: 'FRIEND_REQUEST',
                    title: '友達申請',
                    message: `${req.user.name}さんから友達申請が届いています`,
                    data: {
                        requestId: request.id,
                        senderId: req.user.id,
                        senderName: req.user.name,
                        senderAreaId: req.user.areaId
                    },
                    recipientId: receiver.id,
                    senderId: req.user.id
                }
            });
        }
        catch (notificationError) {
            console.error('Failed to create notification:', notificationError);
        }
        try {
            const receiverSocket = Array.from(index_1.io.sockets.sockets.values())
                .find(socket => socket.data.userId === receiver.id);
            if (receiverSocket) {
                receiverSocket.emit('friend_request', {
                    type: 'friend_request',
                    requestId: request.id,
                    senderId: req.user.id,
                    senderName: req.user.name || 'Unknown',
                    message: `${req.user.name}さんから友達申請が届いています`
                });
                console.log(`友達申請WebSocket通知送信成功 - 受信者: ${receiver.name}, 送信者: ${req.user.name}`);
            }
            else {
                console.log(`受信者のWebSocket接続が見つかりません - 受信者: ${receiver.name}`);
            }
        }
        catch (websocketError) {
            console.error('友達申請WebSocket通知送信エラー:', websocketError);
        }
        const apiRequest = {
            id: request.id,
            fromUserId: request.senderId,
            toUserId: request.receiverId,
            message: undefined,
            createdAt: request.createdAt,
            status: request.status.toLowerCase(),
        };
        return res.status(201).json(apiRequest);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                error: 'Validation error',
                details: error.errors
            });
        }
        console.error('Send friend request error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
router.patch('/requests/:requestId', async (req, res) => {
    try {
        const { requestId } = req.params;
        const { action } = respondToFriendRequestSchema.parse(req.body);
        console.log(`友達申請応答開始 - requestId: ${requestId}, action: ${action}, userId: ${req.user.id}`);
        const request = await index_1.prisma.friendRequest.findFirst({
            where: {
                id: requestId,
                receiverId: req.user.id,
                status: 'PENDING'
            }
        });
        if (!request) {
            console.log(`友達申請が見つからない - requestId: ${requestId}`);
            return res.status(404).json({ error: 'Friend request not found' });
        }
        console.log(`友達申請取得成功 - senderId: ${request.senderId}, receiverId: ${request.receiverId}`);
        const status = action === 'accept' ? 'ACCEPTED' : 'REJECTED';
        await index_1.prisma.friendRequest.update({
            where: { id: requestId },
            data: { status }
        });
        console.log(`友達申請ステータス更新完了 - status: ${status}`);
        if (action === 'accept') {
            const senderId = request.senderId;
            const receiverId = request.receiverId;
            console.log(`友達関係作成開始 - senderId: ${senderId}, receiverId: ${receiverId}`);
            const existingFriendship = await index_1.prisma.friend.findFirst({
                where: {
                    OR: [
                        { userId: senderId, friendId: receiverId },
                        { userId: receiverId, friendId: senderId }
                    ]
                }
            });
            if (existingFriendship) {
                console.log(`既に友達関係が存在 - friendshipId: ${existingFriendship.id}`);
                return res.status(400).json({ error: 'Already friends' });
            }
            const created = await index_1.prisma.$transaction(async (tx) => {
                const existingAtoB = await tx.friend.findFirst({
                    where: { userId: senderId, friendId: receiverId }
                });
                const existingBtoA = await tx.friend.findFirst({
                    where: { userId: receiverId, friendId: senderId }
                });
                let aToB, bToA;
                if (!existingAtoB) {
                    aToB = await tx.friend.create({
                        data: { userId: senderId, friendId: receiverId }
                    });
                    console.log(`友達関係作成(A→B) - id: ${aToB.id}`);
                }
                else {
                    aToB = existingAtoB;
                    console.log(`友達関係(A→B)は既存 - id: ${aToB.id}`);
                }
                if (!existingBtoA) {
                    bToA = await tx.friend.create({
                        data: { userId: receiverId, friendId: senderId }
                    });
                    console.log(`友達関係作成(B→A) - id: ${bToA.id}`);
                }
                else {
                    bToA = existingBtoA;
                    console.log(`友達関係(B→A)は既存 - id: ${bToA.id}`);
                }
                return { aToB, bToA };
            });
            console.log(`友達関係作成完了 - aToB: ${created.aToB.id}, bToA: ${created.bToA.id}`);
            try {
                await index_1.prisma.notification.create({
                    data: {
                        type: 'FRIEND_REQUEST',
                        title: '友達申請が承認されました',
                        message: `${req.user.name}さんが友達申請を承認しました`,
                        data: {
                            requestId: request.id,
                            senderId: req.user.id,
                            senderName: req.user.name,
                            senderAreaId: req.user.areaId
                        },
                        recipientId: senderId,
                        senderId: req.user.id
                    }
                });
            }
            catch (notificationError) {
                console.error('Failed to create friend acceptance notification:', notificationError);
            }
            const friendUser = await index_1.prisma.user.findUnique({
                where: { id: senderId },
                select: {
                    id: true,
                    name: true,
                    areaId: true,
                    profileImage: true,
                    createdAt: true,
                    updatedAt: true
                }
            });
            console.log(`友達ユーザー情報取得 - name: ${friendUser?.name || 'null'}`);
            const apiResponse = {
                id: created.bToA.id,
                userId: created.bToA.userId,
                friendId: created.bToA.friendId,
                status: 'accepted',
                createdAt: created.bToA.createdAt,
                updatedAt: created.bToA.createdAt,
                friend: friendUser
            };
            console.log(`友達申請承認レスポンス送信 - friendId: ${apiResponse.friendId}, friendName: ${friendUser?.name}`);
            return res.json(apiResponse);
        }
        console.log(`友達申請拒否レスポンス送信 - status: ${status}`);
        return res.json({
            message: `Friend request ${status.toLowerCase()} successfully`,
            success: true
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                error: 'Validation error',
                details: error.errors
            });
        }
        console.error('Respond to friend request error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/area-requests', async (req, res) => {
    try {
        const requests = await index_1.prisma.areaRequest.findMany({
            where: {
                receiverId: req.user.id,
                status: 'PENDING'
            },
            include: {
                sender: {
                    select: {
                        id: true,
                        name: true,
                        areaId: true
                    }
                },
                area: {
                    select: {
                        id: true,
                        name: true,
                        coordinates: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        return res.json({ requests });
    }
    catch (error) {
        console.error('Get area requests error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/area-request', async (req, res) => {
    try {
        const { receiverId, areaId } = sendAreaRequestSchema.parse(req.body);
        const friendship = await index_1.prisma.friend.findFirst({
            where: {
                OR: [
                    { userId: req.user.id, friendId: receiverId },
                    { userId: receiverId, friendId: req.user.id }
                ]
            }
        });
        if (!friendship) {
            return res.status(400).json({ error: 'Can only share areas with friends' });
        }
        const area = await index_1.prisma.area.findFirst({
            where: {
                id: areaId,
                userId: req.user.id
            }
        });
        if (!area) {
            return res.status(404).json({ error: 'Area not found' });
        }
        const existingRequest = await index_1.prisma.areaRequest.findFirst({
            where: {
                senderId: req.user.id,
                receiverId,
                areaId,
                status: 'PENDING'
            }
        });
        if (existingRequest) {
            return res.status(400).json({ error: 'Area request already exists' });
        }
        const request = await index_1.prisma.areaRequest.create({
            data: {
                senderId: req.user.id,
                receiverId,
                areaId
            },
            include: {
                receiver: {
                    select: {
                        id: true,
                        name: true,
                        areaId: true
                    }
                },
                area: {
                    select: {
                        id: true,
                        name: true,
                        coordinates: true
                    }
                }
            }
        });
        try {
            await index_1.prisma.notification.create({
                data: {
                    type: 'AREA_INVITE',
                    title: 'エリア招待',
                    message: `${req.user.name}さんが「${area.name}」エリアに招待しています`,
                    data: {
                        requestId: request.id,
                        areaId: area.id,
                        areaName: area.name,
                        senderId: req.user.id,
                        senderName: req.user.name,
                        senderAreaId: req.user.areaId
                    },
                    recipientId: receiverId,
                    senderId: req.user.id
                }
            });
        }
        catch (notificationError) {
            console.error('Failed to create notification:', notificationError);
        }
        return res.status(201).json({
            message: 'Area request sent successfully',
            request
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                error: '入力内容に問題があります',
                details: error.errors
            });
        }
        console.error('Send area request error:', error);
        return res.status(500).json({ error: 'エリアリクエストの送信に失敗しました' });
    }
});
router.put('/area-request/:requestId', async (req, res) => {
    try {
        const { requestId } = req.params;
        const { action } = respondToFriendRequestSchema.parse(req.body);
        const request = await index_1.prisma.areaRequest.findFirst({
            where: {
                id: requestId,
                receiverId: req.user.id,
                status: 'PENDING'
            }
        });
        if (!request) {
            return res.status(404).json({ error: 'Area request not found' });
        }
        const status = action === 'accept' ? 'ACCEPTED' : 'REJECTED';
        await index_1.prisma.areaRequest.update({
            where: { id: requestId },
            data: { status }
        });
        return res.json({
            message: `Area request ${status.toLowerCase()} successfully`
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                error: 'Validation error',
                details: error.errors
            });
        }
        console.error('Respond to area request error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/search', async (req, res) => {
    try {
        const { query, type = 'displayId' } = req.query;
        if (!query) {
            return res.status(400).json({ error: 'Search query is required' });
        }
        let users;
        if (type === 'displayId') {
            users = await index_1.prisma.user.findMany({
                where: {
                    displayId: {
                        contains: query,
                        mode: 'insensitive'
                    },
                    id: {
                        not: req.user.id
                    }
                },
                select: {
                    id: true,
                    displayId: true,
                    name: true,
                    profileImage: true,
                    createdAt: true
                },
                take: 10
            });
        }
        else {
            users = await index_1.prisma.user.findMany({
                where: {
                    name: {
                        contains: query,
                        mode: 'insensitive'
                    },
                    id: {
                        not: req.user.id
                    }
                },
                select: {
                    id: true,
                    displayId: true,
                    name: true,
                    profileImage: true,
                    createdAt: true
                },
                take: 10
            });
        }
        const userIds = users.map(user => user.id);
        const friendships = await index_1.prisma.friend.findMany({
            where: {
                OR: [
                    { userId: req.user.id, friendId: { in: userIds } },
                    { friendId: req.user.id, userId: { in: userIds } }
                ]
            }
        });
        const friendIds = new Set();
        friendships.forEach(friendship => {
            if (friendship.userId === req.user.id) {
                friendIds.add(friendship.friendId);
            }
            else {
                friendIds.add(friendship.userId);
            }
        });
        const results = users.map(user => ({
            ...user,
            isFriend: friendIds.has(user.id)
        }));
        return res.json(results);
    }
    catch (error) {
        console.error('Search friends error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/online', async (req, res) => {
    try {
        const friends = await index_1.prisma.friend.findMany({
            where: { userId: req.user.id },
            include: {
                friend: {
                    select: {
                        id: true,
                        name: true,
                        areaId: true,
                        profileImage: true,
                        updatedAt: true
                    }
                }
            }
        });
        const onlineFriends = friends.map(friend => ({
            id: friend.friend.id,
            name: friend.friend.name,
            areaId: friend.friend.areaId,
            profileImage: friend.friend.profileImage,
            isOnline: new Date().getTime() - friend.friend.updatedAt.getTime() < 5 * 60 * 1000,
            lastSeen: friend.friend.updatedAt
        }));
        res.json({ friends: onlineFriends });
    }
    catch (error) {
        console.error('Get online friends error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.delete('/requests/:requestId', async (req, res) => {
    try {
        const { requestId } = req.params;
        const request = await index_1.prisma.friendRequest.findFirst({
            where: {
                id: requestId,
                senderId: req.user.id,
                status: 'PENDING'
            }
        });
        if (!request) {
            return res.status(404).json({ error: 'Friend request not found' });
        }
        await index_1.prisma.friendRequest.delete({
            where: { id: requestId }
        });
        return res.status(204).send();
    }
    catch (error) {
        console.error('Cancel friend request error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
router.delete('/:friendId', async (req, res) => {
    try {
        const { friendId } = req.params;
        const currentUserId = req.user.id;
        console.log(`友達削除開始 - userId: ${currentUserId}, friendId: ${friendId}`);
        const friendships = await index_1.prisma.friend.findMany({
            where: {
                OR: [
                    { userId: currentUserId, friendId: friendId },
                    { userId: friendId, friendId: currentUserId }
                ]
            }
        });
        if (friendships.length === 0) {
            return res.status(404).json({ error: 'Friendship not found' });
        }
        await index_1.prisma.$transaction(async (tx) => {
            await tx.friend.deleteMany({
                where: {
                    OR: [
                        { userId: currentUserId, friendId: friendId },
                        { userId: friendId, friendId: currentUserId }
                    ]
                }
            });
            await tx.areaMember.deleteMany({
                where: {
                    OR: [
                        { userId: currentUserId, area: { userId: friendId } },
                        { userId: friendId, area: { userId: currentUserId } }
                    ]
                }
            });
            await tx.areaInvitation.deleteMany({
                where: {
                    OR: [
                        { invitedUserId: currentUserId, invitedBy: friendId },
                        { invitedUserId: friendId, invitedBy: currentUserId }
                    ]
                }
            });
            await tx.friendRequest.deleteMany({
                where: {
                    OR: [
                        { senderId: currentUserId, receiverId: friendId },
                        { senderId: friendId, receiverId: currentUserId }
                    ]
                }
            });
            await tx.notification.deleteMany({
                where: {
                    OR: [
                        { senderId: currentUserId, recipientId: friendId },
                        { senderId: friendId, recipientId: currentUserId }
                    ],
                    type: {
                        in: ['FRIEND_REQUEST', 'AREA_INVITE']
                    }
                }
            });
        });
        console.log(`友達削除完了 - userId: ${currentUserId}, friendId: ${friendId}`);
        console.log(`削除内容: 友達関係、エリアメンバーシップ、エリア招待、友達申請、通知`);
        return res.status(204).send();
    }
    catch (error) {
        console.error('Remove friend error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
