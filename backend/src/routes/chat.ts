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

    // フロントエンドの期待する形式に変換
    const formattedRooms = chatRooms.map(room => ({
      id: room.id,
      participants: [room.user1Id, room.user2Id],
      lastMessage: room.messages[0] ? {
        id: room.messages[0].id,
        chatId: room.messages[0].chatId,
        senderId: room.messages[0].senderId,
        content: room.messages[0].content,
        messageType: room.messages[0].messageType.toLowerCase(),
        createdAt: room.messages[0].createdAt,
        updatedAt: room.messages[0].updatedAt
      } : null,
      unreadCount: 0, // 簡易版 - 実際の実装では未読数を計算
      createdAt: room.createdAt,
      updatedAt: room.updatedAt
    }));

    res.json(formattedRooms);
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

    // フロントエンドの期待する形式に変換
    const formattedMessages = messages.map(message => ({
      id: message.id,
      senderId: message.senderId,
      receiverId: "", // チャットIDを使用
      message: message.content,
      timestamp: message.createdAt,
      isRead: message.isRead
    }));

    res.json(formattedMessages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// メッセージ送信
router.post('/:id/messages', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { content, messageType = 'text' } = req.body;
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
        chatId: id,
        messageType: messageType.toUpperCase()
      }
    });

    // チャットの更新日時を更新
    await prisma.chat.update({
      where: { id },
      data: { updatedAt: new Date() }
    });

    // 受信者の情報を取得
    const recipientId = chat.user1Id === userId ? chat.user2Id : chat.user1Id;
    const sender = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true }
    });

    // プッシュ通知を送信
    try {
      const apn = require('apn');
      const options = {
        token: {
          key: process.env.APNS_KEY_PATH || './AuthKey_ZUS86W8Y8Q.p8',
          keyId: process.env.APNS_KEY_ID || 'ZUS86W8Y8Q',
          teamId: process.env.APNS_TEAM_ID || 'YOUR_TEAM_ID'
        },
        production: process.env.NODE_ENV === 'production'
      };

      const apnProvider = new apn.Provider(options);
      const notification = new apn.Notification();
      
      notification.alert = {
        title: `${sender?.name || '友達'}さんからのメッセージ`,
        body: content.length > 50 ? content.substring(0, 50) + '...' : content
      };
      notification.badge = 1;
      notification.sound = 'default';
      notification.payload = {
        type: 'chat_message',
        chatId: id,
        senderId: userId
      };
      notification.topic = process.env.APNS_BUNDLE_ID || 'com.anonymous.Area';

      // 受信者のデバイストークンを取得
      const recipient = await prisma.user.findUnique({
        where: { id: recipientId },
        select: { deviceToken: true }
      });

      if (recipient?.deviceToken) {
        const result = await apnProvider.send(notification, recipient.deviceToken);
        console.log('Push notification sent:', result.sent.length, 'successful,', result.failed.length, 'failed');
      }

      // 通知をデータベースに保存
      await prisma.notification.create({
        data: {
          type: 'GENERAL',
          title: `${sender?.name || '友達'}さんからのメッセージ`,
          message: content,
          data: {
            type: 'chat_message',
            chatId: id,
            senderId: userId
          },
          recipientId,
          senderId: userId
        }
      });
    } catch (pushError) {
      console.error('Push notification error:', pushError);
      // プッシュ通知のエラーはメッセージ送信を妨げない
    }

    // フロントエンドの期待する形式でレスポンスを返す
    const formattedMessage = {
      id: message.id,
      chatId: message.chatId,
      senderId: message.senderId,
      content: message.content,
      messageType: message.messageType.toLowerCase(),
      createdAt: message.createdAt,
      updatedAt: message.updatedAt
    };

    res.status(201).json(formattedMessage);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// メッセージ既読更新
router.patch('/messages/:messageId/read', async (req: AuthRequest, res: Response) => {
  try {
    const { messageId } = req.params;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
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

    res.json({ message: 'Message marked as read' });
  } catch (error) {
    console.error('Error updating message read status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 未読メッセージ数取得
router.get('/unread-count', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // ユーザーが参加しているチャットルームを取得
    const userChats = await prisma.chat.findMany({
      where: {
        OR: [
          { user1Id: userId },
          { user2Id: userId }
        ]
      },
      select: {
        id: true
      }
    });

    const chatIds = userChats.map(chat => chat.id);

    // 未読メッセージ数を計算（自分が送ったメッセージ以外で、未読のメッセージ）
    const unreadCount = await prisma.message.count({
      where: {
        chatId: { in: chatIds },
        senderId: { not: userId },
        isRead: false
      }
    });

    console.log(`未読メッセージ数取得 - userId: ${userId}, count: ${unreadCount}`);

    res.json({ unreadCount });
  } catch (error) {
    console.error('Error fetching unread message count:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// チャットルーム作成
router.post('/rooms', async (req: AuthRequest, res: Response) => {
  try {
    const { participantIds } = req.body;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
      return res.status(400).json({ error: 'Participant IDs are required' });
    }

    // 1対1チャットの場合、最初の参加者IDを使用
    const friendId = participantIds[0];

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

    if (existingChat) {
      // フロントエンドの期待する形式に変換
      const formattedChat = {
        id: existingChat.id,
        participants: [existingChat.user1Id, existingChat.user2Id],
        lastMessage: null,
        unreadCount: 0,
        createdAt: existingChat.createdAt,
        updatedAt: existingChat.updatedAt
      };
      return res.json(formattedChat);
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

    // フロントエンドの期待する形式に変換
    const formattedChat = {
      id: newChat.id,
      participants: [newChat.user1Id, newChat.user2Id],
      lastMessage: null,
      unreadCount: 0,
      createdAt: newChat.createdAt,
      updatedAt: newChat.updatedAt
    };

    res.status(201).json(formattedChat);
  } catch (error) {
    console.error('Error creating chat room:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
