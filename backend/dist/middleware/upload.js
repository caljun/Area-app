"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCloudinaryUpload = exports.handleUploadError = exports.uploadMultiple = exports.uploadSingleProfileImage = exports.uploadToCloudinaryDirectly = exports.uploadSingle = exports.upload = void 0;
const multer_1 = __importDefault(require("multer"));
const cloudinary_1 = require("cloudinary");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
console.log('🔧 Cloudinary config:', {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: !!process.env.CLOUDINARY_API_SECRET,
});
const memoryStorage = multer_1.default.memoryStorage();
const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif',
];
const fileFilter = (req, file, cb) => {
    console.log('🔍 ファイルフィルター実行:', {
        fieldname: file.fieldname,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size
    });
    if (allowedTypes.includes(file.mimetype)) {
        console.log('✅ ファイル形式OK:', file.mimetype);
        cb(null, true);
    }
    else {
        console.error('❌ 対応していないファイル形式:', file.mimetype);
        cb(new Error('対応していない画像形式です。JPEG・PNG・HEIC等をお使いください。'));
    }
};
exports.upload = (0, multer_1.default)({
    storage: memoryStorage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
});
exports.uploadSingle = exports.upload.single('image');
const uploadToCloudinaryDirectly = async (file) => {
    try {
        console.log('☁️ Cloudinary直接アップロード開始:', {
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size
        });
        if (!file.buffer) {
            throw new Error('ファイルバッファが存在しません。multer-storage-cloudinaryの設定を確認してください。');
        }
        const base64Data = file.buffer.toString('base64');
        const dataURI = `data:${file.mimetype};base64,${base64Data}`;
        console.log('📤 Cloudinaryアップロード実行中...');
        const result = await cloudinary_1.v2.uploader.upload(dataURI, {
            folder: 'area-app/profile-images',
            resource_type: 'image',
            format: 'jpg',
            transformation: [
                { width: 800, height: 600, crop: 'limit' },
                { quality: 'auto' }
            ],
            eager: [
                { format: 'jpg', quality: 'auto' }
            ],
            eager_async: true
        });
        console.log('✅ Cloudinary直接アップロード成功:', {
            secure_url: result.secure_url,
            public_id: result.public_id,
            format: result.format,
            width: result.width,
            height: result.height
        });
        return result;
    }
    catch (error) {
        console.error('❌ Cloudinary直接アップロード失敗:', error);
        throw error;
    }
};
exports.uploadToCloudinaryDirectly = uploadToCloudinaryDirectly;
const uploadSingleProfileImage = (req, res, next) => {
    console.log('🔄 uploadSingleProfileImage開始');
    console.log('📋 リクエストヘッダー:', req.headers);
    console.log('📦 リクエストボディ:', req.body);
    console.log('🔍 Content-Type:', req.headers['content-type']);
    return exports.upload.single('profileImage')(req, res, async (err) => {
        if (err) {
            console.error('❌ multer.single エラー:', err);
            console.error('❌ エラー詳細:', err.message);
            return next(err);
        }
        console.log('✅ multer.single 完了');
        console.log('📁 処理後のreq.file:', req.file);
        console.log('📄 処理後のreq.body:', req.body);
        if (!req.file) {
            console.log('⚠️ req.file が undefined です');
            console.log('🔍 リクエストの詳細を確認:');
            console.log('  - Content-Type:', req.headers['content-type']);
            console.log('  - Content-Length:', req.headers['content-length']);
            console.log('  - req.body keys:', Object.keys(req.body || {}));
            console.log('  - req.body values:', req.body);
        }
        if (req.file) {
            try {
                console.log('☁️ Cloudinary直接アップロード開始');
                const directResult = await (0, exports.uploadToCloudinaryDirectly)(req.file);
                req.file = {
                    ...req.file,
                    secure_url: directResult.secure_url,
                    public_id: directResult.public_id,
                    url: directResult.secure_url,
                    path: directResult.secure_url
                };
                console.log('✅ Cloudinaryアップロード成功:', {
                    secure_url: directResult.secure_url,
                    public_id: directResult.public_id
                });
            }
            catch (directError) {
                console.error('❌ Cloudinaryアップロード失敗:', directError);
                return next(new Error('画像のアップロードに失敗しました'));
            }
        }
        next();
    });
};
exports.uploadSingleProfileImage = uploadSingleProfileImage;
exports.uploadMultiple = exports.upload.array('images', 5);
const handleUploadError = (error, req, res, next) => {
    console.log('🔍 アップロードエラーハンドラー開始');
    console.log('📁 req.file の状態:', req.file);
    console.log('📄 req.body の状態:', req.body);
    if (error instanceof multer_1.default.MulterError) {
        console.error('❌ Multerエラー:', error);
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'ファイルサイズが大きすぎます（最大5MB）' });
        }
        return res.status(400).json({ error: error.message });
    }
    if (error) {
        console.error('❌ その他のアップロードエラー:', error);
        let errorMessage = 'アップロードに失敗しました';
        if (error.message.includes('ファイルバッファが存在しません')) {
            errorMessage = 'ファイルの処理に失敗しました。ファイルを再選択してください。';
        }
        else if (error.message.includes('画像のアップロードに失敗しました')) {
            errorMessage = '画像のアップロードに失敗しました。しばらく時間をおいて再度お試しください。';
        }
        else if (error.message) {
            errorMessage = error.message;
        }
        return res.status(400).json({ error: errorMessage });
    }
    console.log('✅ アップロードエラーなし - 次の処理へ');
    next();
};
exports.handleUploadError = handleUploadError;
const validateCloudinaryUpload = (req, res, next) => {
    console.log('🔍 Cloudinaryアップロード検証開始');
    console.log('📁 req.file の詳細:', req.file);
    if (!req.file) {
        console.error('❌ 画像ファイルが選択されていません');
        return res.status(400).json({ error: '画像ファイルが選択されていません' });
    }
    const cloudinaryFile = req.file;
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
exports.validateCloudinaryUpload = validateCloudinaryUpload;
