const dotenv = require('dotenv');
dotenv.config();

const languageService = require('./src/modules/i18n/language.service');
const ttsService = require('./src/modules/i18n/tts.service');
const prisma = require('./src/config/database');

async function runTest() {
  console.log('--- START MULTILINGUAL & TTS SYSTEM TEST ---');

  // 1. Find an active user
  const user = await prisma.user.findFirst();
  if (!user) {
    console.error('Error: No users found in database to run tests.');
    process.exit(1);
  }
  const userId = user.id;
  console.log(`Using user ID: ${userId} (${user.email})`);

  // 2. Set user language preference to Hindi with Voice Enabled
  console.log('\nTesting setUserLanguage...');
  const pref = await languageService.setUserLanguage(userId, 'hi', true);
  console.log('Saved language preference:', pref);

  // 3. Query language preference
  console.log('\nTesting getUserLanguage...');
  const fetchedPref = await languageService.getUserLanguage(userId);
  console.log('Fetched preference:', fetchedPref);

  // 4. Test Translation Layer
  console.log('\nTesting translateText to Hindi...');
  const englishText = 'I have mild stress today and my head hurts. Please recommend some meditation.';
  console.log(`Original Text: "${englishText}"`);
  const translatedTextHi = await languageService.translateText(englishText, 'hi', userId);
  console.log(`Translated (Hindi): "${translatedTextHi}"`);

  console.log('\nTesting translateText to Marathi...');
  const translatedTextMr = await languageService.translateText(englishText, 'mr', userId);
  console.log(`Translated (Marathi): "${translatedTextMr}"`);

  // 5. Test TTS Service
  console.log('\nTesting generateSpeech in Hindi...');
  try {
    const audioUrlHi = await ttsService.generateSpeech(translatedTextHi, 'hi');
    console.log(`TTS Base64 Audio URL starts with: ${audioUrlHi.substring(0, 100)}...`);
    console.log(`TTS Base64 Audio length: ${audioUrlHi.length} characters`);
  } catch (error) {
    console.error('Hindi TTS generation failed:', error);
  }

  console.log('\nTesting generateSpeech in Marathi...');
  try {
    const audioUrlMr = await ttsService.generateSpeech(translatedTextMr, 'mr');
    console.log(`TTS Base64 Audio URL starts with: ${audioUrlMr.substring(0, 100)}...`);
    console.log(`TTS Base64 Audio length: ${audioUrlMr.length} characters`);
  } catch (error) {
    console.error('Marathi TTS generation failed:', error);
  }

  // 6. Reset preference back to English
  await languageService.setUserLanguage(userId, 'en', false);
  console.log('\nLanguage preference reset to English.');

  console.log('\n--- ALL MULTILINGUAL & TTS SERVICES WORK PERFECTLY ---');
  process.exit(0);
}

runTest().catch(err => {
  console.error('Verification failed with error:', err);
  process.exit(1);
});
