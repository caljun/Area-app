import { Router, Response } from 'express';
import { prisma } from '../index';
import { AuthRequest } from '../middleware/auth';

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

    return res.json({ user: updatedUser });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ error: 'プロフィールの更新に失敗しました' });
  }
});

// Update current user's profile (PATCH /api/users/me)
router.patch('/me', async (req: AuthRequest, res: Response) => {
  try {
    const { profileImage, name, areaId } = req.body;

    // 更新するデータを構築
    const updateData: any = {};
    if (profileImage !== undefined) updateData.profileImage = profileImage;
    if (name !== undefined) updateData.name = name;
    if (areaId !== undefined) updateData.areaId = areaId;

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
        return res.status(400).json({ error: 'このArea IDは既に使用されています' });
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

    // プロフィールの完全性を再計算
    const missingFields = [];
    if (!updatedUser.name) missingFields.push('name');
    if (!updatedUser.areaId) missingFields.push('areaId');
    if (!updatedUser.profileImage) missingFields.push('profileImage');
    const profileComplete = missingFields.length === 0;

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
