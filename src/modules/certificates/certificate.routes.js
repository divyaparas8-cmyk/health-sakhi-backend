const express = require('express');
const authenticate = require('../../middlewares/authenticate');
const controller = require('./certificate.controller');

const router = express.Router();

// Get certificates and check certificates require authentication
router.use(authenticate);

router.get('/', controller.getCertificates);
router.post('/check', controller.checkCertificates);

// Downloading PDF certificate (Public or Authenticated, we verify standard parameter validation)
router.get('/:id/download', controller.downloadCertificate);

module.exports = router;
