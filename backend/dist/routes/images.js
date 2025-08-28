"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const index_1 = require("../index");
const auth_1 = require("../middleware/auth");
const upload_1 = require("../middleware/upload");
const cloudinary_1 = require("cloudinary");
const router = (0, express_1.Router)();
const uploadImageSchema = zod_1.z.object({
    type: zod_1.z.enum(['PROFILE', 'AREA', 'GENERAL'])
});
router.post('/upload', auth_1.authMiddleware, (req, res, next) => {
    (0, upload_1.uploadSingle)(req, res, next);
}, upload_1.handleUploadError, upload_1.validateCloudinaryUpload, async (req, res) => {
    try {
        const { type } = uploadImageSchema.parse(req.body);
        const result = req.file;
        const image = await index_1.prisma.image.create({
            data: {
                userId: req.user.id,
                url: result.secure_url,
                publicId: result.public_id,
                type: type
            }
        });
        if (type === 'PROFILE') {
            await index_1.prisma.user.update({
                where: { id: req.user.id },
                data: { profileImage: result.secure_url }
            });
        }
        return res.status(201).json({
            message: '画像のアップロードが完了しました',
            image: {
                id: image.id,
                url: image.url,
                type: image.type,
                createdAt: image.createdAt
            }
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                error: '入力内容に問題があります',
                details: error.errors
            });
        }
        console.error('Upload image error:', error);
        return res.status(500).json({ error: '画像のアップロードに失敗しました' });
    }
});
router.post('/upload-registration', (req, res, next) => {
    (0, upload_1.uploadSingle)(req, res, next);
}, upload_1.handleUploadError, upload_1.validateCloudinaryUpload, async (req, res) => {
    try {
        const { type } = uploadImageSchema.parse(req.body);
        const result = req.file;
        return res.status(201).json({
            message: '画像のアップロードが完了しました',
            image: {
                url: result.secure_url,
                type: type,
                createdAt: new Date()
            }
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                error: '入力内容に問題があります',
                details: error.errors
            });
        }
        console.error('Upload registration image error:', error);
        return res.status(500).json({ error: '画像のアップロードに失敗しました' });
    }
});
router.get('/', auth_1.authMiddleware, async (req, res) => {
    try {
        const { type } = req.query;
        const where = { userId: req.user.id };
        if (type) {
            where.type = type;
        }
        const images = await index_1.prisma.image.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });
        return res.json({ images });
    }
    catch (error) {
        console.error('Get images error:', error);
        return res.status(500).json({ error: '画像の取得に失敗しました' });
    }
});
router.delete('/:id', auth_1.authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const image = await index_1.prisma.image.findFirst({
            where: {
                id,
                userId: req.user.id
            }
        });
        if (!image) {
            return res.status(404).json({ error: '画像が見つかりません' });
        }
        try {
            await cloudinary_1.v2.uploader.destroy(image.publicId);
        }
        catch (cloudinaryError) {
            console.error('Cloudinary delete error:', cloudinaryError);
        }
        await index_1.prisma.image.delete({
            where: { id }
        });
        if (image.type === 'PROFILE') {
            await index_1.prisma.user.update({
                where: { id: req.user.id },
                data: { profileImage: null }
            });
        }
        return res.json({ message: '画像の削除が完了しました' });
    }
    catch (error) {
        console.error('Delete image error:', error);
        return res.status(500).json({ error: '画像の削除に失敗しました' });
    }
});
router.get('/:id', auth_1.authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const image = await index_1.prisma.image.findFirst({
            where: {
                id,
                userId: req.user.id
            }
        });
        if (!image) {
            return res.status(404).json({ error: '画像が見つかりません' });
        }
        return res.json({ image });
    }
    catch (error) {
        console.error('Get image error:', error);
        return res.status(500).json({ error: '画像の取得に失敗しました' });
    }
});
exports.default = router;
