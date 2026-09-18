const express = require('express');
const familyToolkitController = require('./familyToolkit.controller');
const authenticate = require('../../middlewares/authenticate');

const router = express.Router();

// Category routes (must be declared BEFORE :idOrSlug and :id wildcard routes)
router.get('/family-toolkits/categories', familyToolkitController.getCategories);
router.post('/admin/family-toolkits/categories', authenticate, familyToolkitController.createCategory);
router.put('/admin/family-toolkits/categories/:id', authenticate, familyToolkitController.updateCategory);
router.delete('/admin/family-toolkits/categories/:id', authenticate, familyToolkitController.deleteCategory);

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
router.post('/admin/family-toolkits/upload', authenticate, upload.single('file'), familyToolkitController.uploadFile);
router.put('/admin/family-toolkits/:id', authenticate, familyToolkitController.updateToolkit);
router.delete('/admin/family-toolkits/:id', authenticate, familyToolkitController.deleteToolkit);

module.exports = router;
