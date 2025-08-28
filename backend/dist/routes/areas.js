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
        const areas = await index_1.prisma.area.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' }
        });
        const apiAreas = areas.map(area => ({
            id: area.id,
            name: area.name,
            coordinates: area.coordinates,
            userId: area.userId,
            isPublic: area.isPublic,
            imageUrl: area.imageUrl,
            createdAt: area.createdAt,
            updatedAt: area.updatedAt
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
            where: { isPublic: true },
            orderBy: { createdAt: 'desc' }
        });
        const apiAreas = areas.map(area => ({
            id: area.id,
            name: area.name,
            coordinates: area.coordinates,
            userId: area.userId,
            isPublic: area.isPublic,
            imageUrl: area.imageUrl,
            createdAt: area.createdAt,
            updatedAt: area.updatedAt
        }));
        res.json(apiAreas);
    }
    catch (error) {
        console.error('Get public areas error:', error);
        res.status(500).json({ error: 'Internal server error' });
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
router.get('/:id/members', async (req, res) => {
    try {
        const { id } = req.params;
        const members = await index_1.prisma.areaMember.findMany({
            where: { areaId: id },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        areaId: true
                    }
                }
            }
        });
        const memberIds = members.map(member => member.user.id);
        return res.json(memberIds);
    }
    catch (error) {
        console.error('Get area members error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/', async (req, res) => {
    try {
        const { name, coordinates, isPublic = false } = createAreaSchema.parse(req.body);
        const area = await index_1.prisma.area.create({
            data: {
                name,
                coordinates,
                isPublic,
                userId: req.user.id
            }
        });
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
router.put('/:id', async (req, res) => {
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
        const members = await index_1.prisma.areaMember.findMany({
            where: { areaId: id },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        areaId: true,
                        profileImage: true
                    }
                }
            },
            orderBy: { createdAt: 'asc' }
        });
        const memberIds = members.map(member => member.user.id);
        return res.json(memberIds);
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
exports.default = router;
