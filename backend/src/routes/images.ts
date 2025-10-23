import { Router, Request, Response } from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// Cloudinary設定
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Multer設定（メモリストレージ）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    // 画像ファイルのみ許可
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('画像ファイルのみアップロード可能です'));
    }
  }
});

// 投稿用画像アップロード
router.post('/upload-post-image', upload.single('image'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '画像ファイルが必要です' });
    }

    // Cloudinaryにアップロード
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: 'area-posts',
          transformation: [
            { width: 800, height: 600, crop: 'limit' },
            { quality: 'auto' }
          ]
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(req.file.buffer);
    });

    res.json({ 
      imageUrl: (result as any).secure_url,
      publicId: (result as any).public_id
    });
  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({ error: '画像のアップロードに失敗しました' });
  }
});

// プロフィール画像アップロード
router.post('/upload-profile-image', upload.single('image'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '画像ファイルが必要です' });
    }

    // Cloudinaryにアップロード
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: 'area-profiles',
          transformation: [
            { width: 400, height: 400, crop: 'fill', gravity: 'face' },
            { quality: 'auto' }
          ]
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(req.file.buffer);
    });

    res.json({ 
      imageUrl: (result as any).secure_url,
      publicId: (result as any).public_id
    });
  } catch (error) {
    console.error('Profile image upload error:', error);
    res.status(500).json({ error: 'プロフィール画像のアップロードに失敗しました' });
  }
});

// エリア画像アップロード
router.post('/upload-area-image', upload.single('image'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '画像ファイルが必要です' });
    }

    // Cloudinaryにアップロード
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: 'area-images',
          transformation: [
            { width: 1200, height: 800, crop: 'limit' },
            { quality: 'auto' }
          ]
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(req.file.buffer);
    });

    res.json({ 
      imageUrl: (result as any).secure_url,
      publicId: (result as any).public_id
    });
  } catch (error) {
    console.error('Area image upload error:', error);
    res.status(500).json({ error: 'エリア画像のアップロードに失敗しました' });
  }
});

// 画像削除
router.delete('/delete-image', async (req: Request, res: Response) => {
  try {
    const { publicId } = req.body;

    if (!publicId) {
      return res.status(400).json({ error: '画像IDが必要です' });
    }

    // Cloudinaryから画像を削除
    await cloudinary.uploader.destroy(publicId);

    res.json({ success: true });
  } catch (error) {
    console.error('Image delete error:', error);
    res.status(500).json({ error: '画像の削除に失敗しました' });
  }
});

export default router;