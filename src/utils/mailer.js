const nodemailer = require('nodemailer');
const environment = require('../config/environment');
const logger = require('./logger');

const transporter = nodemailer.createTransport({
  host: environment.smtp.host,
  port: environment.smtp.port,
  auth: {
    user: environment.smtp.user,
    pass: environment.smtp.pass,
  },
});

const sendMail = async (to, subject, text, html) => {
  try {
    const info = await transporter.sendMail({
      from: environment.smtp.from,
      to,
      subject,
      text,
      html,
    });
    logger.info(`Email sent: ${info.messageId}`);
    return info;
  } catch (error) {
    logger.error(`Failed to send email to ${to}: ${error.message}`);
    if (environment.nodeEnv === 'production') {
      throw error;
    }
  }
};

module.exports = { sendMail };
