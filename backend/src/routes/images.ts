import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { AuthRequest } from '../middleware/auth';
import { uploadSingle, handleUploadError } from '../middleware/upload';
import { v2 as cloudinary } from 'cloudinary';

const router = Router();

// Validation schemas
const uploadImageSchema = z.object({
  type: z.enum(['PROFILE', 'AREA', 'GENERAL'])
});

// Upload image
router.post('/upload', uploadSingle, handleUploadError, async (req: AuthRequest, res: Response) => {
  try {
    const { type } = uploadImageSchema.parse(req.body);

    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // Cloudinaryからアップロード結果を取得
    const result = req.file as any;

    // データベースに画像情報を保存
    const image = await prisma.image.create({
      data: {
        userId: req.user!.id,
        url: result.secure_url,
        publicId: result.public_id,
        type: type as any
      }
    });

    // プロフィール画像の場合、ユーザーのプロフィール画像を更新
    if (type === 'PROFILE') {
      await prisma.user.update({
        where: { id: req.user!.id },
        data: { profileImage: result.secure_url }
      });
    }

    res.status(201).json({
      message: 'Image uploaded successfully',
      image: {
        id: image.id,
        url: image.url,
        type: image.type,
        createdAt: image.createdAt
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    }
    
    console.error('Upload image error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user images
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { type } = req.query;
    
    const where: any = { userId: req.user!.id };
    if (type) {
      where.type = type;
    }

    const images = await prisma.image.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    res.json({ images });
  } catch (error) {
    console.error('Get images error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete image
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const image = await prisma.image.findFirst({
      where: {
        id,
        userId: req.user!.id
      }
    });

    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Cloudinaryから画像を削除
    try {
      await cloudinary.uploader.destroy(image.publicId);
    } catch (cloudinaryError) {
      console.error('Cloudinary delete error:', cloudinaryError);
      // Cloudinaryの削除に失敗してもデータベースからは削除する
    }

    // データベースから画像情報を削除
    await prisma.image.delete({
      where: { id }
    });

    // プロフィール画像の場合、ユーザーのプロフィール画像をクリア
    if (image.type === 'PROFILE') {
      await prisma.user.update({
        where: { id: req.user!.id },
        data: { profileImage: null }
      });
    }

    res.json({ message: 'Image deleted successfully' });
  } catch (error) {
    console.error('Delete image error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get image by ID
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const image = await prisma.image.findFirst({
      where: {
        id,
        userId: req.user!.id
      }
    });

    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    res.json({ image });
  } catch (error) {
    console.error('Get image error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 