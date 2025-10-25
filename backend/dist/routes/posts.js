"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const index_1 = require("../index");
const router = (0, express_1.Router)();
const createPostSchema = zod_1.z.object({
    content: zod_1.z.string().min(1, '投稿内容は必須です'),
    imageUrl: zod_1.z.string().url('画像URLの形式が正しくありません'),
    location: zod_1.z.object({
        type: zod_1.z.literal('Point'),
        coordinates: zod_1.z.array(zod_1.z.number()).length(2)
    }),
    areaId: zod_1.z.string().min(1, 'エリアIDは必須です')
});
const updatePostSchema = zod_1.z.object({
    content: zod_1.z.string().min(1, '投稿内容は必須です').optional(),
    imageUrl: zod_1.z.string().url('画像URLの形式が正しくありません').optional()
});
const commentSchema = zod_1.z.object({
    content: zod_1.z.string().min(1, 'コメント内容は必須です')
});
function isPointInPolygon(point, polygon) {
    const [x, y] = point;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].longitude;
        const yi = polygon[i].latitude;
        const xj = polygon[j].longitude;
        const yj = polygon[j].latitude;
        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }
    return inside;
}
router.post('/', async (req, res) => {
    try {
        const { content, imageUrl, location, areaId } = createPostSchema.parse(req.body);
        const area = await index_1.prisma.area.findUnique({
            where: { id: areaId },
            select: {
                id: true,
                name: true,
                coordinates: true,
                userId: true,
                areaMembers: {
                    where: { userId: req.user.id }
                }
            }
        });
        if (!area) {
            return res.status(404).json({ error: 'エリアが見つかりません' });
        }
        const isOwner = area.userId === req.user.id;
        const isMember = area.areaMembers.length > 0;
        if (!isOwner && !isMember) {
            return res.status(403).json({ error: 'このエリアのメンバーではありません' });
        }
        const coordinates = area.coordinates;
        const isInArea = isPointInPolygon([location.coordinates[0], location.coordinates[1]], coordinates);
        if (!isInArea) {
            return res.status(403).json({ error: 'エリア内でのみ投稿可能です' });
        }
        const user = await index_1.prisma.user.findUnique({
            where: { id: req.user.id },
            select: { name: true, profileImage: true }
        });
        const post = await index_1.prisma.post.create({
            data: {
                content,
                imageUrl,
                location,
                areaId,
                userId: req.user.id,
                userName: user?.name,
                userProfileImage: user?.profileImage
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        profileImage: true
                    }
                },
                area: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });
        res.status(201).json(post);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                error: '入力内容に問題があります',
                details: error.errors
            });
        }
        console.error('Create post error:', error);
        res.status(500).json({ error: '投稿の作成に失敗しました' });
    }
});
router.get('/', async (req, res) => {
    try {
        const { areaId, page = '1', limit = '20' } = req.query;
        if (!areaId) {
            return res.status(400).json({ error: 'エリアIDは必須です' });
        }
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;
        const area = await index_1.prisma.area.findFirst({
            where: {
                id: areaId,
                OR: [
                    { userId: req.user.id },
                    {
                        areaMembers: {
                            some: { userId: req.user.id }
                        }
                    }
                ]
            }
        });
        if (!area) {
            return res.status(404).json({ error: 'エリアが見つかりません' });
        }
        const posts = await index_1.prisma.post.findMany({
            where: { areaId: areaId },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        profileImage: true
                    }
                },
                area: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                likes: {
                    where: { userId: req.user.id }
                }
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limitNum
        });
        const postsWithLikeStatus = posts.map(post => ({
            ...post,
            isLiked: post.likes.length > 0,
            likes: undefined
        }));
        const total = await index_1.prisma.post.count({
            where: { areaId: areaId }
        });
        res.json({
            posts: postsWithLikeStatus,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum)
            }
        });
    }
    catch (error) {
        console.error('Get posts error:', error);
        res.status(500).json({ error: '投稿の取得に失敗しました' });
    }
});
router.get('/my', async (req, res) => {
    try {
        const posts = await index_1.prisma.post.findMany({
            where: { userId: req.user.id },
            include: {
                area: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                user: {
                    select: {
                        id: true,
                        name: true,
                        profileImage: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(posts);
    }
    catch (error) {
        console.error('Get my posts error:', error);
        res.status(500).json({ error: '自分の投稿の取得に失敗しました' });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const post = await index_1.prisma.post.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        profileImage: true
                    }
                },
                area: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                comments: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                profileImage: true
                            }
                        }
                    },
                    orderBy: { createdAt: 'asc' }
                },
                likes: {
                    where: { userId: req.user.id }
                }
            }
        });
        if (!post) {
            return res.status(404).json({ error: '投稿が見つかりません' });
        }
        const area = await index_1.prisma.area.findFirst({
            where: {
                id: post.areaId,
                OR: [
                    { userId: req.user.id },
                    {
                        areaMembers: {
                            some: { userId: req.user.id }
                        }
                    }
                ]
            }
        });
        if (!area) {
            return res.status(403).json({ error: 'このエリアのメンバーではありません' });
        }
        const postWithLikeStatus = {
            ...post,
            isLiked: post.likes.length > 0,
            likes: undefined
        };
        res.json(postWithLikeStatus);
    }
    catch (error) {
        console.error('Get post error:', error);
        res.status(500).json({ error: '投稿の取得に失敗しました' });
    }
});
router.patch('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = updatePostSchema.parse(req.body);
        const existingPost = await index_1.prisma.post.findFirst({
            where: {
                id,
                userId: req.user.id
            }
        });
        if (!existingPost) {
            return res.status(404).json({ error: '投稿が見つからないか、編集権限がありません' });
        }
        const post = await index_1.prisma.post.update({
            where: { id },
            data: updateData,
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        profileImage: true
                    }
                },
                area: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });
        res.json(post);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                error: '入力内容に問題があります',
                details: error.errors
            });
        }
        console.error('Update post error:', error);
        res.status(500).json({ error: '投稿の更新に失敗しました' });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const existingPost = await index_1.prisma.post.findFirst({
            where: {
                id,
                userId: req.user.id
            }
        });
        if (!existingPost) {
            return res.status(404).json({ error: '投稿が見つからないか、削除権限がありません' });
        }
        await index_1.prisma.post.delete({
            where: { id }
        });
        res.status(204).send();
    }
    catch (error) {
        console.error('Delete post error:', error);
        res.status(500).json({ error: '投稿の削除に失敗しました' });
    }
});
router.post('/:id/like', async (req, res) => {
    try {
        const { id } = req.params;
        const { isLiked } = req.body;
        const post = await index_1.prisma.post.findUnique({
            where: { id }
        });
        if (!post) {
            return res.status(404).json({ error: '投稿が見つかりません' });
        }
        if (isLiked) {
            await index_1.prisma.postLike.upsert({
                where: {
                    postId_userId: {
                        postId: id,
                        userId: req.user.id
                    }
                },
                update: {},
                create: {
                    postId: id,
                    userId: req.user.id
                }
            });
            await index_1.prisma.post.update({
                where: { id },
                data: {
                    likeCount: { increment: 1 }
                }
            });
        }
        else {
            await index_1.prisma.postLike.deleteMany({
                where: {
                    postId: id,
                    userId: req.user.id
                }
            });
            await index_1.prisma.post.update({
                where: { id },
                data: {
                    likeCount: { decrement: 1 }
                }
            });
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error('Like post error:', error);
        res.status(500).json({ error: 'いいねの処理に失敗しました' });
    }
});
router.post('/:id/comments', async (req, res) => {
    try {
        const { id } = req.params;
        const { content } = commentSchema.parse(req.body);
        const post = await index_1.prisma.post.findUnique({
            where: { id }
        });
        if (!post) {
            return res.status(404).json({ error: '投稿が見つかりません' });
        }
        const user = await index_1.prisma.user.findUnique({
            where: { id: req.user.id },
            select: { name: true, profileImage: true }
        });
        const comment = await index_1.prisma.comment.create({
            data: {
                content,
                postId: id,
                userId: req.user.id,
                userName: user?.name,
                userProfileImage: user?.profileImage
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        profileImage: true
                    }
                }
            }
        });
        await index_1.prisma.post.update({
            where: { id },
            data: {
                commentCount: { increment: 1 }
            }
        });
        res.status(201).json(comment);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                error: '入力内容に問題があります',
                details: error.errors
            });
        }
        console.error('Add comment error:', error);
        res.status(500).json({ error: 'コメントの追加に失敗しました' });
    }
});
router.get('/nearby', async (req, res) => {
    try {
        const { lat, lng, radius = '1000' } = req.query;
        if (!lat || !lng) {
            return res.status(400).json({ error: '緯度と経度は必須です' });
        }
        const latitude = parseFloat(lat);
        const longitude = parseFloat(lng);
        const radiusMeters = parseInt(radius);
        const posts = await index_1.prisma.post.findMany({
            where: {},
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        profileImage: true
                    }
                },
                area: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                likes: {
                    where: { userId: req.user.id }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 50
        });
        const postsWithLikeStatus = posts.map(post => ({
            ...post,
            isLiked: post.likes.length > 0,
            likes: undefined
        }));
        res.json(postsWithLikeStatus);
    }
    catch (error) {
        console.error('Get nearby posts error:', error);
        res.status(500).json({ error: '近くの投稿の取得に失敗しました' });
    }
});
exports.default = router;
