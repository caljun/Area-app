import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// Validation schemas
const sendFriendRequestSchema = z.object({
  receiverId: z.string().min(1, 'Receiver ID is required')
});

const respondToFriendRequestSchema = z.object({
  requestId: z.string().min(1, 'Request ID is required'),
  status: z.enum(['ACCEPTED', 'REJECTED'])
});

const sendAreaRequestSchema = z.object({
  receiverId: z.string().min(1, 'Receiver ID is required'),
  areaId: z.string().min(1, 'Area ID is required')
});

// Get friends list
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
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

    res.json({ friends });
  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get friend requests
router.get('/requests', async (req: AuthRequest, res: Response) => {
  try {
    const requests = await prisma.friendRequest.findMany({
      where: { 
        receiverId: req.user!.id,
        status: 'PENDING'
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            nowId: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ requests });
  } catch (error) {
    console.error('Get friend requests error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send friend request
router.post('/request', async (req: AuthRequest, res: Response) => {
  try {
    const { receiverId } = sendFriendRequestSchema.parse(req.body);

    // Check if already friends
    const existingFriend = await prisma.friend.findFirst({
      where: {
        OR: [
          { userId: req.user!.id, friendId: receiverId },
          { userId: receiverId, friendId: req.user!.id }
        ]
      } as any
    });

    if (existingFriend) {
      return res.status(400).json({ error: 'Already friends' });
    }

    // Check if request already exists
    const existingRequest = await prisma.friendRequest.findFirst({
      where: {
        OR: [
          { senderId: req.user!.id, receiverId: receiverId },
          { senderId: receiverId, receiverId: req.user!.id }
        ],
        status: 'PENDING'
      } as any
    });

    if (existingRequest) {
      return res.status(400).json({ error: 'Friend request already exists' });
    }

    const request = await prisma.friendRequest.create({
      data: {
        senderId: req.user!.id,
        receiverId
      },
      include: {
        receiver: {
          select: {
            id: true,
            name: true,
            nowId: true
          }
        }
      }
    });

    return res.status(201).json({
      message: 'Friend request sent successfully',
      request
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    }
    
    console.error('Send friend request error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Respond to friend request
router.put('/request/:requestId', async (req: AuthRequest, res: Response) => {
  try {
    const { requestId } = req.params;
    const { status } = respondToFriendRequestSchema.parse(req.body);

    const request = await prisma.friendRequest.findFirst({
      where: {
        id: requestId,
        receiverId: req.user!.id,
        status: 'PENDING'
      }
    });

    if (!request) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    await prisma.friendRequest.update({
      where: { id: requestId },
      data: { status }
    });

    if (status === 'ACCEPTED') {
      // Create friend relationship
      await prisma.friend.create({
        data: {
          userId: request.senderId,
          friendId: request.receiverId
        }
      });
    }

    return res.json({
      message: `Friend request ${status.toLowerCase()} successfully`
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    }
    
    console.error('Respond to friend request error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get area requests
router.get('/area-requests', async (req: AuthRequest, res: Response) => {
  try {
    const requests = await prisma.areaRequest.findMany({
      where: { 
        receiverId: req.user!.id,
        status: 'PENDING'
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            nowId: true
          }
        },
        area: {
          select: {
            id: true,
            name: true,
            coordinates: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json({ requests });
  } catch (error) {
    console.error('Get area requests error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Send area request
router.post('/area-request', async (req: AuthRequest, res: Response) => {
  try {
    const { receiverId, areaId } = sendAreaRequestSchema.parse(req.body);

    // Check if they are friends
    const friendship = await prisma.friend.findFirst({
      where: {
        OR: [
          { userId: req.user!.id, friendId: receiverId },
          { userId: receiverId, friendId: req.user!.id }
        ]
      } as any
    });

    if (!friendship) {
      return res.status(400).json({ error: 'Can only share areas with friends' });
    }

    // Check if area belongs to user
    const area = await prisma.area.findFirst({
      where: {
        id: areaId,
        userId: req.user!.id
      }
    });

    if (!area) {
      return res.status(404).json({ error: 'Area not found' });
    }

    // Check if request already exists
    const existingRequest = await prisma.areaRequest.findFirst({
      where: {
        senderId: req.user!.id,
        receiverId,
        areaId,
        status: 'PENDING'
      }
    });

    if (existingRequest) {
      return res.status(400).json({ error: 'Area request already exists' });
    }

    const request = await prisma.areaRequest.create({
      data: {
        senderId: req.user!.id,
        receiverId,
        areaId
      },
      include: {
        receiver: {
          select: {
            id: true,
            name: true,
            nowId: true
          }
        },
        area: {
          select: {
            id: true,
            name: true,
            coordinates: true
          }
        }
      }
    });

    return res.status(201).json({
      message: 'Area request sent successfully',
      request
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    }
    
    console.error('Send area request error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Respond to area request
router.put('/area-request/:requestId', async (req: AuthRequest, res: Response) => {
  try {
    const { requestId } = req.params;
    const { status } = respondToFriendRequestSchema.parse(req.body);

    const request = await prisma.areaRequest.findFirst({
      where: {
        id: requestId,
        receiverId: req.user!.id,
        status: 'PENDING'
      }
    });

    if (!request) {
      return res.status(404).json({ error: 'Area request not found' });
    }

    await prisma.areaRequest.update({
      where: { id: requestId },
      data: { status }
    });

    return res.json({
      message: `Area request ${status.toLowerCase()} successfully`
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    }
    
    console.error('Respond to area request error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 