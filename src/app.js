const express = require('express');
// Nodemon trigger comment
const cors = require('cors');
const helmet = require('helmet');
const loggingMiddleware = require('./middlewares/logging');
const { errorHandler } = require('./middlewares/errorHandler');
const environment = require('./config/environment');
const authRoutes = require('./modules/auth/auth.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const membersRoutes = require('./modules/members/members.routes');
const aiSakhiRoutes = require('./modules/ai-sakhi/ai-sakhi.routes');
const aiRoutes = require('./modules/ai/routes/ai.routes');
const advisorsRoutes = require('./modules/advisors/advisors.routes');
const contentRoutes = require('./modules/content/content.routes');
const affiliateRoutes = require('./modules/affiliate/affiliate.routes');
const notificationRoutes = require('./modules/notifications/notifications.routes');
const i18nRoutes = require('./modules/i18n/i18n.routes');
const analyticsRoutes = require('./modules/analytics/analytics.routes');
const subscriptionsRoutes = require('./modules/subscriptions/subscriptions.routes');
const landingPageRoutes = require('./modules/landing-page/routes');
const contentAssetRoutes = require('./modules/content-asset/contentAsset.routes');
const periodRoutes = require('./modules/period/period.routes');
const chatbotRoutes = require('./modules/chatbot/chatbot.routes');
const communityRoutes = require('./modules/community/community.routes');
const faqRoutes = require('./modules/faq/faq.routes');
const blogRoutes = require('./modules/blog/blog.routes');
const certificatesRoutes = require('./modules/certificates/certificate.routes');
const diaryRoutes = require('./modules/diary/diary.routes');
const familyToolkitRoutes = require('./modules/family-toolkit/familyToolkit.routes');
const { autoTranslateMiddleware } = require('./middlewares/translation');
const path = require('path');

const app = express();

// 1. Secure application with Helmet headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false,
  xFrameOptions: false
}));

// 2. Enable Cross-Origin Resource Sharing
app.use(cors({
  origin: environment.corsOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 3. Request parsing payloads setup
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 4. Mount Morgan HTTP logger middleware
app.use(loggingMiddleware);

// Global AI response translation middleware
app.use(autoTranslateMiddleware);

// 5. Base System Health-Check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: environment.nodeEnv,
    uptime: process.uptime()
  });
});

// 6. Base API entry info endpoint
app.get('/api/v1', (req, res) => {
  res.status(200).json({
    message: 'Welcome to the health sakhi kend API Portal',
    version: '1.0.0'
  });
});

// Mount modular routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/members', membersRoutes);
app.use('/api/v1/ai-sakhi', aiSakhiRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1', advisorsRoutes);
app.use('/api/v1/content', contentRoutes);
app.use('/api/v1/affiliate', affiliateRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1', i18nRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/subscriptions', subscriptionsRoutes);
app.use('/api/v1', landingPageRoutes);
app.use('/api/v1', contentAssetRoutes);
app.use('/api/v1/period', periodRoutes);
app.use('/api/v1/community', communityRoutes);
app.use('/api/v1', faqRoutes);
app.use('/api/v1', blogRoutes);
app.use('/api', chatbotRoutes);
app.use('/api/v1', chatbotRoutes);
app.use('/api/v1/certificates', certificatesRoutes);
app.use('/api/v1/diary', diaryRoutes);
app.use('/api/v1', familyToolkitRoutes);
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 7. Global catch-all error handling middleware
app.use(errorHandler);


module.exports = app;
