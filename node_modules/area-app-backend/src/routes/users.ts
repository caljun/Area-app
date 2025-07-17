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
        createdAt: true
      }
    });

    res.json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
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

    res.json({ user });
  } catch (error) {
    console.error('Search user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 