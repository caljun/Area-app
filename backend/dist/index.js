"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
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
const io = new socket_io_1.Server(server, {
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
app.use(limiter);
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
app.use('/api/friends', auth_2.authMiddleware, friends_1.default);
app.use('/api/locations', auth_2.authMiddleware, locations_1.default);
app.use('/api/images', images_1.default);
app.use('/api/notifications', auth_2.authMiddleware, notifications_1.default);
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    socket.on('authenticate', async (token) => {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'fallback-secret');
            const user = await exports.prisma.user.findUnique({
                where: { id: decoded.userId },
                select: { id: true, name: true }
            });
            if (user) {
                socket.data.userId = user.id;
                socket.data.userName = user.name;
                socket.emit('authenticated', { userId: user.id });
                console.log(`User ${user.name} (${user.id}) authenticated`);
            }
            else {
                socket.emit('auth_error', { message: 'Invalid user' });
            }
        }
        catch (error) {
            socket.emit('auth_error', { message: 'Invalid token' });
        }
    });
    socket.on('join', (userId) => {
        if (socket.data.userId === userId) {
            socket.join(`user_${userId}`);
            console.log(`User ${userId} joined their room`);
            socket.broadcast.emit('friendStatusUpdate', {
                userId: userId,
                isOnline: true,
                lastSeen: new Date()
            });
        }
    });
    socket.on('updateLocation', async (data) => {
        if (socket.data.userId === data.userId) {
            try {
                await exports.prisma.location.create({
                    data: {
                        userId: data.userId,
                        latitude: data.latitude,
                        longitude: data.longitude
                    }
                });
                socket.broadcast.emit('locationUpdate', {
                    ...data,
                    timestamp: new Date()
                });
            }
            catch (error) {
                console.error('Failed to save location:', error);
            }
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
            console.log(`User ${socket.data.userName} (${socket.data.userId}) disconnected`);
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
io.on('error', (error) => {
    console.error('🚨 WebSocket error:', error);
});
server.on('error', (error) => {
    console.error('🚨 Server error:', error);
});
