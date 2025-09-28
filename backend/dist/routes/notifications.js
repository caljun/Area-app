"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const index_1 = require("../index");
const router = (0, express_1.Router)();
const createNotificationSchema = zod_1.z.object({
    type: zod_1.z.enum(['FRIEND_REQUEST', 'AREA_INVITE', 'LOCATION_UPDATE', 'GENERAL']),
    title: zod_1.z.string().min(1, 'タイトルは必須です'),
    message: zod_1.z.string().min(1, 'メッセージは必須です'),
    data: zod_1.z.record(zod_1.z.any()).optional(),
    recipientId: zod_1.z.string().min(1, '受信者IDは必須です')
});
const updateNotificationSchema = zod_1.z.object({
    isRead: zod_1.z.boolean().optional(),
    isDeleted: zod_1.z.boolean().optional()
});
router.post('/', async (req, res) => {
    try {
        const { type, title, message, data, recipientId } = createNotificationSchema.parse(req.body);
        const recipient = await index_1.prisma.user.findUnique({
            where: { id: recipientId }
        });
        if (!recipient) {
            return res.status(404).json({ error: '受信者が見つかりません' });
        }
        const notification = await index_1.prisma.notification.create({
            data: {
                type,
                title,
                message,
                data: data || {},
                recipientId,
                senderId: req.user.id
            },
            include: {
                sender: {
                    select: {
                        id: true,
                        name: true,
                        profileImage: true
                    }
                }
            }
        });
        return res.status(201).json({
            message: '通知が作成されました',
            notification
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                error: '入力内容に問題があります',
                details: error.errors
            });
        }
        console.error('Create notification error:', error);
        return res.status(500).json({ error: '通知の作成に失敗しました' });
    }
});
router.get('/', async (req, res) => {
    try {
        const { page = '1', limit = '20', unreadOnly = 'false' } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const unreadOnlyBool = unreadOnly === 'true';
        const whereClause = {
            recipientId: req.user.id,
            isDeleted: false
        };
        if (unreadOnlyBool) {
            whereClause.isRead = false;
        }
        const notifications = await index_1.prisma.notification.findMany({
            where: whereClause,
            include: {
                sender: {
                    select: {
                        id: true,
                        name: true,
                        profileImage: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            skip: (pageNum - 1) * limitNum,
            take: limitNum
        });
        const total = await index_1.prisma.notification.count({
            where: whereClause
        });
        const unreadCount = await index_1.prisma.notification.count({
            where: {
                recipientId: req.user.id,
                isRead: false,
                isDeleted: false
            }
        });
        return res.json({
            notifications,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum)
            },
            unreadCount
        });
    }
    catch (error) {
        console.error('Get notifications error:', error);
        return res.status(500).json({ error: '通知の取得に失敗しました' });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const notification = await index_1.prisma.notification.findFirst({
            where: {
                id,
                recipientId: req.user.id,
                isDeleted: false
            },
            include: {
                sender: {
                    select: {
                        id: true,
                        name: true,
                        profileImage: true
                    }
                }
            }
        });
        if (!notification) {
            return res.status(404).json({ error: '通知が見つかりません' });
        }
        return res.json({ notification });
    }
    catch (error) {
        console.error('Get notification error:', error);
        return res.status(500).json({ error: '通知の取得に失敗しました' });
    }
});
router.put('/:id/read', async (req, res) => {
    try {
        const { id } = req.params;
        const notification = await index_1.prisma.notification.findFirst({
            where: {
                id,
                recipientId: req.user.id,
                isDeleted: false
            }
        });
        if (!notification) {
            return res.status(404).json({ error: '通知が見つかりません' });
        }
        const updatedNotification = await index_1.prisma.notification.update({
            where: { id },
            data: { isRead: true },
            include: {
                sender: {
                    select: {
                        id: true,
                        name: true,
                        profileImage: true
                    }
                }
            }
        });
        return res.json({
            message: '通知を既読にしました',
            notification: updatedNotification
        });
    }
    catch (error) {
        console.error('Mark notification as read error:', error);
        return res.status(500).json({ error: '通知の更新に失敗しました' });
    }
});
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = updateNotificationSchema.parse(req.body);
        const notification = await index_1.prisma.notification.findFirst({
            where: {
                id,
                recipientId: req.user.id,
                isDeleted: false
            }
        });
        if (!notification) {
            return res.status(404).json({ error: '通知が見つかりません' });
        }
        const updatedNotification = await index_1.prisma.notification.update({
            where: { id },
            data: updateData,
            include: {
                sender: {
                    select: {
                        id: true,
                        name: true,
                        profileImage: true
                    }
                }
            }
        });
        return res.json({
            message: '通知が更新されました',
            notification: updatedNotification
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                error: '入力内容に問題があります',
                details: error.errors
            });
        }
        console.error('Update notification error:', error);
        return res.status(500).json({ error: '通知の更新に失敗しました' });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const notification = await index_1.prisma.notification.findFirst({
            where: {
                id,
                recipientId: req.user.id,
                isDeleted: false
            }
        });
        if (!notification) {
            return res.status(404).json({ error: '通知が見つかりません' });
        }
        await index_1.prisma.notification.update({
            where: { id },
            data: { isDeleted: true }
        });
        return res.json({ message: '通知が削除されました' });
    }
    catch (error) {
        console.error('Delete notification error:', error);
        return res.status(500).json({ error: '通知の削除に失敗しました' });
    }
});
router.put('/read-all', async (req, res) => {
    try {
        await index_1.prisma.notification.updateMany({
            where: {
                recipientId: req.user.id,
                isRead: false,
                isDeleted: false
            },
            data: { isRead: true }
        });
        return res.json({ message: '全通知を既読にしました' });
    }
    catch (error) {
        console.error('Mark all notifications as read error:', error);
        return res.status(500).json({ error: '通知の更新に失敗しました' });
    }
});
router.get('/settings', async (req, res) => {
    try {
        let settings = await index_1.prisma.notificationSettings.findUnique({
            where: { userId: req.user.id }
        });
        if (!settings) {
            settings = await index_1.prisma.notificationSettings.create({
                data: {
                    userId: req.user.id,
                    friendRequests: true,
                    areaInvites: true,
                    locationUpdates: true,
                    generalNotifications: true,
                    pushEnabled: true,
                    emailEnabled: false
                }
            });
        }
        return res.json({ settings });
    }
    catch (error) {
        console.error('Get notification settings error:', error);
        return res.status(500).json({ error: '通知設定の取得に失敗しました' });
    }
});
router.put('/settings', async (req, res) => {
    try {
        const updateData = zod_1.z.object({
            friendRequests: zod_1.z.boolean().optional(),
            areaInvites: zod_1.z.boolean().optional(),
            locationUpdates: zod_1.z.boolean().optional(),
            generalNotifications: zod_1.z.boolean().optional(),
            pushEnabled: zod_1.z.boolean().optional(),
            emailEnabled: zod_1.z.boolean().optional()
        }).parse(req.body);
        const settings = await index_1.prisma.notificationSettings.upsert({
            where: { userId: req.user.id },
            update: updateData,
            create: {
                userId: req.user.id,
                ...updateData
            }
        });
        return res.json({
            message: '通知設定が更新されました',
            settings
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                error: '入力内容に問題があります',
                details: error.errors
            });
        }
        console.error('Update notification settings error:', error);
        return res.status(500).json({ error: '通知設定の更新に失敗しました' });
    }
});
router.post('/device-token', async (req, res) => {
    try {
        const { deviceToken } = zod_1.z.object({
            deviceToken: zod_1.z.string().min(1, 'デバイストークンは必須です')
        }).parse(req.body);
        await index_1.prisma.user.update({
            where: { id: req.user.id },
            data: { deviceToken }
        });
        return res.json({
            message: 'デバイストークンが登録されました',
            deviceToken
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                error: '入力内容に問題があります',
                details: error.errors
            });
        }
        console.error('Device token registration error:', error);
        return res.status(500).json({ error: 'デバイストークンの登録に失敗しました' });
    }
});
router.post('/send-push', async (req, res) => {
    try {
        const { recipientId, title, body, data } = zod_1.z.object({
            recipientId: zod_1.z.string().min(1, '受信者IDは必須です'),
            title: zod_1.z.string().min(1, 'タイトルは必須です'),
            body: zod_1.z.string().min(1, 'メッセージは必須です'),
            data: zod_1.z.record(zod_1.z.any()).optional()
        }).parse(req.body);
        const recipient = await index_1.prisma.user.findUnique({
            where: { id: recipientId },
            select: { deviceToken: true, name: true }
        });
        if (!recipient || !recipient.deviceToken) {
            return res.status(404).json({ error: '受信者のデバイストークンが見つかりません' });
        }
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
            title: title,
            body: body
        };
        notification.badge = 1;
        notification.sound = 'default';
        notification.payload = data || {};
        notification.topic = process.env.APNS_BUNDLE_ID || 'com.anonymous.Area';
        const result = await apnProvider.send(notification, recipient.deviceToken);
        if (result.failed.length > 0) {
            console.error('Push notification failed:', result.failed);
            return res.status(500).json({ error: 'プッシュ通知の送信に失敗しました' });
        }
        await index_1.prisma.notification.create({
            data: {
                type: 'GENERAL',
                title,
                message: body,
                data: data || {},
                recipientId,
                senderId: req.user.id
            }
        });
        return res.json({
            message: 'プッシュ通知が送信されました',
            result: result.sent
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                error: '入力内容に問題があります',
                details: error.errors
            });
        }
        console.error('Send push notification error:', error);
        return res.status(500).json({ error: 'プッシュ通知の送信に失敗しました' });
    }
});
exports.default = router;
