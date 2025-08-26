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
  console.log('🔍 ファイルフィルター実行:', {
    fieldname: file.fieldname,
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size
  });
  
  if (allowedTypes.includes(file.mimetype)) {
    console.log('✅ ファイル形式OK:', file.mimetype);
    cb(null, true);
  } else {
    console.error('❌ 対応していないファイル形式:', file.mimetype);
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

// アップロード処理の詳細ログを追加
export const uploadSingleProfileImage = (req: any, res: any, next: any) => {
  console.log('🔄 uploadSingleProfileImage開始');
  console.log('📋 リクエストヘッダー:', req.headers);
  console.log('📦 リクエストボディ:', req.body);
  
  return upload.single('profileImage')(req, res, (err: any) => {
    if (err) {
      console.error('❌ multer.single エラー:', err);
      return next(err);
    }
    
    console.log('✅ multer.single 完了');
    console.log('📁 処理後のreq.file:', req.file);
    console.log('📄 処理後のreq.body:', req.body);
    
    next();
  });
};

export const uploadMultiple = upload.array('images', 5);

export const handleUploadError = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.log('🔍 アップロードエラーハンドラー開始');
  console.log('📁 req.file の状態:', req.file);
  console.log('📄 req.body の状態:', req.body);
  
  if (error instanceof multer.MulterError) {
    console.error('❌ Multerエラー:', error);
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'ファイルサイズが大きすぎます（最大5MB）' });
    }
    return res.status(400).json({ error: error.message });
  }

  if (error) {
    console.error('❌ その他のアップロードエラー:', error);
    return res.status(400).json({ error: error.message || 'アップロードに失敗しました' });
  }

  console.log('✅ アップロードエラーなし - 次の処理へ');
  next();
};

// Cloudinaryアップロード結果の検証とsecure_urlの取得を確実にする
export const validateCloudinaryUpload = (req: Request, res: Response, next: NextFunction) => {
  console.log('🔍 Cloudinaryアップロード検証開始');
  console.log('📁 req.file の詳細:', req.file);
  
  if (!req.file) {
    console.error('❌ 画像ファイルが選択されていません');
    return res.status(400).json({ error: '画像ファイルが選択されていません' });
  }

  // Cloudinaryのアップロード結果を確認
  const cloudinaryFile = req.file as any;
  console.log('☁️ Cloudinaryファイル詳細:', {
    fieldname: cloudinaryFile.fieldname,
    originalname: cloudinaryFile.originalname,
    mimetype: cloudinaryFile.mimetype,
    size: cloudinaryFile.size,
    secure_url: cloudinaryFile.secure_url,
    public_id: cloudinaryFile.public_id,
    url: cloudinaryFile.url,
    format: cloudinaryFile.format,
    width: cloudinaryFile.width,
    height: cloudinaryFile.height
  });
  
  if (!cloudinaryFile.secure_url) {
    console.error('❌ Cloudinary upload failed - no secure_url:', cloudinaryFile);
    console.log('🔍 完全なreq.file内容:', JSON.stringify(req.file, null, 2));
    return res.status(500).json({ error: '画像のアップロードに失敗しました。Cloudinaryからの応答が不正です。' });
  }

  if (!cloudinaryFile.public_id) {
    console.error('❌ Cloudinary upload failed - no public_id:', cloudinaryFile);
    console.log('🔍 完全なreq.file内容:', JSON.stringify(req.file, null, 2));
    return res.status(500).json({ error: '画像のアップロードに失敗しました。Cloudinaryからの応答が不正です。' });
  }

  console.log('✅ Cloudinary upload successful:', {
    secure_url: cloudinaryFile.secure_url,
    public_id: cloudinaryFile.public_id,
    format: cloudinaryFile.format,
    width: cloudinaryFile.width,
    height: cloudinaryFile.height
  });

  next();
};

