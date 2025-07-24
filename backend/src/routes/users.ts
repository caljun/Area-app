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
        nowId: true,
        name: true,
        createdAt: true,
        profileImage: true // ← 追加
      }
    });

    return res.json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update current user's profile image
router.put('/profile', async (req: AuthRequest, res: Response) => {
  try {
    const { profileImage } = req.body;

    if (!profileImage) {
      return res.status(400).json({ error: 'profileImage is required' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user!.id },
      data: { profileImage },
      select: {
        id: true,
        email: true,
        nowId: true,
        name: true,
        profileImage: true,
        createdAt: true
      }
    });

    return res.json({ user: updatedUser });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Search users by Now ID
router.get('/search/:nowId', async (req: AuthRequest, res: Response) => {
  try {
    const { nowId } = req.params;

    const user = await prisma.user.findUnique({
      where: { nowId },
      select: {
        id: true,
        name: true,
        nowId: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Don't return the current user
    if (user.id === req.user!.id) {
      return res.status(400).json({ error: 'Cannot search for yourself' });
    }

    return res.json({ user });
  } catch (error) {
    console.error('Search user error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
