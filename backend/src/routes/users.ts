import { Router, Response } from 'express';
import { prisma } from '../index';
import { AuthRequest } from '../middleware/auth';
import { uploadSingleProfileImage, handleUploadError, validateCloudinaryUpload } from '../middleware/upload';

const router = Router();

// Get current user profile
router.get('/profile', async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        displayId: true,
        areaId: true,
        name: true,
        createdAt: true,
        profileImage: true
      }
    });

    return res.json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({ error: 'プロフィールの取得に失敗しました' });
  }
});

// Update current user's profile
router.put('/profile', async (req: AuthRequest, res: Response) => {
  try {
    const { profileImage, name, displayId } = req.body;

    // 更新するデータを構築
    const updateData: any = {};
    if (profileImage !== undefined) updateData.profileImage = profileImage;
    if (name !== undefined) updateData.name = name;
    if (displayId !== undefined) updateData.displayId = displayId;

    // 少なくとも1つのフィールドが提供されているかチェック
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: '更新するフィールドが指定されていません' });
    }

    // displayIdが更新される場合、重複チェック
    if (displayId && displayId !== req.user!.displayId) {
      const existingUser = await prisma.user.findFirst({
        where: { 
          displayId: displayId,
          id: { not: req.user!.id }
        }
      });
      if (existingUser) {
        return res.status(409).json({ error: 'このDisplay IDは既に使用されています' });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user!.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        displayId: true,
        areaId: true,
        name: true,
        profileImage: true,
        createdAt: true
      }
    });

    // プロフィールの完全性を再計算
    const missingFields = [];
    if (!updatedUser.name) missingFields.push('name');
    if (!updatedUser.displayId) missingFields.push('displayId');
    if (!updatedUser.profileImage) missingFields.push('profileImage');
    const profileComplete = missingFields.length === 0;

    // 統一されたレスポンス形式で返す
    return res.json({
      token: req.headers.authorization?.replace('Bearer ', ''),
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        displayId: updatedUser.displayId,
        areaId: updatedUser.areaId,
        name: updatedUser.name,
        profileImage: updatedUser.profileImage,
        createdAt: updatedUser.createdAt
      },
      isNewUser: false,
      profileComplete,
      missingFields
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ error: 'プロフィールの更新に失敗しました' });
  }
});

// Update current user's profile (PATCH /api/users/me)
router.patch('/me',
  (req: any, res: any, next: any) => {
    console.log('🔄 プロフィール更新リクエスト開始');
    console.log('📋 リクエストヘッダー:', req.headers);
    console.log('📦 リクエストボディ:', req.body);
    
    // Content-Typeがmultipart/form-dataかチェック
    const contentType = req.headers['content-type'];
    console.log('🔍 Content-Type:', contentType);
    
    if (contentType && contentType.includes('multipart/form-data')) {
      console.log('📷 画像アップロードあり - multer処理実行');
      uploadSingleProfileImage(req, res, next);
    } else {
      console.log('📝 テキストのみ - multer処理スキップ');
      next();
    }
  },
  handleUploadError,
  // 画像がアップロードされている場合のみCloudinary検証を実行
  (req: any, res: any, next: any) => {
    if (req.file) {
      console.log('🔍 画像アップロード検出 - Cloudinary検証実行');
      validateCloudinaryUpload(req, res, next);
    } else {
      console.log('📝 画像なし - Cloudinary検証スキップ');
      next();
    }
  },
  async (req: AuthRequest, res: Response) => {
  try {
    console.log('🔍 プロフィール更新処理開始');
    console.log('📁 req.file の詳細:', req.file);
    console.log('📄 req.body の詳細:', req.body);
    
    const { name, displayId } = req.body;
    let profileImage = req.body.profileImage;

    // 画像ファイルがアップロードされた場合の詳細ログ
    if (req.file) {
      console.log('✅ 画像ファイル検出成功');
      console.log('📁 ファイル情報:', {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        buffer: req.file.buffer ? 'Buffer存在' : 'Bufferなし',
        path: req.file.path,
        filename: req.file.filename
      });
      
      // Cloudinaryのアップロード結果を確認
      const cloudinaryFile = req.file as any;
      console.log('☁️ Cloudinaryファイル情報:', {
        secure_url: cloudinaryFile.secure_url,
        public_id: cloudinaryFile.public_id,
        url: cloudinaryFile.url,
        format: cloudinaryFile.format,
        width: cloudinaryFile.width,
        height: cloudinaryFile.height
      });
      
      if (cloudinaryFile.secure_url) {
        profileImage = cloudinaryFile.secure_url;
        console.log('✅ Cloudinary secure_url取得成功:', profileImage);
      } else {
        console.error('❌ Cloudinary secure_urlが取得できません');
        console.log('🔍 完全なreq.file内容:', JSON.stringify(req.file, null, 2));
      }
    } else {
      console.log('⚠️ 画像ファイルが検出されませんでした');
      console.log('🔍 multerの設定を確認してください');
    }

    // 更新するデータを構築
    const updateData: any = {};
    if (profileImage !== undefined) {
      updateData.profileImage = profileImage;
      console.log('📝 profileImage更新データ:', profileImage);
    }
    // 画像ファイルがアップロードされた場合、必ずprofileImageを更新
    if (req.file) {
      const cloudinaryFile = req.file as any;
      if (cloudinaryFile.secure_url) {
        updateData.profileImage = cloudinaryFile.secure_url;
        console.log('🖼️ 画像アップロードによるprofileImage更新:', updateData.profileImage);
      } else {
        console.error('❌ Cloudinary secure_urlが取得できません - データベース更新をスキップ');
      }
    }
    if (name !== undefined && name.trim() !== '') updateData.name = name.trim();
    if (displayId !== undefined && displayId.trim() !== '') updateData.displayId = displayId.trim();

    console.log('🔄 最終更新データ:', updateData);

    // 少なくとも1つのフィールドが提供されているかチェック
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: '更新するフィールドが指定されていません' });
    }

    // displayIdが更新される場合、重複チェック
    if (displayId && displayId !== req.user!.displayId) {
      const existingUser = await prisma.user.findFirst({
        where: { 
          displayId: displayId,
          id: { not: req.user!.id }
        }
      });
      if (existingUser) {
        return res.status(409).json({ error: 'このDisplay IDは既に使用されています' });
      }
    }

    console.log('💾 データベース更新開始:', { userId: req.user!.id, updateData });
    
    const updatedUser = await prisma.user.update({
      where: { id: req.user!.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        displayId: true,
        areaId: true,
        name: true,
        profileImage: true,
        createdAt: true
      }
    });

    console.log('✅ ユーザー更新完了:', { 
      id: updatedUser.id,
      profileImage: updatedUser.profileImage,
      name: updatedUser.name,
      displayId: updatedUser.displayId
    });

    // プロフィールの完全性を再計算
    const missingFields = [];
    if (!updatedUser.name) missingFields.push('name');
    if (!updatedUser.displayId) missingFields.push('displayId');
    if (!updatedUser.profileImage) missingFields.push('profileImage');
    const profileComplete = missingFields.length === 0;

    console.log('📊 プロフィール完全性:', { profileComplete, missingFields });

    // SwiftUIアプリの期待する形式でレスポンスを返す
    return res.json({
      token: req.headers.authorization?.replace('Bearer ', ''),
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        displayId: updatedUser.displayId,
        areaId: updatedUser.areaId,
        name: updatedUser.name,
        profileImage: updatedUser.profileImage,
        createdAt: updatedUser.createdAt
      },
      isNewUser: false,
      profileComplete,
      missingFields
    });
  } catch (error) {
    console.error('❌ プロフィール更新エラー:', error);
    return res.status(500).json({ error: 'プロフィールの更新に失敗しました' });
  }
});

// Search users by Display ID
router.get('/search/:displayId', async (req: AuthRequest, res: Response) => {
  try {
    const { displayId } = req.params;

    const user = await prisma.user.findUnique({
      where: { displayId },
      select: {
        id: true,
        name: true,
        displayId: true,
        profileImage: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'ユーザーが見つかりません' });
    }

    // Don't return the current user
    if (user.id === req.user!.id) {
      return res.status(400).json({ error: '自分自身を検索することはできません' });
    }

    return res.json({ user });
  } catch (error) {
    console.error('Search user error:', error);
    return res.status(500).json({ error: 'ユーザー検索に失敗しました' });
  }
});

// Search users by query string
router.get('/search', async (req: AuthRequest, res: Response) => {
  try {
    const { query, type } = req.query;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: '検索クエリが必要です' });
    }

    let whereClause: any = {
      id: { not: req.user!.id } // 自分自身を除外
    };

    if (type === 'displayId') {
      whereClause.displayId = { contains: query, mode: 'insensitive' };
    } else if (type === 'username') {
      whereClause.name = { contains: query, mode: 'insensitive' };
    } else {
      // デフォルトは両方で検索
      whereClause.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { displayId: { contains: query, mode: 'insensitive' } }
      ];
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        displayId: true,
        profileImage: true
      },
      take: 20
    });

    return res.json(users);
  } catch (error) {
    console.error('Search users error:', error);
    return res.status(500).json({ error: 'ユーザー検索に失敗しました' });
  }
});

export default router;
