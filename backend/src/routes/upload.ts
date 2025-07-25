import express from 'express';
import { uploadSingle, handleUploadError } from '../middleware/upload';

const router = express.Router();

router.post('/upload', uploadSingle, handleUploadError, (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '画像がアップロードされていません。' });
  }

  const imageUrl = (req.file as any).path;
  return res.status(200).json({ image: { url: imageUrl } });
});

export default router;
