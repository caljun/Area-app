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
    const { profileImage, name } = req.body;

    // 更新するデータを構築
    const updateData: any = {};
    if (profileImage !== undefined) updateData.profileImage = profileImage;
    if (name !== undefined) updateData.name = name;

    // 少なくとも1つのフィールドが提供されているかチェック
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: '更新するフィールドが指定されていません' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user!.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        areaId: true,
        name: true,
        profileImage: true,
        createdAt: true
      }
    });

    // プロフィールの完全性を再計算
    const missingFields = [];
    if (!updatedUser.name) missingFields.push('name');
    if (!updatedUser.areaId) missingFields.push('areaId');
    if (!updatedUser.profileImage) missingFields.push('profileImage');
    const profileComplete = missingFields.length === 0;

    // 統一されたレスポンス形式で返す
    return res.json({
      token: req.headers.authorization?.replace('Bearer ', ''),
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
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
    uploadSingleProfileImage(req, res, next);
  },
  handleUploadError,
  validateCloudinaryUpload,
  async (req: AuthRequest, res: Response) => {
  try {
    const { name, areaId } = req.body;
    let profileImage = req.body.profileImage;

    // 画像ファイルがアップロードされた場合、CloudinaryのURLを使用（validateCloudinaryUploadで検証済み）
    if (req.file) {
      profileImage = (req.file as any).secure_url;
      console.log('✅ 画像アップロード成功:', { secure_url: profileImage });
    }

    // 更新するデータを構築
    const updateData: any = {};
    if (profileImage !== undefined) {
      updateData.profileImage = profileImage;
      console.log('📝 profileImage更新データ:', profileImage);
    }
    // 画像ファイルがアップロードされた場合、必ずprofileImageを更新
    if (req.file) {
      updateData.profileImage = (req.file as any).secure_url;
      console.log('🖼️ 画像アップロードによるprofileImage更新:', updateData.profileImage);
    }
    if (name !== undefined && name.trim() !== '') updateData.name = name.trim();
    if (areaId !== undefined && areaId.trim() !== '') updateData.areaId = areaId.trim();

    console.log('🔄 更新データ:', updateData);

    // 少なくとも1つのフィールドが提供されているかチェック
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: '更新するフィールドが指定されていません' });
    }

    // areaIdが更新される場合、重複チェック
    if (areaId && areaId !== req.user!.areaId) {
      const existingUser = await prisma.user.findUnique({
        where: { areaId }
      });
      if (existingUser) {
        return res.status(409).json({ error: 'このArea IDは既に使用されています' });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user!.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        areaId: true,
        name: true,
        profileImage: true,
        createdAt: true
      }
    });

    console.log('✅ ユーザー更新完了:', { profileImage: updatedUser.profileImage });

    // プロフィールの完全性を再計算
    const missingFields = [];
    if (!updatedUser.name) missingFields.push('name');
    if (!updatedUser.areaId) missingFields.push('areaId');
    if (!updatedUser.profileImage) missingFields.push('profileImage');
    const profileComplete = missingFields.length === 0;

    console.log('📊 プロフィール完全性:', { profileComplete, missingFields });

    // SwiftUIアプリの期待する形式でレスポンスを返す
    return res.json({
      token: req.headers.authorization?.replace('Bearer ', ''),
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
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

// Search users by Area ID
router.get('/search/:areaId', async (req: AuthRequest, res: Response) => {
  try {
    const { areaId } = req.params;

    const user = await prisma.user.findUnique({
      where: { areaId },
      select: {
        id: true,
        name: true,
        areaId: true
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

export default router;
