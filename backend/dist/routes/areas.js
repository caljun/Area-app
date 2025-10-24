"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const index_1 = require("../index");
const router = (0, express_1.Router)();
const createAreaSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Area name is required'),
    coordinates: zod_1.z.array(zod_1.z.object({
        latitude: zod_1.z.number(),
        longitude: zod_1.z.number()
    })).min(3, 'At least 3 coordinates are required'),
    isPublic: zod_1.z.boolean().optional()
});
const updateAreaSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Area name is required').optional(),
    coordinates: zod_1.z.array(zod_1.z.object({
        latitude: zod_1.z.number(),
        longitude: zod_1.z.number()
    })).min(3, 'At least 3 coordinates are required').optional(),
    isPublic: zod_1.z.boolean().optional()
});
router.get('/', async (req, res) => {
    try {
        const ownedAreas = await index_1.prisma.area.findMany({
            where: {
                userId: req.user.id,
                isDeleted: false
            },
            orderBy: { createdAt: 'desc' }
        });
        const memberAreas = await index_1.prisma.areaMember.findMany({
            where: { userId: req.user.id },
            include: {
                area: true
            },
            orderBy: { createdAt: 'desc' }
        });
        const ownedAreaIds = new Set(ownedAreas.map(area => area.id));
        const uniqueMemberAreas = memberAreas
            .filter(member => !ownedAreaIds.has(member.area.id))
            .map(member => member.area);
        const allAreas = [...ownedAreas, ...uniqueMemberAreas];
        const apiAreas = await Promise.all(allAreas.map(async (area) => {
            const memberCount = await index_1.prisma.areaMember.count({
                where: { areaId: area.id }
            });
            const onlineCount = await index_1.prisma.areaMember.count({
                where: {
                    areaId: area.id,
                    user: {
                        updatedAt: {
                            gte: new Date(Date.now() - 5 * 60 * 1000)
                        }
                    }
                }
            });
            return {
                id: area.id,
                name: area.name,
                coordinates: area.coordinates,
                userId: area.userId,
                isPublic: area.isPublic,
                imageUrl: area.imageUrl,
                createdAt: area.createdAt,
                updatedAt: area.updatedAt,
                memberCount,
                onlineCount,
                isOwner: area.userId === req.user.id
            };
        }));
        res.json(apiAreas);
    }
    catch (error) {
        console.error('Get areas error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/public', async (req, res) => {
    try {
        const areas = await index_1.prisma.area.findMany({
            where: {
                isPublic: true,
                isDeleted: false
            },
            orderBy: { createdAt: 'desc' }
        });
        const apiAreas = await Promise.all(areas.map(async (area) => {
            const memberCount = await index_1.prisma.areaMember.count({
                where: { areaId: area.id }
            });
            const onlineCount = await index_1.prisma.areaMember.count({
                where: {
                    areaId: area.id,
                    user: {
                        updatedAt: {
                            gte: new Date(Date.now() - 5 * 60 * 1000)
                        }
                    }
                }
            });
            return {
                id: area.id,
                name: area.name,
                coordinates: area.coordinates,
                userId: area.userId,
                isPublic: area.isPublic,
                imageUrl: area.imageUrl,
                createdAt: area.createdAt,
                updatedAt: area.updatedAt,
                memberCount,
                onlineCount
            };
        }));
        res.json(apiAreas);
    }
    catch (error) {
        console.error('Get public areas error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/created', async (req, res) => {
    try {
        const areas = await index_1.prisma.area.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' }
        });
        const apiAreas = await Promise.all(areas.map(async (area) => {
            const memberCount = await index_1.prisma.areaMember.count({
                where: { areaId: area.id }
            });
            const onlineCount = await index_1.prisma.areaMember.count({
                where: {
                    areaId: area.id,
                    user: {
                        updatedAt: {
                            gte: new Date(Date.now() - 5 * 60 * 1000)
                        }
                    }
                }
            });
            return {
                id: area.id,
                name: area.name,
                coordinates: area.coordinates,
                userId: area.userId,
                isPublic: area.isPublic,
                imageUrl: area.imageUrl,
                createdAt: area.createdAt,
                updatedAt: area.updatedAt,
                memberCount,
                onlineCount,
                isOwner: true
            };
        }));
        return res.json(apiAreas);
    }
    catch (error) {
        console.error('Get created areas error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/joined', async (req, res) => {
    try {
        console.log(`参加エリア一覧取得開始 - userId: ${req.user.id}`);
        const memberships = await index_1.prisma.areaMember.findMany({
            where: { userId: req.user.id },
            include: {
                area: {
                    select: {
                        id: true,
                        name: true,
                        coordinates: true,
                        userId: true,
                        isPublic: true,
                        imageUrl: true,
                        createdAt: true,
                        updatedAt: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        console.log(`参加エリアメンバーシップ取得完了 - 件数: ${memberships.length}`);
        for (const membership of memberships) {
            if (membership.area) {
                console.log(`メンバーシップ詳細 - areaId: ${membership.area.id}, areaName: ${membership.area.name}, areaOwner: ${membership.area.userId}, currentUser: ${req.user.id}, isOwner: ${membership.area.userId === req.user.id}, addedBy: ${membership.addedBy}`);
            }
            else {
                console.log(`メンバーシップ詳細 - areaId: ${membership.areaId}, area: null`);
            }
        }
        const joinedAreas = memberships
            .filter(m => m.area && m.area.userId !== req.user.id)
            .map(m => m.area);
        console.log(`参加エリアフィルタリング完了 - 参加エリア数: ${joinedAreas.length} (作成エリア除外後)`);
        for (const area of joinedAreas) {
            console.log(`参加エリア詳細 - areaId: ${area.id}, areaName: ${area.name}, areaOwner: ${area.userId} (作成者: ${req.user.id})`);
        }
        const apiAreas = await Promise.all(joinedAreas.map(async (area) => {
            const memberCount = await index_1.prisma.areaMember.count({
                where: { areaId: area.id }
            });
            const onlineCount = await index_1.prisma.areaMember.count({
                where: {
                    areaId: area.id,
                    user: {
                        updatedAt: {
                            gte: new Date(Date.now() - 5 * 60 * 1000)
                        }
                    }
                }
            });
            console.log(`参加エリア詳細 - 名前: ${area.name}, ID: ${area.id}, メンバー数: ${memberCount}`);
            return {
                id: area.id,
                name: area.name,
                coordinates: area.coordinates,
                userId: area.userId,
                isPublic: area.isPublic,
                imageUrl: area.imageUrl,
                createdAt: area.createdAt,
                updatedAt: area.updatedAt,
                memberCount,
                onlineCount,
                isOwner: area.userId === req.user.id
            };
        }));
        console.log(`参加エリア一覧取得完了 - エリア数: ${apiAreas.length}`);
        return res.json(apiAreas);
    }
    catch (error) {
        console.error('Get joined areas error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/for-location-sharing', async (req, res) => {
    try {
        console.log(`位置情報共有用エリア一覧取得開始 - userId: ${req.user.id}`);
        const memberships = await index_1.prisma.areaMember.findMany({
            where: { userId: req.user.id },
            include: {
                area: {
                    select: {
                        id: true,
                        name: true,
                        coordinates: true,
                        userId: true,
                        isPublic: true,
                        imageUrl: true,
                        createdAt: true,
                        updatedAt: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        console.log(`位置情報共有用メンバーシップ取得完了 - 件数: ${memberships.length}`);
        const areasForLocationSharing = memberships
            .filter(m => m.area)
            .map(m => m.area);
        console.log(`位置情報共有用エリアフィルタリング完了 - エリア数: ${areasForLocationSharing.length} (作成エリア含む)`);
        const apiAreas = await Promise.all(areasForLocationSharing.map(async (area) => {
            const memberCount = await index_1.prisma.areaMember.count({
                where: { areaId: area.id }
            });
            const onlineCount = await index_1.prisma.areaMember.count({
                where: {
                    areaId: area.id,
                    user: {
                        updatedAt: {
                            gte: new Date(Date.now() - 5 * 60 * 1000)
                        }
                    }
                }
            });
            return {
                id: area.id,
                name: area.name,
                coordinates: area.coordinates,
                userId: area.userId,
                isPublic: area.isPublic,
                imageUrl: area.imageUrl,
                createdAt: area.createdAt,
                updatedAt: area.updatedAt,
                memberCount,
                onlineCount,
                isOwner: area.userId === req.user.id
            };
        }));
        console.log(`位置情報共有用エリア一覧取得完了 - エリア数: ${apiAreas.length}`);
        return res.json(apiAreas);
    }
    catch (error) {
        console.error('Get areas for location sharing error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/invites', async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ error: '認証が必要です' });
        }
        console.log(`エリア招待一覧取得開始 - userId: ${req.user.id}`);
        const invites = await index_1.prisma.areaInvitation.findMany({
            where: {
                invitedUserId: req.user.id,
                status: 'PENDING'
            },
            include: {
                area: {
                    select: {
                        id: true,
                        name: true,
                        coordinates: true,
                        isPublic: true
                    }
                },
                invitedByUser: {
                    select: {
                        id: true,
                        name: true,
                        areaId: true,
                        profileImage: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        console.log(`エリア招待一覧取得完了 - 招待数: ${invites.length}`);
        const apiInvites = invites.map(invite => ({
            id: invite.id,
            areaId: invite.areaId,
            areaName: invite.area.name,
            areaCoordinates: invite.area.coordinates,
            areaIsPublic: invite.area.isPublic,
            fromUserId: invite.invitedBy,
            fromUserName: invite.invitedByUser?.name || 'Unknown',
            fromUserAreaId: invite.invitedByUser?.areaId || 'Unknown',
            fromUserProfileImage: invite.invitedByUser?.profileImage || null,
            toUserId: invite.invitedUserId,
            status: invite.status.toLowerCase(),
            createdAt: invite.createdAt,
            updatedAt: invite.updatedAt
        }));
        console.log(`エリア招待API形式変換完了 - 招待数: ${apiInvites.length}`);
        return res.json({
            invites: apiInvites,
            count: apiInvites.length
        });
    }
    catch (error) {
        console.error('Get area invites error:', error);
        if (error instanceof Error) {
            console.error('Error details:', error.message);
            console.error('Stack trace:', error.stack);
        }
        return res.status(500).json({
            error: 'エリア招待の取得に失敗しました',
            details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
        });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const area = await index_1.prisma.area.findFirst({
            where: {
                id,
                OR: [
                    { userId: req.user.id },
                    { isPublic: true }
                ]
            }
        });
        if (!area) {
            return res.status(404).json({ error: 'Area not found' });
        }
        const apiArea = {
            id: area.id,
            name: area.name,
            coordinates: area.coordinates,
            userId: area.userId,
            isPublic: area.isPublic,
            imageUrl: area.imageUrl,
            createdAt: area.createdAt,
            updatedAt: area.updatedAt
        };
        return res.json(apiArea);
    }
    catch (error) {
        console.error('Get area error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/', async (req, res) => {
    try {
        const { name, coordinates, isPublic = false } = createAreaSchema.parse(req.body);
        const existingCount = await index_1.prisma.area.count({
            where: {
                userId: req.user.id,
                isDeleted: false
            }
        });
        if (existingCount >= 3) {
            return res.status(400).json({ error: '作成できるエリアは最大3件までです' });
        }
        const latitudes = coordinates.map(c => c.latitude);
        const longitudes = coordinates.map(c => c.longitude);
        const centroidLat = latitudes.reduce((a, b) => a + b, 0) / latitudes.length;
        const centroidLng = longitudes.reduce((a, b) => a + b, 0) / longitudes.length;
        const toRad = (deg) => (deg * Math.PI) / 180;
        const earthRadiusM = 6371000;
        const maxRadiusM = coordinates.reduce((max, c) => {
            const dLat = toRad(c.latitude - centroidLat);
            const dLng = toRad(c.longitude - centroidLng);
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(toRad(centroidLat)) * Math.cos(toRad(c.latitude)) *
                    Math.sin(dLng / 2) * Math.sin(dLng / 2);
            const distance = 2 * earthRadiusM * Math.asin(Math.min(1, Math.sqrt(a)));
            return Math.max(max, distance);
        }, 0);
        if (maxRadiusM < 100 || maxRadiusM > 800) {
            return res.status(400).json({ error: 'エリアの半径は100m以上800m以下である必要があります' });
        }
        const result = await index_1.prisma.$transaction(async (tx) => {
            const area = await tx.area.create({
                data: {
                    name,
                    coordinates,
                    isPublic,
                    userId: req.user.id
                }
            });
            await tx.areaMember.create({
                data: {
                    areaId: area.id,
                    userId: req.user.id,
                    addedBy: req.user.id
                }
            });
            return area;
        });
        const apiArea = {
            id: result.id,
            name: result.name,
            coordinates: result.coordinates,
            userId: result.userId,
            isPublic: result.isPublic,
            imageUrl: result.imageUrl,
            createdAt: result.createdAt,
            updatedAt: result.updatedAt
        };
        return res.status(201).json(apiArea);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                error: '入力内容に問題があります',
                details: error.errors
            });
        }
        console.error('Create area error:', error);
        return res.status(500).json({ error: 'エリアの作成に失敗しました' });
    }
});
router.patch('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = updateAreaSchema.parse(req.body);
        const existingArea = await index_1.prisma.area.findFirst({
            where: {
                id,
                userId: req.user.id
            }
        });
        if (!existingArea) {
            return res.status(404).json({ error: 'エリアが見つかりません' });
        }
        const area = await index_1.prisma.area.update({
            where: { id },
            data: updateData
        });
        return res.json({
            message: 'エリアの更新が完了しました',
            area
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                error: '入力内容に問題があります',
                details: error.errors
            });
        }
        console.error('Update area error:', error);
        return res.status(500).json({ error: 'エリアの更新に失敗しました' });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const existingArea = await index_1.prisma.area.findFirst({
            where: {
                id,
                userId: req.user.id
            }
        });
        if (!existingArea) {
            return res.status(404).json({ error: 'Area not found' });
        }
        await index_1.prisma.area.delete({
            where: { id }
        });
        return res.status(204).send();
    }
    catch (error) {
        console.error('Delete area error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/:id/members', async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`エリアメンバー取得リクエスト - areaId: ${id}, userId: ${req.user.id}`);
        const area = await index_1.prisma.area.findFirst({
            where: {
                id,
                OR: [
                    { userId: req.user.id },
                    { isPublic: true },
                    {
                        areaMembers: {
                            some: {
                                userId: req.user.id
                            }
                        }
                    }
                ]
            }
        });
        if (!area) {
            console.log(`エリアアクセス拒否 - areaId: ${id}, userId: ${req.user.id}`);
            return res.status(404).json({ error: 'Area not found' });
        }
        console.log(`エリアアクセス許可 - areaId: ${id}, areaName: ${area.name}, isOwner: ${area.userId === req.user.id}`);
        const members = await index_1.prisma.areaMember.findMany({
            where: { areaId: id },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        displayId: true,
                        profileImage: true,
                        createdAt: true,
                        updatedAt: true
                    }
                }
            },
            orderBy: { createdAt: 'asc' }
        });
        const memberIds = members.map(m => m.user.id);
        const friendships = await index_1.prisma.friend.findMany({
            where: {
                OR: [
                    { userId: req.user.id, friendId: { in: memberIds } },
                    { friendId: req.user.id, userId: { in: memberIds } }
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
        const filteredMembers = members;
        console.log(`エリアメンバー取得: 全${members.length}人（友達: ${friendIds.size}人）`);
        const memberUsers = filteredMembers.map(member => ({
            id: member.user.id,
            name: member.user.name,
            displayId: member.user.displayId,
            profileImage: member.user.profileImage,
            createdAt: member.user.createdAt || new Date(),
            updatedAt: member.user.updatedAt || new Date(),
            isFriend: friendIds.has(member.user.id),
            isCurrentUser: member.user.id === req.user.id
        }));
        return res.json(memberUsers);
    }
    catch (error) {
        console.error('Get area members error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/:id/members', async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }
        const area = await index_1.prisma.area.findFirst({
            where: {
                id,
                userId: req.user.id
            }
        });
        if (!area) {
            return res.status(404).json({ error: 'Area not found or access denied' });
        }
        const friendship = await index_1.prisma.friend.findFirst({
            where: {
                OR: [
                    { userId: req.user.id, friendId: userId },
                    { userId: userId, friendId: req.user.id }
                ]
            }
        });
        if (!friendship) {
            return res.status(400).json({ error: 'Can only add friends to areas' });
        }
        const existingMember = await index_1.prisma.areaMember.findFirst({
            where: {
                areaId: id,
                userId: userId
            }
        });
        if (existingMember) {
            return res.status(400).json({ error: 'User is already a member of this area' });
        }
        const member = await index_1.prisma.areaMember.create({
            data: {
                areaId: id,
                userId: userId,
                addedBy: req.user.id
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        areaId: true,
                        profileImage: true
                    }
                }
            }
        });
        return res.status(201).json({
            message: 'Member added successfully',
            member
        });
    }
    catch (error) {
        console.error('Add area member error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
router.delete('/:id/members/:userId', async (req, res) => {
    try {
        const { id, userId } = req.params;
        const area = await index_1.prisma.area.findFirst({
            where: {
                id,
                userId: req.user.id
            }
        });
        if (!area) {
            return res.status(404).json({ error: 'Area not found or access denied' });
        }
        const member = await index_1.prisma.areaMember.findFirst({
            where: {
                areaId: id,
                userId: userId
            }
        });
        if (!member) {
            return res.status(404).json({ error: 'Member not found' });
        }
        await index_1.prisma.areaMember.delete({
            where: { id: member.id }
        });
        return res.json({ message: 'Member removed successfully' });
    }
    catch (error) {
        console.error('Remove area member error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/memberships', async (req, res) => {
    try {
        const memberships = await index_1.prisma.areaMember.findMany({
            where: { userId: req.user.id },
            include: {
                area: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                areaId: true
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        return res.json({ memberships });
    }
    catch (error) {
        console.error('Get area memberships error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/:id/invite', async (req, res) => {
    try {
        const { id } = req.params;
        const { invitedUserId } = req.body;
        console.log(`エリア招待リクエスト - areaId: ${id}, invitedUserId: ${invitedUserId}, invitedBy: ${req.user.id}`);
        if (!invitedUserId) {
            return res.status(400).json({ error: 'Invited User ID is required' });
        }
        const targetUser = await index_1.prisma.user.findUnique({
            where: { id: invitedUserId },
            select: { id: true, name: true }
        });
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        const userId = targetUser.id;
        const area = await index_1.prisma.area.findFirst({
            where: {
                id,
                userId: req.user.id
            }
        });
        if (!area) {
            console.log(`エリアが見つからないかアクセス拒否 - areaId: ${id}, userId: ${req.user.id}`);
            return res.status(404).json({ error: 'Area not found or access denied' });
        }
        console.log(`エリア確認完了 - areaName: ${area.name}`);
        const friendship = await index_1.prisma.friend.findFirst({
            where: {
                OR: [
                    { userId: req.user.id, friendId: userId },
                    { userId: userId, friendId: req.user.id }
                ]
            }
        });
        if (!friendship) {
            console.log(`友達関係がありません - userId: ${req.user.id}, friendId: ${userId}`);
            return res.status(400).json({ error: 'Can only invite friends to areas' });
        }
        console.log(`友達関係確認完了`);
        const existingMember = await index_1.prisma.areaMember.findFirst({
            where: {
                areaId: id,
                userId: userId
            }
        });
        if (existingMember) {
            console.log(`既にエリアメンバーです - areaId: ${id}, userId: ${userId}`);
            return res.status(400).json({ error: 'User is already a member of this area' });
        }
        const existingInvite = await index_1.prisma.areaInvitation.findFirst({
            where: {
                areaId: id,
                invitedUserId: userId,
                status: {
                    in: ['PENDING', 'REJECTED']
                }
            }
        });
        if (existingInvite) {
            if (existingInvite.status === 'PENDING') {
                console.log(`既に招待済みです - areaId: ${id}, userId: ${userId}, status: PENDING`);
                return res.status(400).json({ error: 'Invitation already sent' });
            }
            else if (existingInvite.status === 'REJECTED') {
                console.log(`以前に拒否された招待があります - areaId: ${id}, userId: ${userId}, status: REJECTED`);
                await index_1.prisma.areaInvitation.delete({
                    where: { id: existingInvite.id }
                });
                console.log(`古い招待を削除しました - invitationId: ${existingInvite.id}`);
            }
        }
        const invitation = await index_1.prisma.areaInvitation.create({
            data: {
                areaId: id,
                invitedUserId: userId,
                invitedBy: req.user.id
            }
        });
        console.log(`エリア招待作成完了 - invitationId: ${invitation.id}`);
        try {
            await index_1.prisma.notification.create({
                data: {
                    type: 'AREA_INVITE',
                    title: 'エリア招待',
                    message: `${req.user.name}さんが「${area.name}」エリアに招待しています`,
                    data: {
                        invitationId: invitation.id,
                        areaId: area.id,
                        areaName: area.name,
                        senderId: req.user.id,
                        senderName: req.user.name
                    },
                    recipientId: userId,
                    senderId: req.user.id
                }
            });
            console.log(`エリア招待通知作成完了`);
        }
        catch (notificationError) {
            console.error('Failed to create area invite notification:', notificationError);
        }
        try {
            const invitedUserSocket = Array.from(index_1.io.sockets.sockets.values())
                .find(socket => socket.data.userId === userId);
            if (invitedUserSocket) {
                invitedUserSocket.emit('area_invite', {
                    type: 'area_invite',
                    invitationId: invitation.id,
                    areaId: area.id,
                    areaName: area.name,
                    senderId: req.user.id,
                    senderName: req.user.name || 'Unknown',
                    message: `${req.user.name}さんがあなたをエリア「${area.name}」に招待しました`
                });
                console.log(`エリア招待WebSocket通知送信完了 - invitedUserId: ${userId}, areaName: ${area.name}`);
            }
            else {
                console.log(`招待ユーザーのWebSocket接続が見つかりません - invitedUserId: ${userId}`);
            }
        }
        catch (websocketError) {
            console.error('エリア招待WebSocket通知送信エラー:', websocketError);
        }
        return res.status(201).json({
            message: 'Invitation sent successfully',
            invitation
        });
    }
    catch (error) {
        console.error('Invite to area error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/:id/join', async (req, res) => {
    try {
        const { id } = req.params;
        const area = await index_1.prisma.area.findFirst({
            where: {
                id,
                isPublic: true
            }
        });
        if (!area) {
            return res.status(404).json({ error: 'Area not found or not public' });
        }
        const existingMember = await index_1.prisma.areaMember.findFirst({
            where: {
                areaId: id,
                userId: req.user.id
            }
        });
        if (existingMember) {
            return res.status(400).json({ error: 'Already a member of this area' });
        }
        const member = await index_1.prisma.areaMember.create({
            data: {
                areaId: id,
                userId: req.user.id,
                addedBy: req.user.id
            }
        });
        return res.status(201).json({
            message: 'Joined area successfully',
            member
        });
    }
    catch (error) {
        console.error('Join area error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
router.delete('/:id/leave', async (req, res) => {
    try {
        const { id } = req.params;
        const member = await index_1.prisma.areaMember.findFirst({
            where: {
                areaId: id,
                userId: req.user.id
            }
        });
        if (!member) {
            return res.status(404).json({ error: 'Not a member of this area' });
        }
        const area = await index_1.prisma.area.findFirst({
            where: { id }
        });
        if (area?.userId === req.user.id) {
            return res.status(400).json({ error: 'Cannot leave area you own' });
        }
        await index_1.prisma.areaMember.delete({
            where: { id: member.id }
        });
        return res.json({ message: 'Left area successfully' });
    }
    catch (error) {
        console.error('Leave area error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/search', async (req, res) => {
    try {
        const { q, lat, lng, radius = 10 } = req.query;
        let whereClause = {};
        if (q) {
            whereClause.name = {
                contains: q,
                mode: 'insensitive'
            };
        }
        if (lat && lng) {
            whereClause.isPublic = true;
        }
        const areas = await index_1.prisma.area.findMany({
            where: whereClause,
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        areaId: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 20
        });
        res.json(areas);
    }
    catch (error) {
        console.error('Search areas error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/nearby', async (req, res) => {
    try {
        const { lat, lng, radius = 10 } = req.query;
        if (!lat || !lng) {
            return res.status(400).json({ error: 'Latitude and longitude are required' });
        }
        const areas = await index_1.prisma.area.findMany({
            where: { isPublic: true },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        areaId: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 20
        });
        const nearbyAreas = areas.filter(area => {
            const coords = area.coordinates;
            if (!coords || !Array.isArray(coords) || coords.length === 0)
                return false;
            const centerLat = coords.reduce((sum, coord) => sum + coord.latitude, 0) / coords.length;
            const centerLng = coords.reduce((sum, coord) => sum + coord.longitude, 0) / coords.length;
            const distance = Math.sqrt(Math.pow(parseFloat(lat) - centerLat, 2) +
                Math.pow(parseFloat(lng) - centerLng, 2)) * 111;
            return distance <= parseFloat(radius);
        });
        res.json(nearbyAreas);
    }
    catch (error) {
        console.error('Get nearby areas error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.patch('/invites/:inviteId', async (req, res) => {
    try {
        const { inviteId } = req.params;
        const { action } = req.body;
        console.log(`エリア招待応答リクエスト - inviteId: ${inviteId}, action: ${action}, userId: ${req.user.id}`);
        console.log(`リクエストボディ全体:`, JSON.stringify(req.body, null, 2));
        console.log(`actionの型: ${typeof action}, 値: "${action}"`);
        if (!action || !['accept', 'reject'].includes(action)) {
            console.log(`無効なアクション: ${action}`);
            return res.status(400).json({ error: 'アクションは "accept" または "reject" である必要があります' });
        }
        const invite = await index_1.prisma.areaInvitation.findFirst({
            where: {
                id: inviteId,
                invitedUserId: req.user.id,
                status: 'PENDING'
            }
        });
        if (!invite) {
            console.log(`エリア招待が見つかりません - inviteId: ${inviteId}, userId: ${req.user.id}`);
            return res.status(404).json({ error: 'エリア招待が見つかりません' });
        }
        console.log(`エリア招待を発見 - areaId: ${invite.areaId}, invitedBy: ${invite.invitedBy}`);
        const status = action === 'accept' ? 'ACCEPTED' : 'REJECTED';
        await index_1.prisma.areaInvitation.update({
            where: { id: inviteId },
            data: {
                status,
                updatedAt: new Date()
            }
        });
        console.log(`エリア招待ステータス更新完了 - status: ${status}`);
        if (action === 'accept') {
            const existingMember = await index_1.prisma.areaMember.findFirst({
                where: {
                    areaId: invite.areaId,
                    userId: req.user.id
                }
            });
            if (existingMember) {
                console.log(`既にエリアメンバーです - areaId: ${invite.areaId}, userId: ${req.user.id}, memberId: ${existingMember.id}`);
            }
            else {
                const newMember = await index_1.prisma.areaMember.create({
                    data: {
                        areaId: invite.areaId,
                        userId: req.user.id,
                        addedBy: invite.invitedBy
                    }
                });
                console.log(`エリアメンバー追加完了 - memberId: ${newMember.id}, areaId: ${invite.areaId}, userId: ${req.user.id}, addedBy: ${invite.invitedBy}`);
                const verifyMember = await index_1.prisma.areaMember.findFirst({
                    where: {
                        areaId: invite.areaId,
                        userId: req.user.id
                    },
                    include: {
                        area: {
                            select: {
                                id: true,
                                name: true,
                                userId: true
                            }
                        }
                    }
                });
                if (verifyMember) {
                    console.log(`エリアメンバー追加確認完了 - エリア名: ${verifyMember.area.name}, エリア所有者: ${verifyMember.area.userId}, メンバー: ${verifyMember.userId}`);
                }
                else {
                    console.error(`エリアメンバー追加確認失敗 - areaId: ${invite.areaId}, userId: ${req.user.id}`);
                }
            }
        }
        return res.json({
            message: `エリア招待を${action === 'accept' ? '承認' : '拒否'}しました`
        });
    }
    catch (error) {
        console.error('Respond to area invite error:', error);
        return res.status(500).json({ error: 'エリア招待への応答に失敗しました' });
    }
});
exports.default = router;
