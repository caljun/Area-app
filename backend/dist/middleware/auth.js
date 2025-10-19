"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const index_1 = require("../index");
const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: '認証が必要です' });
        }
        const token = authHeader.substring(7);
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            return res.status(500).json({ error: 'サーバー設定エラー' });
        }
        const decoded = jsonwebtoken_1.default.verify(token, secret);
        const user = await index_1.prisma.user.findUnique({
            where: { id: decoded.userId },
            select: {
                id: true,
                email: true,
                displayId: true,
                areaId: true,
                name: true
            }
        });
        if (!user) {
            return res.status(401).json({ error: 'ユーザーが見つかりません' });
        }
        req.user = user;
        return next();
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            return res.status(401).json({ error: '認証トークンが無効です' });
        }
        if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            return res.status(401).json({ error: '認証トークンの有効期限が切れています' });
        }
        console.error('Auth middleware error:', error);
        return res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
};
exports.authMiddleware = authMiddleware;
