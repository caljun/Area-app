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
