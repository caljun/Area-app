import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// Validation schemas
const updateLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180)
});

// Update user location
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { latitude, longitude } = updateLocationSchema.parse(req.body);

    const location = await prisma.location.create({
      data: {
        userId: req.user!.id,
        latitude,
        longitude
      }
    });

    res.status(201).json({
      message: 'Location updated successfully',
      location
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    }
    
    console.error('Update location error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get friends locations
router.get('/friends', async (req: AuthRequest, res: Response) => {
  try {
    // Get user's friends
    const friends = await prisma.friend.findMany({
      where: { userId: req.user!.id },
      include: {
        friend: {
          select: {
            id: true,
            name: true,
            nowId: true
          }
        }
      }
    });

    // Get latest location for each friend
    const friendsWithLocations = await Promise.all(
      friends.map(async (friend) => {
        const latestLocation = await prisma.location.findFirst({
          where: { userId: friend.friendId },
          orderBy: { createdAt: 'desc' }
        });

        return {
          ...friend.friend,
          location: latestLocation ? {
            latitude: latestLocation.latitude,
            longitude: latestLocation.longitude,
            updatedAt: latestLocation.createdAt
          } : null
        };
      })
    );

    res.json({ friends: friendsWithLocations });
  } catch (error) {
    console.error('Get friends locations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's location history
router.get('/history', async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    
    const locations = await prisma.location.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100) // Max 100 locations
    });

    res.json({ locations });
  } catch (error) {
    console.error('Get location history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 