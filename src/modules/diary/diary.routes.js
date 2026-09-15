const express = require('express');
const controller = require('./diary.controller');
const authenticate = require('../../middlewares/authenticate');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Configure local uploads directory
const uploadsDir = path.join(__dirname, '../../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// All diary routes require authentication
router.use(authenticate);

router.get('/', controller.getDiaryEntries);
router.get('/by-date/:date', controller.getDiaryEntryByDate);
router.post('/', upload.array('reports', 5), controller.createOrUpdateDiaryEntry);
router.delete('/:id', controller.deleteDiaryEntry);
router.delete('/report/:reportId', controller.deleteDiaryReport);
router.get('/report/download', controller.downloadDoctorReport);

module.exports = router;
