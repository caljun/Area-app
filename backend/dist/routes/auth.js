"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const index_1 = require("../index");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const registerSchema = zod_1.z.object({
    email: zod_1.z.string().email('メールアドレスの形式が正しくありません'),
    areaId: zod_1.z.string().min(3, 'Area IDは3文字以上で入力してください'),
    name: zod_1.z.string().min(1, 'ユーザー名は必須です'),
    password: zod_1.z.string().min(6, 'パスワードは6文字以上で入力してください'),
    profileImage: zod_1.z.string().url('プロフィール画像のURLが正しくありません').optional()
});
const step1Schema = zod_1.z.object({
    email: zod_1.z.string().email('メールアドレスの形式が正しくありません')
});
const step2Schema = zod_1.z.object({
    email: zod_1.z.string().email('メールアドレスの形式が正しくありません'),
    areaId: zod_1.z.string().min(3, 'Area IDは3文字以上で入力してください')
});
const step3Schema = zod_1.z.object({
    email: zod_1.z.string().email('メールアドレスの形式が正しくありません'),
    areaId: zod_1.z.string().min(3, 'Area IDは3文字以上で入力してください'),
    name: zod_1.z.string().min(1, 'ユーザー名は必須です')
});
const step4Schema = zod_1.z.object({
    email: zod_1.z.string().email('メールアドレスの形式が正しくありません'),
    areaId: zod_1.z.string().min(3, 'Area IDは3文字以上で入力してください'),
    name: zod_1.z.string().min(1, 'ユーザー名は必須です'),
    password: zod_1.z.string().min(6, 'パスワードは6文字以上で入力してください')
});
const step5Schema = zod_1.z.object({
    email: zod_1.z.string().email('メールアドレスの形式が正しくありません'),
    areaId: zod_1.z.string().min(3, 'Area IDは3文字以上で入力してください'),
    name: zod_1.z.string().min(1, 'ユーザー名は必須です'),
    password: zod_1.z.string().min(6, 'パスワードは6文字以上で入力してください'),
    profileImage: zod_1.z.string().url('プロフィール画像のURLが正しくありません').optional()
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email('メールアドレスの形式が正しくありません'),
    password: zod_1.z.string().min(1, 'パスワードは必須です')
});
const appleAuthSchema = zod_1.z.object({
    userID: zod_1.z.string().min(1, 'Apple User IDは必須です'),
    name: zod_1.z.string().optional(),
    email: zod_1.z.string().email('メールアドレスの形式が正しくありません').optional(),
    identityToken: zod_1.z.string().min(1, 'Apple IDトークンは必須です')
});
router.post('/register/step1', async (req, res) => {
    try {
        const { email } = step1Schema.parse(req.body);
        const existingUser = await index_1.prisma.user.findUnique({
            where: { email }
        });
        if (existingUser) {
            return res.status(400).json({
                error: 'このメールアドレスは既に登録されています'
            });
        }
        return res.status(200).json({
            message: 'メールアドレスが確認されました',
            email,
            nextStep: 'step2'
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                error: '入力内容に問題があります',
                details: error.errors
            });
        }
        console.error('Step 1 error:', error);
        return res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});
router.post('/register/step2', async (req, res) => {
    try {
        const { email, areaId } = step2Schema.parse(req.body);
        const existingUser = await index_1.prisma.user.findUnique({
            where: { areaId }
        });
        if (existingUser) {
            return res.status(400).json({
                error: 'このNow IDは既に使用されています'
            });
        }
        return res.status(200).json({
            message: 'Now IDが確認されました',
            email,
            areaId,
            nextStep: 'step3'
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                error: '入力内容に問題があります',
                details: error.errors
            });
        }
        console.error('Step 2 error:', error);
        return res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});
router.post('/register/step3', async (req, res) => {
    try {
        const { email, areaId, name } = step3Schema.parse(req.body);
        return res.status(200).json({
            message: 'ユーザー名が確認されました',
            email,
            areaId,
            name,
            nextStep: 'step4'
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                error: '入力内容に問題があります',
                details: error.errors
            });
        }
        console.error('Step 3 error:', error);
        return res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});
router.post('/register/step4', async (req, res) => {
    try {
        const { email, areaId, name, password } = step4Schema.parse(req.body);
        return res.status(200).json({
            message: 'パスワードが確認されました',
            email,
            areaId,
            name,
            nextStep: 'step5'
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                error: '入力内容に問題があります',
                details: error.errors
            });
        }
        console.error('Step 4 error:', error);
        return res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});
router.post('/register/step5', async (req, res) => {
    try {
        const { email, areaId, name, password, profileImage } = step5Schema.parse(req.body);
        const existingUser = await index_1.prisma.user.findFirst({
            where: {
                OR: [
                    { email },
                    { areaId }
                ]
            }
        });
        if (existingUser) {
            return res.status(400).json({
                error: existingUser.email === email ? 'このメールアドレスは既に登録されています' : 'このNow IDは既に使用されています'
            });
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 12);
        const user = await index_1.prisma.user.create({
            data: {
                email,
                areaId,
                name,
                password: hashedPassword,
                profileImage: profileImage || null
            },
            select: {
                id: true,
                email: true,
                areaId: true,
                name: true,
                profileImage: true,
                createdAt: true
            }
        });
        const token = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.JWT_SECRET || 'fallback-secret', { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
        const missingFields = [];
        if (!user.name)
            missingFields.push('name');
        if (!user.areaId)
            missingFields.push('areaId');
        if (!user.profileImage)
            missingFields.push('profileImage');
        const profileComplete = missingFields.length === 0;
        return res.status(201).json({
            message: 'ユーザー登録が完了しました',
            user,
            token,
            nextStep: 'complete',
            profileComplete,
            missingFields
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                error: '入力内容に問題があります',
                details: error.errors
            });
        }
        console.error('Step 5 error:', error);
        return res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});
router.post('/register', async (req, res) => {
    try {
        const { email, areaId, name, password, profileImage } = registerSchema.parse(req.body);
        const existingUser = await index_1.prisma.user.findFirst({
            where: {
                OR: [
                    { email },
                    { areaId }
                ]
            }
        });
        if (existingUser) {
            return res.status(400).json({
                error: existingUser.email === email ? 'このメールアドレスは既に登録されています' : 'このArea IDは既に使用されています'
            });
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 12);
        const user = await index_1.prisma.user.create({
            data: {
                email,
                areaId,
                name,
                password: hashedPassword,
                profileImage: profileImage || null
            },
            select: {
                id: true,
                email: true,
                areaId: true,
                name: true,
                profileImage: true,
                createdAt: true
            }
        });
        const token = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.JWT_SECRET || 'fallback-secret', { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
        const missingFields = [];
        if (!user.name)
            missingFields.push('name');
        if (!user.areaId)
            missingFields.push('areaId');
        if (!user.profileImage)
            missingFields.push('profileImage');
        const profileComplete = missingFields.length === 0;
        return res.status(201).json({
            message: 'ユーザー登録が完了しました',
            user,
            token,
            profileComplete,
            missingFields
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                error: '入力内容に問題があります',
                details: error.errors
            });
        }
        console.error('Register error:', error);
        return res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});
router.post('/apple', async (req, res) => {
    try {
        const { userID, name, email, identityToken } = appleAuthSchema.parse(req.body);
        console.log('Apple ID認証リクエスト:', { userID, name, email });
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);
            const appleKeysResponse = await fetch('https://appleid.apple.com/auth/keys', {
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!appleKeysResponse.ok) {
                throw new Error('Apple公開鍵の取得に失敗しました');
            }
            const appleKeys = await appleKeysResponse.json();
            const tokenHeader = JSON.parse(Buffer.from(identityToken.split('.')[0], 'base64').toString());
            const kid = tokenHeader.kid;
            const publicKey = appleKeys.keys.find((key) => key.kid === kid);
            if (!publicKey) {
                throw new Error('対応するApple公開鍵が見つかりません');
            }
            const jwkToPem = require('jwk-to-pem');
            const pemPublicKey = jwkToPem(publicKey);
            const decoded = jsonwebtoken_1.default.verify(identityToken, pemPublicKey, {
                algorithms: ['RS256'],
                audience: 'com.junya.area',
                issuer: 'https://appleid.apple.com'
            });
            console.log('Apple IDトークン検証成功:', { sub: decoded.sub, aud: decoded.aud });
            if (decoded.sub !== userID) {
                return res.status(401).json({ error: 'Apple IDトークンが無効です' });
            }
        }
        catch (jwtError) {
            console.error('Apple IDトークン検証エラー:', jwtError);
            if (jwtError.name === 'AbortError') {
                return res.status(504).json({ error: 'Apple IDトークンの検証がタイムアウトしました' });
            }
            return res.status(401).json({ error: 'Apple IDトークンの検証に失敗しました' });
        }
        const finalAreaId = userID;
        try {
            let user = await index_1.prisma.user.findFirst({
                where: {
                    OR: [
                        { email: `apple_${userID}@temp.com` },
                        { areaId: finalAreaId }
                    ]
                },
                select: {
                    id: true,
                    email: true,
                    areaId: true,
                    name: true,
                    profileImage: true,
                    createdAt: true
                }
            });
            if (user) {
                const token = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.JWT_SECRET || 'fallback-secret', { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
                const missingFields = [];
                if (!user.name)
                    missingFields.push('name');
                if (!user.areaId)
                    missingFields.push('areaId');
                if (!user.profileImage)
                    missingFields.push('profileImage');
                const profileComplete = missingFields.length === 0;
                return res.json({
                    token,
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
            else {
                const existingAreaId = await index_1.prisma.user.findUnique({
                    where: { areaId: finalAreaId }
                });
                if (existingAreaId) {
                    return res.status(400).json({
                        error: 'このArea IDは既に使用されています'
                    });
                }
                const newUser = await index_1.prisma.user.create({
                    data: {
                        email: `apple_${userID}@temp.com`,
                        areaId: finalAreaId,
                        name,
                        password: null,
                        profileImage: null
                    },
                    select: {
                        id: true,
                        email: true,
                        areaId: true,
                        name: true,
                        profileImage: true,
                        createdAt: true
                    }
                });
                const token = jsonwebtoken_1.default.sign({ userId: newUser.id }, process.env.JWT_SECRET || 'fallback-secret', { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
                const missingFields = ['profileImage'];
                const profileComplete = false;
                return res.status(201).json({
                    token,
                    user: {
                        id: newUser.id,
                        email: newUser.email,
                        areaId: newUser.areaId,
                        name: newUser.name,
                        profileImage: newUser.profileImage,
                        createdAt: newUser.createdAt
                    },
                    isNewUser: true,
                    profileComplete,
                    missingFields
                });
            }
        }
        catch (dbError) {
            console.error('データベース操作エラー:', dbError);
            return res.status(503).json({ error: 'データベース接続エラーが発生しました' });
        }
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            console.error('Apple ID認証バリデーションエラー:', error.errors);
            return res.status(400).json({
                error: '入力内容に問題があります',
                details: error.errors
            });
        }
        console.error('Apple ID認証エラー:', error);
        return res.status(500).json({ error: 'Apple ID認証に失敗しました' });
    }
});
router.post('/register', async (req, res) => {
    try {
        const { email, password, areaId, name, profileImage } = registerSchema.parse(req.body);
        const existingUser = await index_1.prisma.user.findUnique({
            where: { email }
        });
        if (existingUser) {
            return res.status(400).json({
                error: 'このメールアドレスは既に登録されています'
            });
        }
        const existingAreaId = await index_1.prisma.user.findUnique({
            where: { areaId }
        });
        if (existingAreaId) {
            return res.status(409).json({
                error: 'このArea IDは既に使用されています'
            });
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 12);
        const user = await index_1.prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                areaId,
                name,
                profileImage: profileImage || null
            },
            select: {
                id: true,
                email: true,
                areaId: true,
                name: true,
                profileImage: true,
                createdAt: true
            }
        });
        const token = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.JWT_SECRET || 'fallback-secret', { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
        const missingFields = [];
        if (!user.name)
            missingFields.push('name');
        if (!user.areaId)
            missingFields.push('areaId');
        if (!user.profileImage)
            missingFields.push('profileImage');
        const profileComplete = missingFields.length === 0;
        return res.status(201).json({
            token,
            user: {
                id: user.id,
                email: user.email,
                areaId: user.areaId,
                name: user.name,
                profileImage: user.profileImage,
                createdAt: user.createdAt
            },
            isNewUser: true,
            profileComplete,
            missingFields
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                error: '入力内容に問題があります',
                details: error.errors
            });
        }
        console.error('Register error:', error);
        return res.status(500).json({ error: 'ユーザー登録に失敗しました' });
    }
});
router.post('/login', async (req, res) => {
    try {
        const { email, password } = loginSchema.parse(req.body);
        const user = await index_1.prisma.user.findUnique({
            where: { email }
        });
        if (!user) {
            return res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません' });
        }
        const isPasswordValid = await bcryptjs_1.default.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません' });
        }
        const token = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.JWT_SECRET || 'fallback-secret', { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
        const missingFields = [];
        if (!user.name)
            missingFields.push('name');
        if (!user.areaId)
            missingFields.push('areaId');
        if (!user.profileImage)
            missingFields.push('profileImage');
        const profileComplete = missingFields.length === 0;
        return res.json({
            token,
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
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                error: '入力内容に問題があります',
                details: error.errors
            });
        }
        console.error('Login error:', error);
        return res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});
router.get('/me', auth_1.authMiddleware, async (req, res) => {
    try {
        const user = await index_1.prisma.user.findUnique({
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
        console.error('Get current user error:', error);
        return res.status(500).json({ error: 'ユーザー情報の取得に失敗しました' });
    }
});
router.get('/session', auth_1.authMiddleware, async (req, res) => {
    try {
        const user = await index_1.prisma.user.findUnique({
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
exports.default = router;
