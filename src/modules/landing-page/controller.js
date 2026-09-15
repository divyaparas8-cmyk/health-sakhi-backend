const service = require('./service');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure upload directory
const uploadsDir = path.join(__dirname, '../../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage engine configuration
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
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const getPublicLandingPage = async (req, res, next) => {
  try {
    const pageData = await service.getLandingPage();
    res.status(200).json({ success: true, data: pageData });
  } catch (err) {
    next(err);
  }
};

const getAdminLandingPage = async (req, res, next) => {
  try {
    const sections = await service.getAdminLandingPage();
    res.status(200).json({ success: true, data: sections });
  } catch (err) {
    next(err);
  }
};

const createAdminSection = async (req, res, next) => {
  try {
    const { sectionKey, title, subtitle, description, imageUrl, buttonText, buttonLink, extraJson, isActive } = req.body;
    const section = await service.createSection({
      sectionKey,
      title,
      subtitle,
      description,
      imageUrl,
      buttonText,
      buttonLink,
      extraJson,
      isActive: isActive !== undefined ? isActive : true
    });
    res.status(201).json({ success: true, data: section });
  } catch (err) {
    next(err);
  }
};

const updateAdminSection = async (req, res, next) => {
  try {
    const key = req.params.key;
    const { title, subtitle, description, imageUrl, buttonText, buttonLink, extraJson, isActive } = req.body;
    
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (subtitle !== undefined) updateData.subtitle = subtitle;
    if (description !== undefined) updateData.description = description;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    if (buttonText !== undefined) updateData.buttonText = buttonText;
    if (buttonLink !== undefined) updateData.buttonLink = buttonLink;
    if (extraJson !== undefined) updateData.extraJson = extraJson;
    if (isActive !== undefined) updateData.isActive = isActive;

    const section = await service.updateSection(key, updateData);
    res.status(200).json({ success: true, data: section });
  } catch (err) {
    next(err);
  }
};

const uploadImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }
    const imageUrl = `/uploads/${req.file.filename}`;
    res.status(200).json({ success: true, imageUrl });
  } catch (err) {
    next(err);
  }
};

const resetAdminSection = async (req, res, next) => {
  try {
    const key = req.params.key;
    const section = await service.resetSection(key);
    res.status(200).json({ success: true, data: section });
  } catch (err) {
    next(err);
  }
};

const submitContactMessage = async (req, res, next) => {
  try {
    const { name, email, message, type, role, rating } = req.body;
    const newMessage = await service.createContactMessage(name, email, message, type, role, rating);
    res.status(201).json({ success: true, data: newMessage });
  } catch (err) {
    next(err);
  }
};

const getContactMessages = async (req, res, next) => {
  try {
    const messages = await service.getContactMessages();
    res.status(200).json({ success: true, data: messages });
  } catch (err) {
    next(err);
  }
};

const getApprovedFeedbacks = async (req, res, next) => {
  try {
    const feedbacks = await service.getApprovedFeedbacks();
    res.status(200).json({ success: true, data: feedbacks });
  } catch (err) {
    next(err);
  }
};

const approveContactMessage = async (req, res, next) => {
  try {
    const id = req.params.id;
    const updatedMessage = await service.updateContactMessageStatus(id, 'approved');
    res.status(200).json({ success: true, data: updatedMessage });
  } catch (err) {
    next(err);
  }
};

const markContactMessageAsRead = async (req, res, next) => {
  try {
    const id = req.params.id;
    const updatedMessage = await service.markContactMessageAsRead(id);
    res.status(200).json({ success: true, data: updatedMessage });
  } catch (err) {
    next(err);
  }
};

const deleteContactMessage = async (req, res, next) => {
  try {
    const id = req.params.id;
    await service.deleteContactMessage(id);
    res.status(200).json({ success: true, message: 'Message deleted successfully.' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getPublicLandingPage,
  getAdminLandingPage,
  createAdminSection,
  updateAdminSection,
  resetAdminSection,
  uploadImage,
  uploadMiddleware: upload.single('image'),
  submitContactMessage,
  getContactMessages,
  getApprovedFeedbacks,
  approveContactMessage,
  markContactMessageAsRead,
  deleteContactMessage
};
