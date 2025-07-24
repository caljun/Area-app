import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { v2 as cloudinary } from 'cloudinary';

// 型定義の競合を回避
declare module 'multer-storage-cloudinary' {
  interface CloudinaryStorageOptions {
    cloudinary: any;
    params: any;
  }
}

// ✅ Cloudinary設定
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ Cloudinaryストレージ設定（すべてJPEGで保存）
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'area-app',
    format: 'jpg', // ← 常にJPEG形式で保存
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'],
    transformation: [
      { width: 800, height: 600, crop: 'limit' },
      { quality: 'auto' },
      { fetch_format: 'auto' }
    ] as any,
  } as any,
});

// ✅ 明示的なファイル形式の制限
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
    cb(new Error('対応していない画像形式です。JPEG・PNG・HEIC等をお使いください。'), false);
  }
};

// ✅ アップロード設定
export const upload = multer({
  storage: storage as any,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 最大5MB
  },
});

// ✅ 単一画像アップロード
export const uploadSingle = upload.single('image');

// ✅ 複数画像アップロード
export const uploadMultiple = upload.array('images', 5);

// ✅ エラーハンドリング
export const handleUploadError = (error: any, req: any, res: any, next: any) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'ファイルサイズが大きすぎます（最大5MB）' });
    }
    return res.status(400).json({ error: error.message });
  }

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  next();
};
