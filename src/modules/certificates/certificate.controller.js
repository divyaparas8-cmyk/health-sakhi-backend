const certificateService = require('./certificate.service');
const prisma = require('../../config/database');
const logger = require('../../utils/logger');

async function getCertificates(req, res, next) {
  try {
    const userId = req.user.id;
    const certificates = await certificateService.getUserCertificates(userId);
    return res.status(200).json({
      success: true,
      certificates
    });
  } catch (error) {
    logger.error(`[CertificateController] getCertificates error: ${error.message}`);
    next(error);
  }
}

async function checkCertificates(req, res, next) {
  try {
    const userId = req.user.id;
    const certificates = await certificateService.checkAndAwardCertificates(userId);
    return res.status(200).json({
      success: true,
      certificates
    });
  } catch (error) {
    logger.error(`[CertificateController] checkCertificates error: ${error.message}`);
    next(error);
  }
}

async function downloadCertificate(req, res, next) {
  try {
    const { id } = req.params; // unique certificateId e.g. HS-BASIC-...
    
    const cert = await prisma.certificate.findUnique({
      where: { certificateId: id },
      include: { user: { include: { profile: true } } }
    });

    if (!cert) {
      return res.status(404).json({
        success: false,
        message: 'Certificate not found.'
      });
    }

    const userName = cert.user?.profile?.fullName || 'Health Sakhi Member';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Certificate_${cert.level}_${id}.pdf`);

    certificateService.generateCertificatePdfStream(res, cert, userName);
  } catch (error) {
    logger.error(`[CertificateController] downloadCertificate error: ${error.message}`);
    next(error);
  }
}

module.exports = {
  getCertificates,
  checkCertificates,
  downloadCertificate
};
