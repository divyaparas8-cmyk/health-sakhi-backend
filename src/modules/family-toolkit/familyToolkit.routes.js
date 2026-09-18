const express = require('express');
const familyToolkitController = require('./familyToolkit.controller');
const authenticate = require('../../middlewares/authenticate');

const router = express.Router();

// Public / Member routes
router.get('/family-toolkits', familyToolkitController.getToolkits);
router.get('/family-toolkits/:idOrSlug', familyToolkitController.getToolkitById);

// Admin Management routes
router.get('/admin/family-toolkits', authenticate, familyToolkitController.getToolkits);
router.post('/admin/family-toolkits', authenticate, familyToolkitController.createToolkit);
router.put('/admin/family-toolkits/:id', authenticate, familyToolkitController.updateToolkit);
router.delete('/admin/family-toolkits/:id', authenticate, familyToolkitController.deleteToolkit);

module.exports = router;
