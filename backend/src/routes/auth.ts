import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../index';
import { createError } from '../middleware/errorHandler';
import { authMiddleware, AuthRequest } from '../middleware/auth';

// JWTの型定義
interface JWTPayload {
  userId: string;
}

const router = Router();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('メールアドレスの形式が正しくありません'),
  areaId: z.string().min(3, 'Area IDは3文字以上で入力してください'),
  name: z.string().min(1, 'ユーザー名は必須です'),
  password: z.string().min(6, 'パスワードは6文字以上で入力してください'),
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
  password: z.string().min(6, 'パスワードは6文字以上で入力してください')
});

const step5Schema = z.object({
  email: z.string().email('メールアドレスの形式が正しくありません'),
  areaId: z.string().min(3, 'Area IDは3文字以上で入力してください'),
  name: z.string().min(1, 'ユーザー名は必須です'),
  password: z.string().min(6, 'パスワードは6文字以上で入力してください'),
  profileImage: z.string().url('プロフィール画像のURLが正しくありません').optional()
});

const loginSchema = z.object({
  email: z.string().email('メールアドレスの形式が正しくありません'),
  password: z.string().min(1, 'パスワードは必須です')
});

// Apple ID認証用のスキーマ
const appleAuthSchema = z.object({
  userID: z.string().min(1, 'Apple User IDは必須です'),
  name: z.string().min(1, 'ユーザー名は必須です'),
  token: z.string().optional(), // フロントエンドから送信されるが使用しない
  identityToken: z.string().min(1, 'Apple IDトークンは必須です'),
  areaId: z.string().min(3, 'Area IDは3文字以上で入力してください').optional()
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

    return res.status(201).json({
      message: 'ユーザー登録が完了しました',
      user,
      token,
      nextStep: 'complete'
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
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, areaId, name, password, profileImage } = registerSchema.parse(req.body);

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
      return res.status(400).json({
        error: existingUser.email === email ? 'このメールアドレスは既に登録されています' : 'このArea IDは既に使用されています'
      });
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

    return res.status(201).json({
      message: 'ユーザー登録が完了しました',
      user,
      token
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
    const { userID, name, identityToken, areaId } = appleAuthSchema.parse(req.body);

    console.log('Apple ID認証リクエスト:', { userID, name, areaId });

    // 注意: 実際の実装では、Apple IDのidentityTokenを検証する必要があります
    // ここでは簡略化しています

    // areaIdが提供されていない場合、userIDをareaIdとして使用
    const finalAreaId = areaId || userID;

    // Apple User IDまたはArea IDで既存ユーザーを検索
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: `apple_${userID}@temp.com` }, // Apple IDユーザー用の一時メール
          { areaId: finalAreaId } // 指定されたArea IDまたはUser ID
        ]
      }
    });

    if (user) {
      // 既存ユーザーの場合、ログイン
      const token = jwt.sign(
        { userId: user.id } as JWTPayload,
        process.env.JWT_SECRET || 'fallback-secret',
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as any
      );

      return res.json({
        message: 'Apple IDでログインしました',
        user: {
          id: user.id,
          email: user.email,
          areaId: user.areaId,
          name: user.name,
          profileImage: user.profileImage
        },
        token,
        isNewUser: false
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
          name,
          password: '', // Apple IDユーザーはパスワードなし
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

      return res.status(201).json({
        message: 'Apple IDでユーザー登録が完了しました',
        user: newUser,
        token,
        isNewUser: true
      });
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

    return res.json({
      message: 'ログインに成功しました',
      user: {
        id: user.id,
        email: user.email,
        areaId: user.areaId,
        name: user.name,
        profileImage: user.profileImage
      },
      token
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
    
    return res.json({ user });
  } catch (error) {
    console.error('Get current user error:', error);
    return res.status(500).json({ error: 'ユーザー情報の取得に失敗しました' });
  }
});

export default router; 