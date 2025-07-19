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

    return res.status(201).json({
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
    return res.status(500).json({ error: 'Internal server error' });
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

    return res.json({ friends: friendsWithLocations });
  } catch (error) {
    console.error('Get friends locations error:', error);
    return res.status(500).json({ error: 'Internal server error' });
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

    return res.json({ locations });
  } catch (error) {
    console.error('Get location history error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get friends locations in specific area
router.get('/area/:areaId/friends', async (req: AuthRequest, res: Response) => {
  try {
    const { areaId } = req.params;

    // Check if user has access to this area
    const area = await prisma.area.findFirst({
      where: {
        id: areaId,
        OR: [
          { userId: req.user!.id },
          { isPublic: true }
        ]
      } as any
    });

    if (!area) {
      return res.status(404).json({ error: 'Area not found' });
    }

    // Get area members
    const areaMembers = await prisma.areaMember.findMany({
      where: { areaId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            nowId: true,
            profileImage: true
          }
        }
      }
    });

    // Get latest location for each member
    const membersWithLocations = await Promise.all(
      areaMembers.map(async (member) => {
        const latestLocation = await prisma.location.findFirst({
          where: { userId: member.userId },
          orderBy: { createdAt: 'desc' }
        });

        return {
          ...member.user,
          location: latestLocation ? {
            latitude: latestLocation.latitude,
            longitude: latestLocation.longitude,
            updatedAt: latestLocation.createdAt
          } : null
        };
      })
    );

    return res.json({ friends: membersWithLocations });
  } catch (error) {
    console.error('Get area friends locations error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 