import { Router, Response, Request } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { uploadSingle, handleUploadError } from '../middleware/upload';
import { v2 as cloudinary } from 'cloudinary';

// Prismaの型定義
type ImageType = 'PROFILE' | 'AREA' | 'GENERAL';

// Cloudinaryの型定義
interface CloudinaryFile extends Express.Multer.File {
  secure_url?: string;
  public_id?: string;
}

const router = Router();

// Validation schemas
const uploadImageSchema = z.object({
  type: z.enum(['PROFILE', 'AREA', 'GENERAL'])
});

// Upload image (requires authentication)
router.post('/upload', 
  authMiddleware,
  (req: any, res: any, next: any) => {
    uploadSingle(req, res, next);
  },
  handleUploadError, 
  async (req: AuthRequest, res: Response) => {
  try {
    const { type } = uploadImageSchema.parse(req.body);

    if (!req.file) {
      return res.status(400).json({ error: '画像ファイルが選択されていません' });
    }

    // Cloudinaryからアップロード結果を取得
    const result = req.file as CloudinaryFile;

    // データベースに画像情報を保存
    const image = await prisma.image.create({
      data: {
        userId: req.user!.id,
        url: result.secure_url,
        publicId: result.public_id,
        type: type
      }
    });

    // プロフィール画像の場合、ユーザーのプロフィール画像を更新
    if (type === 'PROFILE') {
      await prisma.user.update({
        where: { id: req.user!.id },
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
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: '入力内容に問題があります',
        details: error.errors
      });
    }
    
    console.error('Upload image error:', error);
    return res.status(500).json({ error: '画像のアップロードに失敗しました' });
  }
});

// Upload image for registration (no authentication required)
router.post('/upload-registration', 
  (req: any, res: any, next: any) => {
    uploadSingle(req, res, next);
  },
  handleUploadError, 
  async (req: any, res: Response) => {
  try {
    const { type } = uploadImageSchema.parse(req.body);

    if (!req.file) {
      return res.status(400).json({ error: '画像ファイルが選択されていません' });
    }

    // Cloudinaryからアップロード結果を取得
    const result = req.file as CloudinaryFile;

    // 登録用の画像アップロードなので、データベースには保存しない
    // ユーザー登録時にprofileImageとして使用される

    return res.status(201).json({
      message: '画像のアップロードが完了しました',
      image: {
        url: result.secure_url,
        type: type,
        createdAt: new Date()
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: '入力内容に問題があります',
        details: error.errors
      });
    }
    
    console.error('Upload registration image error:', error);
    return res.status(500).json({ error: '画像のアップロードに失敗しました' });
  }
});

// Get user images
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { type } = req.query;
    
    const where: any = { userId: req.user!.id };
    if (type) {
      where.type = type as ImageType;
    }

    const images = await prisma.image.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    return res.json({ images });
  } catch (error) {
    console.error('Get images error:', error);
    return res.status(500).json({ error: '画像の取得に失敗しました' });
  }
});

// Delete image
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const image = await prisma.image.findFirst({
      where: {
        id,
        userId: req.user!.id
      }
    });

    if (!image) {
      return res.status(404).json({ error: '画像が見つかりません' });
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

    return res.json({ message: '画像の削除が完了しました' });
  } catch (error) {
    console.error('Delete image error:', error);
    return res.status(500).json({ error: '画像の削除に失敗しました' });
  }
});

// Get image by ID
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const image = await prisma.image.findFirst({
      where: {
        id,
        userId: req.user!.id
      }
    });

    if (!image) {
      return res.status(404).json({ error: '画像が見つかりません' });
    }

    return res.json({ image });
  } catch (error) {
    console.error('Get image error:', error);
    return res.status(500).json({ error: '画像の取得に失敗しました' });
  }
});

export default router; 