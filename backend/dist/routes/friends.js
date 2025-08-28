"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const index_1 = require("../index");
const router = (0, express_1.Router)();
const sendFriendRequestSchema = zod_1.z.object({
    friendId: zod_1.z.string().min(1, 'Friend ID is required')
});
const respondToFriendRequestSchema = zod_1.z.object({
    accept: zod_1.z.boolean()
});
const sendAreaRequestSchema = zod_1.z.object({
    receiverId: zod_1.z.string().min(1, 'Receiver ID is required'),
    areaId: zod_1.z.string().min(1, 'Area ID is required')
});
router.get('/', async (req, res) => {
    try {
        const friends = await index_1.prisma.friend.findMany({
            where: { userId: req.user.id },
            include: {
                friend: {
                    select: {
                        id: true,
                        name: true,
                        areaId: true
                    }
                }
            }
        });
        const apiFriends = friends.map(friend => ({
            id: friend.id,
            userId: friend.userId,
            friendId: friend.friendId,
            createdAt: friend.createdAt
        }));
        res.json(apiFriends);
    }
    catch (error) {
        console.error('Get friends error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/requests', async (req, res) => {
    try {
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
                        areaId: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        const apiRequests = requests.map(request => ({
            id: request.id,
            fromUserId: request.senderId,
            toUserId: request.receiverId,
            status: request.status.toLowerCase(),
            createdAt: request.createdAt
        }));
        res.json(apiRequests);
    }
    catch (error) {
        console.error('Get friend requests error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/request', async (req, res) => {
    try {
        const { friendId } = sendFriendRequestSchema.parse(req.body);
        const existingFriend = await index_1.prisma.friend.findFirst({
            where: {
                OR: [
                    { userId: req.user.id, friendId: friendId },
                    { userId: friendId, friendId: req.user.id }
                ]
            }
        });
        if (existingFriend) {
            return res.status(400).json({ error: 'Already friends' });
        }
        const existingRequest = await index_1.prisma.friendRequest.findFirst({
            where: {
                OR: [
                    { senderId: req.user.id, receiverId: friendId },
                    { senderId: friendId, receiverId: req.user.id }
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
                receiverId: friendId
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
                    recipientId: friendId,
                    senderId: req.user.id
                }
            });
        }
        catch (notificationError) {
            console.error('Failed to create notification:', notificationError);
        }
        return res.status(201).json({
            message: 'Friend request sent successfully',
            request
        });
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
router.put('/request/:requestId', async (req, res) => {
    try {
        const { requestId } = req.params;
        const { accept } = respondToFriendRequestSchema.parse(req.body);
        const request = await index_1.prisma.friendRequest.findFirst({
            where: {
                id: requestId,
                receiverId: req.user.id,
                status: 'PENDING'
            }
        });
        if (!request) {
            return res.status(404).json({ error: 'Friend request not found' });
        }
        const status = accept ? 'ACCEPTED' : 'REJECTED';
        await index_1.prisma.friendRequest.update({
            where: { id: requestId },
            data: { status }
        });
        if (accept) {
            await index_1.prisma.friend.create({
                data: {
                    userId: request.senderId,
                    friendId: request.receiverId
                }
            });
        }
        return res.json({
            message: `Friend request ${status.toLowerCase()} successfully`
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
        const { accept } = respondToFriendRequestSchema.parse(req.body);
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
        const status = accept ? 'ACCEPTED' : 'REJECTED';
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
exports.default = router;
