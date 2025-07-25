import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// Validation schemas
const createAreaSchema = z.object({
  name: z.string().min(1, 'Area name is required'),
  coordinates: z.array(z.object({
    latitude: z.number(),
    longitude: z.number()
  })).min(3, 'At least 3 coordinates are required'),
  isPublic: z.boolean().optional()
});

const updateAreaSchema = z.object({
  name: z.string().min(1, 'Area name is required').optional(),
  coordinates: z.array(z.object({
    latitude: z.number(),
    longitude: z.number()
  })).min(3, 'At least 3 coordinates are required').optional(),
  isPublic: z.boolean().optional()
});

// Get user's areas
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const areas = await prisma.area.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ areas });
  } catch (error) {
    console.error('Get areas error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get public areas
router.get('/public', async (req: Request, res: Response) => {
  try {
    const areas = await prisma.area.findMany({
      where: { isPublic: true },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            nowId: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ areas });
  } catch (error) {
    console.error('Get public areas error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get area by ID
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const area = await prisma.area.findFirst({
      where: {
        id,
        OR: [
          { userId: req.user!.id },
          { isPublic: true }
        ]
      } as any,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            nowId: true
          }
        }
      }
    });

    if (!area) {
      return res.status(404).json({ error: 'Area not found' });
    }

    return res.json({ area });
  } catch (error) {
    console.error('Get area error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Create area
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, coordinates, isPublic = false } = createAreaSchema.parse(req.body);

    const area = await prisma.area.create({
      data: {
        name,
        coordinates,
        isPublic,
        userId: req.user!.id
      }
    });

    return res.status(201).json({
      message: 'エリアの作成が完了しました',
      area
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: '入力内容に問題があります',
        details: error.errors
      });
    }
    
    console.error('Create area error:', error);
    return res.status(500).json({ error: 'エリアの作成に失敗しました' });
  }
});

// Update area
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = updateAreaSchema.parse(req.body);

    // Check if area exists and belongs to user
    const existingArea = await prisma.area.findFirst({
      where: {
        id,
        userId: req.user!.id
      }
    });

    if (!existingArea) {
      return res.status(404).json({ error: 'エリアが見つかりません' });
    }

    const area = await prisma.area.update({
      where: { id },
      data: updateData
    });

    return res.json({
      message: 'エリアの更新が完了しました',
      area
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: '入力内容に問題があります',
        details: error.errors
      });
    }
    
    console.error('Update area error:', error);
    return res.status(500).json({ error: 'エリアの更新に失敗しました' });
  }
});

// Delete area
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if area exists and belongs to user
    const existingArea = await prisma.area.findFirst({
      where: {
        id,
        userId: req.user!.id
      }
    });

    if (!existingArea) {
      return res.status(404).json({ error: 'Area not found' });
    }

    await prisma.area.delete({
      where: { id }
    });

    return res.json({ message: 'Area deleted successfully' });
  } catch (error) {
    console.error('Delete area error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get area members
router.get('/:id/members', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if user has access to this area
    const area = await prisma.area.findFirst({
      where: {
        id,
        OR: [
          { userId: req.user!.id },
          { isPublic: true }
        ]
      } as any
    });

    if (!area) {
      return res.status(404).json({ error: 'Area not found' });
    }

    const members = await prisma.areaMember.findMany({
      where: { areaId: id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            nowId: true,
            profileImage: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    return res.json({ members });
  } catch (error) {
    console.error('Get area members error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Add member to area
router.post('/:id/members', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Check if area belongs to user
    const area = await prisma.area.findFirst({
      where: {
        id,
        userId: req.user!.id
      }
    });

    if (!area) {
      return res.status(404).json({ error: 'Area not found or access denied' });
    }

    // Check if they are friends
    const friendship = await prisma.friend.findFirst({
      where: {
        OR: [
          { userId: req.user!.id, friendId: userId },
          { userId: userId, friendId: req.user!.id }
        ]
      } as any
    });

    if (!friendship) {
      return res.status(400).json({ error: 'Can only add friends to areas' });
    }

    // Check if already a member
    const existingMember = await prisma.areaMember.findFirst({
      where: {
        areaId: id,
        userId: userId
      }
    });

    if (existingMember) {
      return res.status(400).json({ error: 'User is already a member of this area' });
    }

    const member = await prisma.areaMember.create({
      data: {
        areaId: id,
        userId: userId,
        addedBy: req.user!.id
      },
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

    return res.status(201).json({
      message: 'Member added successfully',
      member
    });
  } catch (error) {
    console.error('Add area member error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove member from area
router.delete('/:id/members/:userId', async (req: AuthRequest, res: Response) => {
  try {
    const { id, userId } = req.params;

    // Check if area belongs to user
    const area = await prisma.area.findFirst({
      where: {
        id,
        userId: req.user!.id
      }
    });

    if (!area) {
      return res.status(404).json({ error: 'Area not found or access denied' });
    }

    // Check if member exists
    const member = await prisma.areaMember.findFirst({
      where: {
        areaId: id,
        userId: userId
      }
    });

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    await prisma.areaMember.delete({
      where: { id: member.id }
    });

    return res.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Remove area member error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get areas where user is a member
router.get('/memberships', async (req: AuthRequest, res: Response) => {
  try {
    const memberships = await prisma.areaMember.findMany({
      where: { userId: req.user!.id },
      include: {
        area: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                nowId: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json({ memberships });
  } catch (error) {
    console.error('Get area memberships error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 