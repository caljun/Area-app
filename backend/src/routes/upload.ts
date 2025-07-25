import express from 'express';
import { uploadSingle } from '../middleware/upload';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

router.post('/upload', authMiddleware, uploadSingle, async (req, res) => {
  if (!req.file) {
    console.log('❌ req.file is undefined');
    return res.status(400).json({ error: '画像ファイルが送信されていません（req.fileが空です）' });
  }

  console.log('✅ 受信ファイル:', req.file);
  console.log('📦 受信body:', req.body);

  const imageUrl = (req.file as any).path;
  return res.status(200).json({ image: { url: imageUrl } });
});

export default router;