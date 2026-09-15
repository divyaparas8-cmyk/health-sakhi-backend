const fs = require('fs');
const path = require('path');
const ImageKit = require('imagekit');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Load existing parsed items
const parsedItems = JSON.parse(fs.readFileSync('C:\\Users\\FALCON JNB\\.gemini\\antigravity-ide\\brain\\5cea804c-4073-466e-9a52-c613c4623062\\scratch\\parsed_100_messages.json', 'utf8'));

// Build dictionary for existing days
const messagesMap = {};
parsedItems.forEach(item => {
  let text = item.message.replace(/next 15/gi, '').trim();
  if (!text.endsWith('❤️') && !text.endsWith('❤️.')) {
    text += ' ❤️';
  }
  messagesMap[item.day] = {
    day: item.day,
    title: item.title.trim(),
    message: text
  };
});

// Generated fallback messages for missing days 11 to 70
const missingThemes = [
  { title: "Nourish Your Body With Love", body: "Dear Sister, choose food, movement, and rest that honor your body today. You deserve to feel energized, whole, and deeply cared for. With lots of love and affection, Your HealthSakhi ❤️" },
  { title: "Your Peace Is Sacred", body: "Dear Sister, protect your peace as fiercely as you protect those you love. Say no to drama, overthinking, and negativity today. With lots of love and affection, Your HealthSakhi ❤️" },
  { title: "Rest Without Guilt", body: "Dear Sister, resting is not laziness; it is essential self-preservation. Take a deep breath and give your body the rest it longs for today. With lots of love and affection, Your HealthSakhi ❤️" },
  { title: "You Inspire Those Around You", body: "Dear Sister, your quiet resilience, kindness, and gentle care light up more lives than you know. Thank you for being you. With lots of love and affection, Your HealthSakhi ❤️" },
  { title: "Embrace Your Inner Wisdom", body: "Dear Sister, your intuition and inner voice are powerful guides. Trust what your heart is telling you about your health and path. With lots of love and affection, Your HealthSakhi ❤️" },
  { title: "Celebrate Small Victories", body: "Dear Sister, every step forward—no matter how small—is progress worth celebrating. Be proud of how far you have come today. With lots of love and affection, Your HealthSakhi ❤️" },
  { title: "Forgive Your Mistakes", body: "Dear Sister, you are human, learning, and growing every single day. Forgive yourself for past mistakes and embrace today anew. With lots of love and affection, Your HealthSakhi ❤️" },
  { title: "Hydrate and Flourish", body: "Dear Sister, treat your body like a blooming garden. Drink water, breathe deeply, and nourish yourself with sunshine and smiles today. With lots of love and affection, Your HealthSakhi ❤️" },
  { title: "Set Healthy Boundaries", body: "Dear Sister, setting boundaries is an act of self-respect, not selfishness. You have every right to protect your time and emotional space. With lots of love and affection, Your HealthSakhi ❤️" },
  { title: "Your Journey Is Unique", body: "Dear Sister, stop comparing your chapter 1 to someone else's chapter 20. Your unique healing journey is beautiful and unfolding at the right pace. With lots of love and affection, Your HealthSakhi ❤️" },
  { title: "Smile at Your Reflection", body: "Dear Sister, look into the mirror today and send love to the brave woman looking back at you. She has survived 100% of her hard days. With lots of love and affection, Your HealthSakhi ❤️" },
  { title: "Hormonal Harmony Begins Within", body: "Dear Sister, listen to your body's subtle rhythms. Gentle movement, quality sleep, and reduced stress bring balance to your cycle and mind. With lots of love and affection, Your HealthSakhi ❤️" },
  { title: "You Are a Beacon of Hope", body: "Dear Sister, even in moments of shadow, your inner light shines bright. Keep believing in better tomorrows and brighter days. With lots of love and affection, Your HealthSakhi ❤️" },
  { title: "Practice Self-Compassion", body: "Dear Sister, whenever self-doubt creeps in, treat yourself with the exact same tenderness you offer to your dearest family. With lots of love and affection, Your HealthSakhi ❤️" },
  { title: "Breathe Away The Tension", body: "Dear Sister, take 3 slow, deep breaths right now. Inhale peace, exhale tension. Let your shoulders drop and feel your body settle into peace. With lots of love and affection, Your HealthSakhi ❤️" }
];

// Fill all 100 days
const final100Messages = [];
for (let day = 1; day <= 100; day++) {
  if (messagesMap[day]) {
    final100Messages.push(messagesMap[day]);
  } else {
    const themeIdx = (day - 11) % missingThemes.length;
    const theme = missingThemes[themeIdx];
    final100Messages.push({
      day: day,
      title: theme.title,
      message: theme.body
    });
  }
}

console.log(`Generated ${final100Messages.length} messages.`);

// Save locally to frontend data dir and backend dir
const frontendDataDir = path.join(__dirname, '../../healthsakhi-frontend-17-7-26/src/data');
if (!fs.existsSync(frontendDataDir)) {
  fs.mkdirSync(frontendDataDir, { recursive: true });
}
const localJsonPath = path.join(frontendDataDir, 'daily_messages_100.json');
fs.writeFileSync(localJsonPath, JSON.stringify(final100Messages, null, 2));
console.log(`Saved local JSON to ${localJsonPath}`);

// Initialize ImageKit
const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT
});

// Upload to ImageKit
const jsonBuffer = Buffer.from(JSON.stringify(final100Messages, null, 2));

imagekit.upload({
  file: jsonBuffer,
  fileName: 'daily_messages_100.json',
  folder: '/healthsakhi_assets',
  useUniqueFileName: false
}, function(error, result) {
  if (error) {
    console.error('ImageKit upload error:', error);
  } else {
    console.log('\n========================================');
    console.log('SUCCESS! ImageKit Upload Result:');
    console.log('File ID:', result.fileId);
    console.log('ImageKit URL Link:', result.url);
    console.log('========================================\n');
  }
});
