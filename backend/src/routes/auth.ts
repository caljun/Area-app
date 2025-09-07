import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import multer from 'multer';
import { prisma } from '../index';
import { createError } from '../middleware/errorHandler';
import { authMiddleware, AuthRequest } from '../middleware/auth';

// JWTの型定義
interface JWTPayload {
  userId: string;
}

const router = Router();

// Multer設定（メモリストレージ）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    // 画像ファイルのみ許可
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('画像ファイルのみアップロード可能です'));
    }
  }
});

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('メールアドレスの形式が正しくありません'),
  areaId: z.string().min(3, 'Area IDは3文字以上で入力してください'),
  name: z.string().min(1, 'ユーザー名は必須です'),
  password: z.string().min(8, 'パスワードは8文字以上で入力してください'),
  profileImage: z.string().url('プロフィール画像のURLが正しくありません').optional()
});

// 5ステップ登録用のスキーマ
const step1Schema = z.object({
  email: z.string().email('メールアドレスの形式が正しくありません')
});

const step2Schema = z.object({
  email: z.string().email('メールアドレスの形式が正しくありません'),
  areaId: z.string().min(3, 'Area IDは3文字以上で入力してください')
});

const step3Schema = z.object({
  email: z.string().email('メールアドレスの形式が正しくありません'),
  areaId: z.string().min(3, 'Area IDは3文字以上で入力してください'),
  name: z.string().min(1, 'ユーザー名は必須です')
});

const step4Schema = z.object({
  email: z.string().email('メールアドレスの形式が正しくありません'),
  areaId: z.string().min(3, 'Area IDは3文字以上で入力してください'),
  name: z.string().min(1, 'ユーザー名は必須です'),
  password: z.string().min(8, 'パスワードは8文字以上で入力してください')
});

const step5Schema = z.object({
  email: z.string().email('メールアドレスの形式が正しくありません'),
  areaId: z.string().min(3, 'Area IDは3文字以上で入力してください'),
  name: z.string().min(1, 'ユーザー名は必須です'),
  password: z.string().min(8, 'パスワードは8文字以上で入力してください'),
  profileImage: z.string().url('プロフィール画像のURLが正しくありません').optional()
});

const loginSchema = z.object({
  email: z.string().email('メールアドレスの形式が正しくありません'),
  password: z.string().min(1, 'パスワードは必須です')
});

// Apple ID認証用のスキーマ
const appleAuthSchema = z.object({
  userID: z.string().min(1, 'Apple User IDは必須です'),
  name: z.string().optional(),
  email: z.string().email('メールアドレスの形式が正しくありません').optional(),
  identityToken: z.string().min(1, 'Apple IDトークンは必須です')
});

// Step 1: メールアドレス確認
router.post('/register/step1', async (req: Request, res: Response) => {
  try {
    const { email } = step1Schema.parse(req.body);

    // メールアドレスの重複チェック
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({
        error: 'このメールアドレスは既に登録されています'
      });
    }

    // 一時的な登録セッションを作成（実際の実装ではRedis等を使用）
    return res.status(200).json({
      message: 'メールアドレスが確認されました',
      email,
      nextStep: 'step2'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: '入力内容に問題があります',
        details: error.errors
      });
    }
    
    console.error('Step 1 error:', error);
    return res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// Step 2: Now ID確認
router.post('/register/step2', async (req: Request, res: Response) => {
  try {
    const { email, areaId } = step2Schema.parse(req.body);

    // Now IDの重複チェック
    const existingUser = await prisma.user.findUnique({
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
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: '入力内容に問題があります',
        details: error.errors
      });
    }
    
    console.error('Step 2 error:', error);
    return res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// Step 3: ユーザー名確認
router.post('/register/step3', async (req: Request, res: Response) => {
  try {
    const { email, areaId, name } = step3Schema.parse(req.body);

    return res.status(200).json({
      message: 'ユーザー名が確認されました',
      email,
      areaId,
      name,
      nextStep: 'step4'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: '入力内容に問題があります',
        details: error.errors
      });
    }
    
    console.error('Step 3 error:', error);
    return res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// Step 4: パスワード確認
router.post('/register/step4', async (req: Request, res: Response) => {
  try {
    const { email, areaId, name, password } = step4Schema.parse(req.body);

    return res.status(200).json({
      message: 'パスワードが確認されました',
      email,
      areaId,
      name,
      nextStep: 'step5'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: '入力内容に問題があります',
        details: error.errors
      });
    }
    
    console.error('Step 4 error:', error);
    return res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// Step 5: プロフィール画像設定とユーザー作成
router.post('/register/step5', async (req: Request, res: Response) => {
  try {
    const { email, areaId, name, password, profileImage } = step5Schema.parse(req.body);

    // 最終的な重複チェック
    const existingUser = await prisma.user.findFirst({
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

    // パスワードのハッシュ化
    const hashedPassword = await bcrypt.hash(password, 12);

    // ユーザー作成
    const user = await prisma.user.create({
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

    // JWTトークン生成
    const token = jwt.sign(
      { userId: user.id } as JWTPayload,
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as any
    );

    // 新規登録ユーザーの場合、プロフィールの完全性をチェック
    const missingFields = [];
    if (!user.name) missingFields.push('name');
    if (!user.areaId) missingFields.push('areaId');
    if (!user.profileImage) missingFields.push('profileImage');
    const profileComplete = missingFields.length === 0;

    return res.status(201).json({
      message: 'ユーザー登録が完了しました',
      user,
      token,
      nextStep: 'complete',
      profileComplete,
      missingFields
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: '入力内容に問題があります',
        details: error.errors
      });
    }
    
    console.error('Step 5 error:', error);
    return res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// 従来の登録エンドポイント（後方互換性のため）
router.post('/register', upload.single('profileImage'), async (req: Request, res: Response) => {
  try {
    console.log('Register request received:', { 
      email: req.body.email, 
      areaId: req.body.areaId, 
      name: req.body.name,
      hasPassword: !!req.body.password,
      hasProfileImage: !!req.body.profileImage,
      contentType: req.headers['content-type']
    });
    
    // マルチパートフォームデータの場合の処理
    let email, areaId, name, password, profileImage;
    
    if (req.headers['content-type']?.includes('multipart/form-data')) {
      console.log('Processing multipart form data');
      // マルチパートフォームデータから値を取得
      email = req.body.email;
      areaId = req.body.areaId;
      name = req.body.name;
      password = req.body.password;
      
      // 画像ファイルの処理
      if (req.file) {
        console.log('Image file received:', {
          fieldname: req.file.fieldname,
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size
        });
        // 画像ファイルの場合は、後でCloudinaryにアップロードする必要がある
        // 今は一時的にnullを設定
        profileImage = null;
      } else {
        profileImage = req.body.profileImage;
      }
      
      console.log('Extracted from multipart:', { email, areaId, name, hasPassword: !!password, hasProfileImage: !!profileImage, hasFile: !!req.file });
    } else {
      console.log('Processing JSON data');
      // 通常のJSONボディの場合
      const parsed = registerSchema.parse(req.body);
      email = parsed.email;
      areaId = parsed.areaId;
      name = parsed.name;
      password = parsed.password;
      profileImage = parsed.profileImage;
    }

    // マルチパートフォームデータの場合、手動でバリデーション
    if (req.headers['content-type']?.includes('multipart/form-data')) {
      if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'メールアドレスの形式が正しくありません' });
      }
      if (!areaId || areaId.length < 3) {
        return res.status(400).json({ error: 'Area IDは3文字以上で入力してください' });
      }
      if (!name || name.trim().length < 1) {
        return res.status(400).json({ error: 'ユーザー名は必須です' });
      }
      if (!password || password.length < 8) {
        return res.status(400).json({ error: 'パスワードは8文字以上で入力してください' });
      }
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { areaId }
        ]
      }
    });

    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(400).json({
          error: 'このメールアドレスは既に登録されています'
        });
      } else {
        return res.status(409).json({
          error: 'このArea IDは既に使用されています'
        });
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
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

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id } as JWTPayload,
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as any
    );

    // 新規登録ユーザーの場合、プロフィールの完全性をチェック
    const missingFields = [];
    if (!user.name) missingFields.push('name');
    if (!user.areaId) missingFields.push('areaId');
    if (!user.profileImage) missingFields.push('profileImage');
    const profileComplete = missingFields.length === 0;

    return res.status(201).json({
      message: 'ユーザー登録が完了しました',
      user: {
        id: user.id,
        email: user.email,
        areaId: user.areaId,
        name: user.name,
        profileImage: user.profileImage,
        createdAt: user.createdAt
      },
      token,
      isNewUser: true,
      profileComplete,
      missingFields
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: '入力内容に問題があります',
        details: error.errors
      });
    }
    
    console.error('Register error:', error);
    return res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// Apple ID認証
router.post('/apple', async (req: Request, res: Response) => {
  try {
    const { userID, name, email, identityToken } = appleAuthSchema.parse(req.body);

    console.log('Apple ID認証リクエスト:', { userID, name, email });

    // Apple IDのidentityTokenを検証
    try {
      // Appleの公開鍵を取得（タイムアウト設定）
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒タイムアウト
      
      const appleKeysResponse = await fetch('https://appleid.apple.com/auth/keys', {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (!appleKeysResponse.ok) {
        throw new Error('Apple公開鍵の取得に失敗しました');
      }
      
      const appleKeys = await appleKeysResponse.json() as { keys: Array<{ kid: string; n: string; e: string; alg: string }> };
      
      // identityTokenのヘッダーを解析してkid（Key ID）を取得
      const tokenHeader = JSON.parse(Buffer.from(identityToken.split('.')[0], 'base64').toString());
      const kid = tokenHeader.kid;
      
      // 対応する公開鍵を探す
      const publicKey = appleKeys.keys.find((key) => key.kid === kid);
      if (!publicKey) {
        throw new Error('対応するApple公開鍵が見つかりません');
      }
      
      // Apple公開鍵をJWT検証用の形式に変換
      const jwkToPem = require('jwk-to-pem');
      const pemPublicKey = jwkToPem(publicKey);
      
      // JWTを検証
      const decoded = jwt.verify(identityToken, pemPublicKey, {
        algorithms: ['RS256'],
        audience: 'com.junya.area', // あなたのBundle ID
        issuer: 'https://appleid.apple.com'
      }) as any;
      
      console.log('Apple IDトークン検証成功:', { sub: decoded.sub, aud: decoded.aud });
      
      // userIDが一致するかチェック
      if (decoded.sub !== userID) {
        return res.status(401).json({ error: 'Apple IDトークンが無効です' });
      }
      
    } catch (jwtError: any) {
      console.error('Apple IDトークン検証エラー:', jwtError);
      if (jwtError.name === 'AbortError') {
        return res.status(504).json({ error: 'Apple IDトークンの検証がタイムアウトしました' });
      }
      return res.status(401).json({ error: 'Apple IDトークンの検証に失敗しました' });
    }

    // areaIdが提供されていない場合、userIDをareaIdとして使用
    const finalAreaId = userID;

    try {
      // Apple User IDまたはArea IDで既存ユーザーを検索
      let user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: `apple_${userID}@temp.com` }, // Apple IDユーザー用の一時メール
            { areaId: finalAreaId } // 指定されたArea IDまたはUser ID
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
        // 既存ユーザーの場合、ログイン
        const token = jwt.sign(
          { userId: user.id } as JWTPayload,
          process.env.JWT_SECRET || 'fallback-secret',
          { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as any
        );

        // プロフィールの完全性をチェック
        const missingFields = [];
        if (!user.name) missingFields.push('name');
        if (!user.areaId) missingFields.push('areaId');
        if (!user.profileImage) missingFields.push('profileImage');
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
      } else {
        // 新規ユーザーの場合、Area IDの重複チェック
        const existingAreaId = await prisma.user.findUnique({
          where: { areaId: finalAreaId }
        });

        if (existingAreaId) {
          return res.status(400).json({
            error: 'このArea IDは既に使用されています'
          });
        }

        // 新規ユーザー作成（パスワードなし）
        const newUser = await prisma.user.create({
          data: {
            email: `apple_${userID}@temp.com`, // Apple IDユーザー用の一時メール
            areaId: finalAreaId,
            name: name || `Apple User ${userID.slice(-4)}`, // 名前がない場合はデフォルト名
            password: null, // Apple IDユーザーはパスワードなし
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

        const token = jwt.sign(
          { userId: newUser.id } as JWTPayload,
          process.env.JWT_SECRET || 'fallback-secret',
          { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as any
        );

        // 新規ユーザーの場合、プロフィールは不完全
        const missingFields = ['profileImage']; // プロフィール画像が未設定
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
    } catch (dbError) {
      console.error('データベース操作エラー:', dbError);
      return res.status(503).json({ error: 'データベース接続エラーが発生しました' });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
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

// この重複したエンドポイントは削除（上記の従来の登録エンドポイントを使用）

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません' });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id } as JWTPayload,
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as any
    );

    // プロフィールの完全性をチェック
    const missingFields = [];
    if (!user.name) missingFields.push('name');
    if (!user.areaId) missingFields.push('areaId');
    if (!user.profileImage) missingFields.push('profileImage');
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
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: '入力内容に問題があります',
        details: error.errors
      });
    }
    
    console.error('Login error:', error);
    return res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// Get current user
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // 最新のユーザー情報を取得（profileImageを含む）
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        areaId: true,
        name: true,
        profileImage: true,
        createdAt: true
      }
    });
    
    // プロフィールの完全性をチェック
    const missingFields = [];
    if (!user.name) missingFields.push('name');
    if (!user.areaId) missingFields.push('areaId');
    if (!user.profileImage) missingFields.push('profileImage');
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
  } catch (error) {
    console.error('Get current user error:', error);
    return res.status(500).json({ error: 'ユーザー情報の取得に失敗しました' });
  }
});

// Session validation endpoint
router.get('/session', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // トークンが有効な場合、ユーザー情報を返す
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        areaId: true,
        name: true,
        profileImage: true,
        createdAt: true
      }
    });
    
    // プロフィールの完全性をチェック
    const missingFields = [];
    if (!user.name) missingFields.push('name');
    if (!user.areaId) missingFields.push('areaId');
    if (!user.profileImage) missingFields.push('profileImage');
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
  } catch (error) {
    console.error('Session validation error:', error);
    return res.status(500).json({ error: 'セッション検証に失敗しました' });
  }
});

export default router; 