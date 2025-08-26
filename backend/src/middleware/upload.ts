import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { v2 as cloudinary } from 'cloudinary';
import { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Cloudinary設定の確認ログ
console.log('🔧 Cloudinary config:', {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: !!process.env.CLOUDINARY_API_SECRET, // true ならOK
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'area-app',
    format: 'jpg',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'],
    transformation: [
      { width: 800, height: 600, crop: 'limit' },
      { quality: 'auto' },
      { fetch_format: 'auto' },
    ],
  } as any,
});

const allowedTypes = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
];

const fileFilter = (req: any, file: any, cb: any) => {
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('対応していない画像形式です。JPEG・PNG・HEIC等をお使いください。'));
  }
};

export const upload = multer({
  storage: storage as any,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
}) as any;

export const uploadSingle = upload.single('image');

export const uploadSingleProfileImage = upload.single('profileImage');

export const uploadMultiple = upload.array('images', 5);

export const handleUploadError = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'ファイルサイズが大きすぎます（最大5MB）' });
    }
    return res.status(400).json({ error: error.message });
  }

  if (error) {
    console.error('Upload error:', error);
    return res.status(400).json({ error: error.message || 'アップロードに失敗しました' });
  }

  next();
};

// Cloudinaryアップロード結果の検証とsecure_urlの取得を確実にする
export const validateCloudinaryUpload = (req: Request, res: Response, next: NextFunction) => {
  if (!req.file) {
    return res.status(400).json({ error: '画像ファイルが選択されていません' });
  }

  // Cloudinaryのアップロード結果を確認
  const cloudinaryFile = req.file as any;
  
  if (!cloudinaryFile.secure_url) {
    console.error('Cloudinary upload failed - no secure_url:', cloudinaryFile);
    return res.status(500).json({ error: '画像のアップロードに失敗しました。Cloudinaryからの応答が不正です。' });
  }

  if (!cloudinaryFile.public_id) {
    console.error('Cloudinary upload failed - no public_id:', cloudinaryFile);
    return res.status(500).json({ error: '画像のアップロードに失敗しました。Cloudinaryからの応答が不正です。' });
  }

  console.log('✅ Cloudinary upload successful:', {
    secure_url: cloudinaryFile.secure_url,
    public_id: cloudinaryFile.public_id
  });

  next();
};

