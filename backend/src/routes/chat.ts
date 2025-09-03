import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// チャットルーム一覧取得
router.get('/rooms', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const chatRooms = await prisma.chat.findMany({
      where: {
        OR: [
          { user1Id: userId },
          { user2Id: userId }
        ]
      },
      include: {
        user1: {
          select: {
            id: true,
            name: true,
            profileImage: true
          }
        },
        user2: {
          select: {
            id: true,
            name: true,
            profileImage: true
          }
        },
        messages: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    res.json(chatRooms);
  } catch (error) {
    console.error('Error fetching chat rooms:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 特定のチャットルームのメッセージ取得
router.get('/:id/messages', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const chat = await prisma.chat.findFirst({
      where: {
        id: id,
        OR: [
          { user1Id: userId },
          { user2Id: userId }
        ]
      }
    });

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    const messages = await prisma.message.findMany({
      where: {
        chatId: id
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// メッセージ送信
router.post('/:id/messages', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Content is required' });
    }

    const chat = await prisma.chat.findFirst({
      where: {
        id: id,
        OR: [
          { user1Id: userId },
          { user2Id: userId }
        ]
      }
    });

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    const message = await prisma.message.create({
      data: {
        content,
        senderId: userId,
        chatId: id
      }
    });

    // チャットの更新日時を更新
    await prisma.chat.update({
      where: { id },
      data: { updatedAt: new Date() }
    });

    res.status(201).json(message);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// メッセージ既読更新
router.patch('/:id/messages/:messageId/read', async (req: AuthRequest, res: Response) => {
  try {
    const { id, messageId } = req.params;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        chatId: id,
        senderId: { not: userId } // 自分が送ったメッセージは既読にできない
      }
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: { isRead: true }
    });

    res.json(updatedMessage);
  } catch (error) {
    console.error('Error updating message read status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// チャットルーム作成
router.post('/rooms', async (req: AuthRequest, res: Response) => {
  try {
    const { friendId } = req.body;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!friendId) {
      return res.status(400).json({ error: 'Friend ID is required' });
    }

    // 既存のチャットルームがあるかチェック
    const existingChat = await prisma.chat.findFirst({
      where: {
        OR: [
          {
            user1Id: userId,
            user2Id: friendId
          },
          {
            user1Id: friendId,
            user2Id: userId
          }
        ]
      }
    });

    if (existingChat) {
      return res.json(existingChat);
    }

    // 新しいチャットルームを作成
    const newChat = await prisma.chat.create({
      data: {
        user1Id: userId,
        user2Id: friendId
      },
      include: {
        user1: {
          select: {
            id: true,
            name: true,
            profileImage: true
          }
        },
        user2: {
          select: {
            id: true,
            name: true,
            profileImage: true
          }
        }
      }
    });

    res.status(201).json(newChat);
  } catch (error) {
    console.error('Error creating chat room:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
