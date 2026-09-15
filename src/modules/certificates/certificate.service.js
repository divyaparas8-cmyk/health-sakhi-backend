const prisma = require('../../config/database');
const logger = require('../../utils/logger');
const PDFDocument = require('pdfkit');

const PLAN_HIERARCHY = {
  'free-sakhi': 1,
  'basic-sakhi': 2,
  'premium-sakhi': 3
};

/**
 * Checks eligibility and awards new certificates.
 * Can be triggered after login tracking, book completion, or referral milestones.
 */
async function checkAndAwardCertificates(userId) {
  try {
    logger.info(`[CertificateService] Checking certificate eligibility for user: ${userId}`);

    // Fetch user, profile, active subscription, and existing certificates
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        subscriptions: {
          where: { status: 'ACTIVE' },
          include: { plan: true },
          orderBy: { createdAt: 'desc' }
        },
        certificates: true
      }
    });

    if (!user || !user.profile) {
      throw new Error('User or profile not found');
    }

    // Determine current plan slug
    const activeSub = user.subscriptions[0];
    const planSlug = activeSub && activeSub.plan ? activeSub.plan.slug : 'free-sakhi';

    // Current metrics
    const books = user.profile.booksCompleted || 0;
    const logins = user.profile.loginDays || 0;
    const referrals = user.profile.referralCount || 0;

    const existingLevels = user.certificates.map(c => c.level);
    const newAwards = [];

    // Level 1: Basic Wellness Certificate
    if (!existingLevels.includes('basic')) {
      const planEligible = planSlug === 'basic-sakhi' || planSlug === 'premium-sakhi';
      if (books >= 5 && logins >= 15 && planEligible) {
        newAwards.push({
          level: 'basic',
          title: 'Health Sakhi Basic Wellness Certificate'
        });
      }
    }

    // Level 2: Advance Wellness Certificate
    if (!existingLevels.includes('advance')) {
      const planEligible = planSlug === 'basic-sakhi' || planSlug === 'premium-sakhi';
      if (books >= 15 && logins >= 30 && planEligible) {
        newAwards.push({
          level: 'advance',
          title: 'Health Sakhi Advance Wellness Certificate'
        });
      }
    }

    // Level 3: Gold Ambassador Certificate
    if (!existingLevels.includes('gold')) {
      const planEligible = planSlug === 'premium-sakhi';
      if (books >= 25 && logins >= 30 && referrals >= 10 && planEligible) {
        newAwards.push({
          level: 'gold',
          title: 'Health Sakhi Gold Ambassador Certificate'
        });
      }
    }

    // Level 4: Platinum Health Leader Certificate
    if (!existingLevels.includes('platinum')) {
      const planEligible = planSlug === 'premium-sakhi';
      if (books >= 40 && logins >= 60 && referrals >= 25 && planEligible) {
        newAwards.push({
          level: 'platinum',
          title: 'Platinum Health Leader Certificate'
        });
      }
    }

    // Insert newly awarded certificates
    for (const award of newAwards) {
      const uniqueId = `HS-${award.level.toUpperCase()}-${userId.substring(0, 5).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
      await prisma.certificate.create({
        data: {
          userId,
          level: award.level,
          title: award.title,
          certificateId: uniqueId,
          pdfUrl: `/api/v1/certificates/${uniqueId}/download`
        }
      });
      logger.info(`[CertificateService] Awarded ${award.level} certificate (${uniqueId}) to user ${userId}`);
    }

    // Return all certificates for user
    return await prisma.certificate.findMany({
      where: { userId },
      orderBy: { issuedAt: 'asc' }
    });

  } catch (error) {
    logger.error(`[CertificateService] Error checking/awarding certificates: ${error.message}`);
    throw error;
  }
}

/**
 * Get all certificates unlocked by the user.
 */
async function getUserCertificates(userId) {
  return await prisma.certificate.findMany({
    where: { userId },
    orderBy: { issuedAt: 'asc' }
  });
}

const path = require('path');
const fs = require('fs');

/**
 * Generates a high-quality, ultra-premium PDF certificate.
 */
function generateCertificatePdfStream(res, certificate, userName) {
  const doc = new PDFDocument({
    layout: 'landscape',
    size: 'A4',
    margins: { top: 25, bottom: 25, left: 25, right: 25 }
  });

  doc.pipe(res);

  const pageWidth = doc.page.width;   // 841.89 pt
  const pageHeight = doc.page.height; // 595.28 pt
  const level = (certificate.level || 'basic').toLowerCase();

  // ── Level Specific Color & Design Themes ─────────────────────────────────
  const themes = {
    basic: {
      bg: '#FFFDF9',
      borderPrimary: '#E91E63',
      borderSecondary: '#D4AF37',
      headerText: '#E91E63',
      titleText: '#4B1E5A',
      nameText: '#E91E63',
      accentText: '#D4AF37',
      badgeBg: '#FCE4EC',
      badgeBorder: '#F8BBD0',
      badgeText: '#C2185B',
      badgeTitle: 'BASIC WELLNESS GRADUATE',
      levelTitle: 'BASIC WELLNESS CERTIFICATE',
      desc: 'For successfully completing the starter module of HealthSakhi wellness curriculum, reading foundational health literature, and maintaining a 15-day daily active habit streak.',
      metric1: '• 5+ Books Completed',
      metric2: '• 15 Active Days Streak',
      metric3: '• Basic Clinical Verified'
    },
    advance: {
      bg: '#F8FAFC',
      borderPrimary: '#1A237E',
      borderSecondary: '#00838F',
      headerText: '#1A237E',
      titleText: '#0F172A',
      nameText: '#1A237E',
      accentText: '#00838F',
      badgeBg: '#E0F2FE',
      badgeBorder: '#BAE6FD',
      badgeText: '#0369A1',
      badgeTitle: 'ADVANCE HEALTH MASTER',
      levelTitle: 'ADVANCE WELLNESS CERTIFICATE',
      desc: 'For demonstrating consistent commitment to personal health, completing 15+ comprehensive wellness manuals, and maintaining an active 30-day health habit log.',
      metric1: '• 15+ Books Completed',
      metric2: '• 30 Active Days Streak',
      metric3: '• Advance Clinical Verified'
    },
    gold: {
      bg: '#FFFDF0',
      borderPrimary: '#D4AF37',
      borderSecondary: '#B8860B',
      headerText: '#B8860B',
      titleText: '#3B2F00',
      nameText: '#B8860B',
      accentText: '#D4AF37',
      badgeBg: '#FEF3C7',
      badgeBorder: '#FDE68A',
      badgeText: '#92400E',
      badgeTitle: 'GOLD AMBASSADOR VIP',
      levelTitle: 'GOLD AMBASSADOR CERTIFICATE',
      desc: 'In recognition of outstanding community leadership, maintaining elite health standards (25+ books & 30-day streak), and mentoring 10+ community sakhis.',
      metric1: '• 25+ Books Completed',
      metric2: '• 30 Active Days Streak',
      metric3: '• 10+ Referrals Mentored'
    },
    platinum: {
      bg: '#FAF5FF',
      borderPrimary: '#4A148C',
      borderSecondary: '#AB47BC',
      headerText: '#4A148C',
      titleText: '#2E1065',
      nameText: '#4A148C',
      accentText: '#AB47BC',
      badgeBg: '#F3E8FF',
      badgeBorder: '#E9D5FF',
      badgeText: '#6B21A8',
      badgeTitle: 'PLATINUM SUPREME LEADER',
      levelTitle: 'PLATINUM HEALTH LEADER CERTIFICATE',
      desc: 'For supreme wellness execution, reading 40+ books, 60-day streak maintenance, mentoring 25+ sakhis, and serving as an official certified HealthSakhi Master Leader.',
      metric1: '• 40+ Books Completed',
      metric2: '• 60 Active Days Streak',
      metric3: '• 25+ Referrals Mentored'
    }
  };

  const theme = themes[level] || themes.basic;

  // 1. Background Fill
  doc.rect(0, 0, pageWidth, pageHeight).fill(theme.bg);

  // 2. Dual Ornamental Outer & Inner Borders
  const outerM = 18;
  const innerM = 24;

  // Outer Border
  doc.rect(outerM, outerM, pageWidth - outerM * 2, pageHeight - outerM * 2)
     .lineWidth(3.5)
     .stroke(theme.borderPrimary);

  // Inner Border
  doc.rect(innerM, innerM, pageWidth - innerM * 2, pageHeight - innerM * 2)
     .lineWidth(1.2)
     .stroke(theme.borderSecondary);

  // Corner Accents (Decorative Boxes in 4 corners)
  const cSize = 12;
  const corners = [
    { x: innerM + 4, y: innerM + 4 },
    { x: pageWidth - innerM - 4 - cSize, y: innerM + 4 },
    { x: innerM + 4, y: pageHeight - innerM - 4 - cSize },
    { x: pageWidth - innerM - 4 - cSize, y: pageHeight - innerM - 4 - cSize }
  ];

  corners.forEach(c => {
    doc.rect(c.x, c.y, cSize, cSize)
       .lineWidth(1)
       .stroke(theme.borderPrimary);
  });

  // 3. HealthSakhi Logo Image
  const logoPath = path.join(__dirname, '../../../../frontenhealth/public/Images/WhatsApp Image 2026-05-04 at 6.32.54 PM.jpeg');

  if (fs.existsSync(logoPath)) {
    try {
      // Background Watermark Emblem (opacity 0.05)
      doc.save();
      doc.opacity(0.04);
      doc.image(logoPath, pageWidth / 2 - 130, pageHeight / 2 - 120, { width: 260 });
      doc.restore();

      // Top Center Main Logo Header
      doc.image(logoPath, pageWidth / 2 - 40, 36, { width: 80 });
    } catch (imgErr) {
      logger.error(`[CertificateService] Failed to load logo image: ${imgErr.message}`);
    }
  }

  // 4. Organization Header
  doc.fillColor(theme.headerText)
     .fontSize(11)
     .font('Helvetica-Bold')
     .text('HEALTH SAKHI WELLNESS PLATFORM', 0, 126, { align: 'center', characterSpacing: 2.5 });

  // 5. Certificate Main Title
  doc.fillColor(theme.titleText)
     .fontSize(34)
     .font('Helvetica-Bold')
     .text('CERTIFICATE OF ACHIEVEMENT', 0, 146, { align: 'center', characterSpacing: 1.5 });

  // Subtitle / Level Title
  doc.fillColor(theme.accentText)
     .fontSize(13)
     .font('Helvetica-Bold')
     .text(theme.levelTitle, 0, 188, { align: 'center', characterSpacing: 2 });

  // 6. Recipient Greeting
  doc.fillColor('#64748B')
     .fontSize(12)
     .font('Helvetica-Oblique')
     .text('This certificate is proudly awarded to', 0, 216, { align: 'center' });

  // 7. Recipient Name (Bold, Large & Uppercase)
  const nameY = 238;
  doc.fillColor(theme.nameText)
     .fontSize(30)
     .font('Helvetica-Bold')
     .text((userName || 'HEALTH SAKHI MEMBER').toUpperCase(), 0, nameY, { align: 'center' });

  // Center Underline with Decorative Diamond Node
  const lineY = nameY + 38;
  doc.moveTo(pageWidth / 2 - 160, lineY)
     .lineTo(pageWidth / 2 + 160, lineY)
     .lineWidth(1)
     .stroke(theme.borderSecondary);

  doc.rect(pageWidth / 2 - 5, lineY - 5, 10, 10)
     .fillAndStroke(theme.borderPrimary, theme.borderSecondary);

  // 8. Achievement Paragraph Description
  doc.fillColor('#334155')
     .fontSize(11.5)
     .font('Helvetica')
     .text(theme.desc, pageWidth / 2 - 270, lineY + 18, {
       width: 540,
       align: 'center',
       lineGap: 5
     });

  // 9. Middle Accomplishments Card Container (Fills middle gap elegantly)
  const metricY = lineY + 68;
  const metricWidth = 540;
  const metricX = pageWidth / 2 - metricWidth / 2;
  const metricHeight = 36;

  // Background Box for Accomplishments
  doc.roundedRect(metricX, metricY, metricWidth, metricHeight, 8)
     .fillAndStroke(theme.badgeBg, theme.badgeBorder);

  // Metric 1: Books
  doc.fillColor(theme.badgeText)
     .fontSize(9.5)
     .font('Helvetica-Bold')
     .text(theme.metric1, metricX + 15, metricY + 12, { width: 160, align: 'center' });

  // Separator Line 1
  doc.moveTo(metricX + 180, metricY + 6)
     .lineTo(metricX + 180, metricY + metricHeight - 6)
     .lineWidth(0.8)
     .stroke(theme.badgeBorder);

  // Metric 2: Streak
  doc.fillColor(theme.badgeText)
     .fontSize(9.5)
     .font('Helvetica-Bold')
     .text(theme.metric2, metricX + 190, metricY + 12, { width: 160, align: 'center' });

  // Separator Line 2
  doc.moveTo(metricX + 360, metricY + 6)
     .lineTo(metricX + 360, metricY + metricHeight - 6)
     .lineWidth(0.8)
     .stroke(theme.badgeBorder);

  // Metric 3: Verification
  doc.fillColor(theme.badgeText)
     .fontSize(9.5)
     .font('Helvetica-Bold')
     .text(theme.metric3, metricX + 370, metricY + 12, { width: 155, align: 'center' });

  // 10. Bottom Footer Section (Metadata, Seal Stamp & Signatures)
  const footerY = pageHeight - 90;

  // ── Left: Certificate Metadata ──
  doc.fillColor('#64748B')
     .fontSize(8.5)
     .font('Helvetica-Bold')
     .text(`ISSUE DATE: ${certificate.issuedAt ? new Date(certificate.issuedAt).toLocaleDateString() : new Date().toLocaleDateString()}`, 48, footerY);

  doc.text(`CERTIFICATE ID: ${certificate.certificateId}`, 48, footerY + 14);

  doc.fillColor('#10B981')
     .fontSize(8.5)
     .font('Helvetica-Bold')
     .text('VERIFIED CLINICAL CREDENTIAL', 48, footerY + 28);

  // ── Center: Embossed Seal Badge ──
  const sealX = pageWidth / 2;
  const sealY = footerY + 14;

  // Ribbon Tails
  doc.moveTo(sealX - 12, sealY + 15)
     .lineTo(sealX - 18, sealY + 32)
     .lineTo(sealX - 8, sealY + 28)
     .lineTo(sealX - 2, sealY + 34)
     .fill(theme.borderPrimary);

  doc.moveTo(sealX + 12, sealY + 15)
     .lineTo(sealX + 18, sealY + 32)
     .lineTo(sealX + 8, sealY + 28)
     .lineTo(sealX + 2, sealY + 34)
     .fill(theme.borderPrimary);

  // Seal Outer Circle
  doc.circle(sealX, sealY, 23)
     .lineWidth(1.8)
     .stroke(theme.borderSecondary);

  doc.circle(sealX, sealY, 20)
     .lineWidth(0.8)
     .stroke(theme.borderPrimary);

  // Seal Inner Fill
  doc.circle(sealX, sealY, 18)
     .fill(theme.badgeBg);

  // Seal Star & Text
  doc.fillColor(theme.badgeText)
     .fontSize(6)
     .font('Helvetica-Bold')
     .text('OFFICIAL', sealX - 18, sealY - 8, { width: 36, align: 'center' })
     .text('SEAL', sealX - 18, sealY, { width: 36, align: 'center' })
     .text('* * *', sealX - 18, sealY + 8, { width: 36, align: 'center' });

  // ── Right: Signature Line ──
  const sigX = pageWidth - 215;

  doc.moveTo(sigX, footerY + 12)
     .lineTo(sigX + 165, footerY + 12)
     .lineWidth(1)
     .stroke(theme.borderSecondary);

  doc.fillColor('#0F172A')
     .fontSize(10.5)
     .font('Helvetica-Bold')
     .text('DR. PRATAP MADHUKAR', sigX, footerY + 16, { width: 165, align: 'center' });

  doc.fillColor('#64748B')
     .fontSize(8)
     .font('Helvetica')
     .text('Founder & Chief Medical Advisor, HealthSakhi', sigX, footerY + 28, { width: 165, align: 'center' });

  doc.end();
}

module.exports = {
  checkAndAwardCertificates,
  getUserCertificates,
  generateCertificatePdfStream
};
