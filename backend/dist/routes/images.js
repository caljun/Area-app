"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const cloudinary_1 = require("cloudinary");
const router = (0, express_1.Router)();
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024,
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        }
        else {
            cb(new Error('画像ファイルのみアップロード可能です'));
        }
    }
});
router.post('/upload-post-image', (req, res) => {
    upload.single('image')(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ error: err.message });
        }
        try {
            if (!req.file) {
                return res.status(400).json({ error: '画像ファイルが必要です' });
            }
            const result = await new Promise((resolve, reject) => {
                cloudinary_1.v2.uploader.upload_stream({
                    folder: 'area-posts',
                    transformation: [
                        { width: 800, height: 600, crop: 'limit' },
                        { quality: 'auto' }
                    ]
                }, (error, result) => {
                    if (error)
                        reject(error);
                    else
                        resolve(result);
                }).end(req.file.buffer);
            });
            res.json({
                imageUrl: result.secure_url,
                publicId: result.public_id
            });
        }
        catch (error) {
            console.error('Image upload error:', error);
            res.status(500).json({ error: '画像のアップロードに失敗しました' });
        }
    });
});
router.post('/upload-profile-image', (req, res) => {
    upload.single('image')(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ error: err.message });
        }
        try {
            if (!req.file) {
                return res.status(400).json({ error: '画像ファイルが必要です' });
            }
            const result = await new Promise((resolve, reject) => {
                cloudinary_1.v2.uploader.upload_stream({
                    folder: 'area-profiles',
                    transformation: [
                        { width: 400, height: 400, crop: 'fill', gravity: 'face' },
                        { quality: 'auto' }
                    ]
                }, (error, result) => {
                    if (error)
                        reject(error);
                    else
                        resolve(result);
                }).end(req.file.buffer);
            });
            res.json({
                imageUrl: result.secure_url,
                publicId: result.public_id
            });
        }
        catch (error) {
            console.error('Profile image upload error:', error);
            res.status(500).json({ error: 'プロフィール画像のアップロードに失敗しました' });
        }
    });
});
router.post('/upload-area-image', (req, res) => {
    upload.single('image')(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ error: err.message });
        }
        try {
            if (!req.file) {
                return res.status(400).json({ error: '画像ファイルが必要です' });
            }
            const result = await new Promise((resolve, reject) => {
                cloudinary_1.v2.uploader.upload_stream({
                    folder: 'area-images',
                    transformation: [
                        { width: 1200, height: 800, crop: 'limit' },
                        { quality: 'auto' }
                    ]
                }, (error, result) => {
                    if (error)
                        reject(error);
                    else
                        resolve(result);
                }).end(req.file.buffer);
            });
            res.json({
                imageUrl: result.secure_url,
                publicId: result.public_id
            });
        }
        catch (error) {
            console.error('Area image upload error:', error);
            res.status(500).json({ error: 'エリア画像のアップロードに失敗しました' });
        }
    });
});
router.delete('/delete-image', async (req, res) => {
    try {
        const { publicId } = req.body;
        if (!publicId) {
            return res.status(400).json({ error: '画像IDが必要です' });
        }
        await cloudinary_1.v2.uploader.destroy(publicId);
        res.json({ success: true });
    }
    catch (error) {
        console.error('Image delete error:', error);
        res.status(500).json({ error: '画像の削除に失敗しました' });
    }
});
exports.default = router;
