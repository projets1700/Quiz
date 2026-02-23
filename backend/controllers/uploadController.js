/**
 * Upload de médias (images, vidéos) pour les questions de quiz.
 * Stockage local dans uploads/media/
 */

const path = require('path');
const fs = require('fs');
const multer = require('multer');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'media');
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 Mo
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100 Mo

const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const VIDEO_EXT = ['.mp4', '.avi', '.webm', '.mov'];

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname || '') || '.bin').toLowerCase();
    const base = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    cb(null, base + ext);
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const isImage = IMAGE_EXT.includes(ext);
  const isVideo = VIDEO_EXT.includes(ext);
  if (isImage || isVideo) {
    cb(null, true);
  } else {
    cb(new Error(`Format non accepté. Images : ${IMAGE_EXT.join(', ')}. Vidéos : ${VIDEO_EXT.join(', ')}`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_VIDEO_SIZE },
});

function uploadMedia(req, res) {
  if (!req.file) {
    return res.status(400).json({ message: 'Aucun fichier envoyé' });
  }
  const url = `/uploads/media/${req.file.filename}`;
  return res.status(201).json({ url });
}

module.exports = {
  upload,
  uploadMedia,
};
