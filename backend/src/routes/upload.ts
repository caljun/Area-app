import express from 'express';
import { uploadSingle, handleUploadError } from '../middleware/upload';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

router.post(
  '/upload',
  authMiddleware,
  uploadSingle,
  handleUploadError, // ← これが超重要
  async (req, res) => {
    try {
      if (!req.file) {
        console.error('❌ req.file is undefined');
        return res.status(400).json({
          error: '画像ファイルが送信されていません（req.fileが空です）',
        });
      }

      console.log('✅ Cloudinaryアップロード成功');
      console.log('📂 受信ファイル情報:', req.file);
      console.log('📝 リクエストbody:', req.body);

      const imageUrl = (req.file as any).path;

      return res.status(200).json({
        image: { url: imageUrl },
      });
    } catch (err: any) {
      console.error('❌ アップロード後処理でエラー:', err?.message || err);
      return res.status(503).json({
        error: 'アップロード後の処理に失敗しました',
        message: err?.message || 'Unknown error',
      });
    }
  }
);

export default router;
