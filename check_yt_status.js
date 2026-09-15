const https = require('https');

const urls = [
  'https://www.youtube.com/embed/02f2b3wJtQs',
  'https://www.youtube.com/embed/QJm-48rC-E8',
  'https://www.youtube.com/embed/gJ246S_76rE',
  'https://www.youtube.com/embed/aP12n6-8qgM',
  'https://www.youtube.com/embed/y6yE7QG1y58',
  'https://www.youtube.com/embed/wL-L2tZ3q1g',
  'https://www.youtube.com/embed/lHJVfxqW76k',
  'https://www.youtube.com/embed/tEmt1MP_Zsk',
  'https://www.youtube.com/embed/c9nS5Z-C2uQ',
  'https://www.youtube.com/embed/Ab9OZsDECZw',
  'https://www.youtube.com/embed/WhxjXduD8qw',
  'https://www.youtube.com/embed/yqR77sa4EVE'
];

async function checkUrl(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (data.includes('Video unavailable') || data.includes('This video is private') || data.includes('This video is no longer available')) {
          resolve({ url, available: false });
        } else {
          resolve({ url, available: true });
        }
      });
    }).on('error', () => resolve({ url, available: false, error: true }));
  });
}

async function run() {
  for (const url of urls) {
    const status = await checkUrl(url);
    console.log(status.url, 'Available:', status.available);
  }
}

run();
