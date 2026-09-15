const ImageKit = require('imagekit');
const environment = require('./environment');
const logger = require('../utils/logger');

// Retrieve credentials
const { publicKey, privateKey, urlEndpoint } = environment.imagekit;

let imagekit = null;

if (!publicKey || !privateKey || !urlEndpoint || publicKey.includes('dummy') || privateKey.includes('dummy')) {
  logger.warn('ImageKit credentials are not configured or are using placeholders. ImageKit uploads will operate in mock mode.');
  
  // Mock imagekit client for development/fallback
  imagekit = {
    upload: async ({ file, fileName, folder }) => {
      logger.info(`[MOCK IMAGEKIT] Uploading file ${fileName} to folder ${folder}`);
      // Return a simulated URL using public placeholder endpoint or localhost
      const path = `/uploads/${fileName}`;
      return {
        url: `http://localhost:5000${path}`,
        filePath: path,
        name: fileName
      };
    }
  };
} else {
  imagekit = new ImageKit({
    publicKey,
    privateKey,
    urlEndpoint
  });
  logger.info('ImageKit SDK successfully initialized.');
}

module.exports = imagekit;
