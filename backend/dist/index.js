"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = exports.io = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const auth_1 = __importDefault(require("./routes/auth"));
const users_1 = __importDefault(require("./routes/users"));
const areas_1 = __importDefault(require("./routes/areas"));
const friends_1 = __importDefault(require("./routes/friends"));
const locations_1 = __importDefault(require("./routes/locations"));
const images_1 = __importDefault(require("./routes/images"));
const notifications_1 = __importDefault(require("./routes/notifications"));
const chat_1 = __importDefault(require("./routes/chat"));
const errorHandler_1 = require("./middleware/errorHandler");
const auth_2 = require("./middleware/auth");
const client_1 = require("@prisma/client");
dotenv_1.default.config();
const requiredEnvVars = [
    'JWT_SECRET',
    'DATABASE_URL',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET'
];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingEnvVars);
    process.exit(1);
}
if (process.env.NODE_ENV === 'development') {
    console.log('🔍 Environment variables check:');
    console.log('CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME);
    console.log('CLOUDINARY_API_KEY:', process.env.CLOUDINARY_API_KEY);
    console.log('CLOUDINARY_API_SECRET:', !!process.env.CLOUDINARY_API_SECRET);
}
const app = (0, express_1.default)();
app.set('trust proxy', 1);
const server = (0, http_1.createServer)(app);
exports.io = new socket_io_1.Server(server, {
    cors: {
        origin: process.env.CORS_ORIGIN || "http://localhost:8081",
        methods: ["GET", "POST"]
    }
});
exports.prisma = new client_1.PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});
exports.prisma.$connect()
    .then(() => {
    console.log('✅ Database connected successfully');
})
    .catch((error) => {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
});
const limiter = (0, express_rate_limit_1.default)({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    message: 'リクエストが多すぎます。しばらく時間をおいてから再試行してください。',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
});
const authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'ログイン試行回数が上限に達しました。しばらく時間をおいてから再試行してください。',
    standardHeaders: true,
    legacyHeaders: false,
});
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN || "http://localhost:8081",
    credentials: true
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});
app.get('/api/session', authLimiter, auth_2.authMiddleware, async (req, res) => {
    try {
        const user = await exports.prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                email: true,
                areaId: true,
                name: true,
                profileImage: true,
                createdAt: true
            }
        });
        if (!user) {
            return res.status(404).json({ error: 'ユーザーが見つかりません' });
        }
        const missingFields = [];
        if (!user.name)
            missingFields.push('name');
        if (!user.areaId)
            missingFields.push('areaId');
        if (!user.profileImage)
            missingFields.push('profileImage');
        const profileComplete = missingFields.length === 0;
        return res.json({
            token: req.headers.authorization?.replace('Bearer ', ''),
            user: {
                id: user.id,
                email: user.email,
                areaId: user.areaId,
                name: user.name,
                profileImage: user.profileImage,
                createdAt: user.createdAt
            },
            isNewUser: false,
            profileComplete,
            missingFields
        });
    }
    catch (error) {
        console.error('Session validation error:', error);
        return res.status(500).json({ error: 'セッション検証に失敗しました' });
    }
});
app.use('/api/auth', authLimiter, auth_1.default);
app.use('/api/users', auth_2.authMiddleware, users_1.default);
app.use('/api/areas', auth_2.authMiddleware, areas_1.default);
const authedKeyedLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.id || req.ip,
});
app.use('/api/friends', auth_2.authMiddleware, authedKeyedLimiter, friends_1.default);
app.use('/api/locations', auth_2.authMiddleware, authedKeyedLimiter, locations_1.default);
app.use('/api/location', auth_2.authMiddleware, locations_1.default);
app.use('/api/images', images_1.default);
app.use('/api/notifications', auth_2.authMiddleware, notifications_1.default);
app.use('/api/chat', auth_2.authMiddleware, chat_1.default);
exports.io.on('connection', (socket) => {
    console.log('WebSocket: User connected:', socket.id);
    const token = socket.handshake.query.token;
    const userId = socket.handshake.query.userId;
    if (token && userId) {
        jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'fallback-secret', async (err, decoded) => {
            if (err) {
                console.log('WebSocket authentication failed:', err.message);
                socket.emit('auth_error', { message: 'Invalid token' });
                return;
            }
            try {
                const user = await exports.prisma.user.findUnique({
                    where: { id: decoded.userId },
                    select: { id: true, name: true, profileImage: true }
                });
                if (user) {
                    socket.data.userId = user.id;
                    socket.data.userName = user.name;
                    socket.data.profileImage = user.profileImage;
                    socket.join(`user_${user.id}`);
                    socket.emit('connection', {
                        type: 'connection',
                        data: {
                            status: 'connected',
                            userId: user.id,
                            userName: user.name
                        }
                    });
                    console.log(`WebSocket: User ${user.name} (${user.id}) authenticated and joined room`);
                    socket.broadcast.emit('friendStatusUpdate', {
                        userId: user.id,
                        isOnline: true,
                        lastSeen: new Date()
                    });
                }
                else {
                    socket.emit('auth_error', { message: 'Invalid user' });
                }
            }
            catch (error) {
                console.error('WebSocket user lookup error:', error);
                socket.emit('auth_error', { message: 'User lookup failed' });
            }
        });
    }
    else {
        socket.on('authenticate', async (token) => {
            try {
                const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'fallback-secret');
                const user = await exports.prisma.user.findUnique({
                    where: { id: decoded.userId },
                    select: { id: true, name: true, profileImage: true }
                });
                if (user) {
                    socket.data.userId = user.id;
                    socket.data.userName = user.name;
                    socket.data.profileImage = user.profileImage;
                    socket.join(`user_${user.id}`);
                    socket.emit('authenticated', { userId: user.id });
                    console.log(`WebSocket: User ${user.name} (${user.id}) authenticated`);
                }
                else {
                    socket.emit('auth_error', { message: 'Invalid user' });
                }
            }
            catch (error) {
                socket.emit('auth_error', { message: 'Invalid token' });
            }
        });
    }
    socket.on('location_update', async (data) => {
        await handleLocationUpdate(socket, data);
    });
    socket.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            if (data.latitude !== undefined && data.longitude !== undefined) {
                await handleLocationUpdate(socket, data);
            }
        }
        catch (error) {
            console.error('WebSocket: Failed to parse message:', error);
        }
    });
    async function handleLocationUpdate(socket, data) {
        if (!socket.data.userId) {
            socket.emit('error', { message: 'Not authenticated' });
            return;
        }
        try {
            console.log(`WebSocket: Location update from ${socket.data.userId}:`, data);
            const location = await exports.prisma.location.create({
                data: {
                    userId: socket.data.userId,
                    latitude: data.latitude,
                    longitude: data.longitude,
                    areaId: data.areaId || null
                }
            });
            const friends = await exports.prisma.friend.findMany({
                where: {
                    OR: [
                        { userId: socket.data.userId },
                        { friendId: socket.data.userId }
                    ]
                },
                include: {
                    user: { select: { id: true } },
                    friend: { select: { id: true } }
                }
            });
            const friendIds = [];
            friends.forEach(friend => {
                if (friend.userId === socket.data.userId && friend.friend) {
                    friendIds.push(friend.friend.id);
                }
                else if (friend.friendId === socket.data.userId && friend.user) {
                    friendIds.push(friend.user.id);
                }
            });
            const locationUpdateData = {
                action: 'friend_location_update',
                userId: socket.data.userId,
                userName: socket.data.userName,
                profileImage: socket.data.profileImage,
                latitude: data.latitude,
                longitude: data.longitude,
                areaId: data.areaId,
                timestamp: location.createdAt.getTime()
            };
            friendIds.forEach(friendId => {
                exports.io.to(`user_${friendId}`).emit('location', {
                    type: 'location',
                    data: locationUpdateData
                });
            });
            console.log(`WebSocket: Location update sent to ${friendIds.length} friends`);
        }
        catch (error) {
            console.error('WebSocket: Failed to process location update:', error);
            socket.emit('error', { message: 'Failed to update location' });
        }
    }
    socket.on('join', (userId) => {
        if (socket.data.userId === userId) {
            socket.join(`user_${userId}`);
            console.log(`WebSocket: User ${userId} joined their room`);
            socket.broadcast.emit('friendStatusUpdate', {
                userId: userId,
                isOnline: true,
                lastSeen: new Date()
            });
        }
    });
    socket.on('updateStatus', (data) => {
        if (socket.data.userId === data.userId) {
            socket.broadcast.emit('friendStatusUpdate', {
                userId: data.userId,
                isOnline: data.isOnline,
                lastSeen: data.lastSeen
            });
        }
    });
    socket.on('disconnect', () => {
        if (socket.data.userId) {
            socket.broadcast.emit('friendStatusUpdate', {
                userId: socket.data.userId,
                isOnline: false,
                lastSeen: new Date()
            });
            console.log(`WebSocket: User ${socket.data.userName} (${socket.data.userId}) disconnected`);
        }
    });
});
app.use(errorHandler_1.errorHandler);
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 CORS origin: ${process.env.CORS_ORIGIN || "http://localhost:8081"}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`☁️ Cloudinary config check:`, {
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? '✅' : '❌',
        api_key: process.env.CLOUDINARY_API_KEY ? '✅' : '❌',
        api_secret: process.env.CLOUDINARY_API_SECRET ? '✅' : '❌'
    });
});
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully');
    await exports.prisma.$disconnect();
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully');
    await exports.prisma.$disconnect();
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
process.on('uncaughtException', (error) => {
    console.error('🚨 Uncaught Exception:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});
exports.io.on('error', (error) => {
    console.error('🚨 WebSocket error:', error);
});
server.on('error', (error) => {
    console.error('🚨 Server error:', error);
});
