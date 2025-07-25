import express from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

const router = express.Router();

// 🔧 Cloudinary設定（環境変数より取得）
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ ストレージ設定（画像は cloudinary に保存）
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    return {
      folder: 'area-app',
      allowed_formats: ['jpg', 'jpeg', 'png'],
      transformation: [{ width: 500, height: 500, crop: 'limit' }],
    };
  },
});

const upload = multer({ storage });

// ✅ POST: /api/images/upload
router.post('/', upload.single('image'), async (req, res) => {
  try {
    console.log('🔧 Cloudinary config:', {
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY ? '✅' : '❌',
      api_secret: process.env.CLOUDINARY_API_SECRET ? '✅' : '❌',
    });

    if (!req.file) {
      console.error('❌ req.file is undefined');
      return res.status(400).json({ error: 'Image upload failed: No file received.' });
    }

    console.log('📦 Uploaded file:', req.file);

    // ✅ Cloudinary URLのレスポンス
    const imageUrl = (req.file as any).path;
    res.status(200).json({ imageUrl });
  } catch (err) {
    console.error('❌ Cloudinary upload failed:', err);
    res.status(500).json({ error: 'Internal server error during image upload.' });
  }
});

export default router;