const express = require('express');
const familyToolkitController = require('./familyToolkit.controller');
const authenticate = require('../../middlewares/authenticate');

const router = express.Router();

// Public / Member routes
router.get('/family-toolkits', familyToolkitController.getToolkits);
router.get('/family-toolkits/:idOrSlug', familyToolkitController.getToolkitById);

const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit for pdf/docx/images
});

// Admin Management routes
router.get('/admin/family-toolkits', authenticate, familyToolkitController.getToolkits);
router.post('/admin/family-toolkits', authenticate, familyToolkitController.createToolkit);
router.put('/admin/family-toolkits/:id', authenticate, familyToolkitController.updateToolkit);
router.delete('/admin/family-toolkits/:id', authenticate, familyToolkitController.deleteToolkit);
router.post('/admin/family-toolkits/upload', authenticate, upload.single('file'), familyToolkitController.uploadFile);

// Category routes
router.get('/family-toolkits/categories', familyToolkitController.getCategories);
router.post('/admin/family-toolkits/categories', authenticate, familyToolkitController.createCategory);
router.delete('/admin/family-toolkits/categories/:id', authenticate, familyToolkitController.deleteCategory);

module.exports = router;
