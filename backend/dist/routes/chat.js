"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
router.get('/rooms', async (req, res) => {
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
            unreadCount: 0,
            createdAt: room.createdAt,
            updatedAt: room.updatedAt
        }));
        res.json(formattedRooms);
    }
    catch (error) {
        console.error('Error fetching chat rooms:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/:id/messages', async (req, res) => {
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
        const formattedMessages = messages.map(message => ({
            id: message.id,
            senderId: message.senderId,
            receiverId: "",
            message: message.content,
            timestamp: message.createdAt,
            isRead: message.isRead
        }));
        res.json(formattedMessages);
    }
    catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/:id/messages', async (req, res) => {
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
        await prisma.chat.update({
            where: { id },
            data: { updatedAt: new Date() }
        });
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
    }
    catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.patch('/messages/:messageId/read', async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const message = await prisma.message.findFirst({
            where: {
                id: messageId,
                senderId: { not: userId }
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
    }
    catch (error) {
        console.error('Error updating message read status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/rooms', async (req, res) => {
    try {
        const { participantIds } = req.body;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
            return res.status(400).json({ error: 'Participant IDs are required' });
        }
        const friendId = participantIds[0];
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
        const formattedChat = {
            id: newChat.id,
            participants: [newChat.user1Id, newChat.user2Id],
            lastMessage: null,
            unreadCount: 0,
            createdAt: newChat.createdAt,
            updatedAt: newChat.updatedAt
        };
        res.status(201).json(formattedChat);
    }
    catch (error) {
        console.error('Error creating chat room:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
