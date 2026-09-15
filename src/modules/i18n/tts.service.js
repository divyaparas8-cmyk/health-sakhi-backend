const logger = require('../../utils/logger');

function cleanMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/[#*`~_]/g, '')
    .trim();
}

function splitTextIntoChunks(text, maxLength = 200) {
  // Split text by sentence/clause boundaries: . ? ! । \n ,
  const sentences = text.match(/[^.!?।\n,，]+[.!?।\n,，]*\s*/g) || [text];
  const chunks = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length <= maxLength) {
      currentChunk += sentence;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      if (sentence.length > maxLength) {
        // If a single sentence is longer than maxLength, split it by spaces
        let words = sentence.split(/\s+/);
        currentChunk = '';
        for (const word of words) {
          if ((currentChunk + ' ' + word).length <= maxLength) {
            currentChunk += (currentChunk ? ' ' : '') + word;
          } else {
            if (currentChunk) {
              chunks.push(currentChunk.trim());
            }
            currentChunk = word;
          }
        }
      } else {
        currentChunk = sentence;
      }
    }
  }
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }
  return chunks.filter(c => c.length > 0);
}

/**
 * Generate speech as a base64 Data URI from text using ElevenLabs API (or fallback to Google Translate TTS).
 * - English ('en') -> Simran Voice (ID: 4QmRQP2RqsuTD7HT9MkW)
 * - Hindi ('hi') / Marathi ('mr') -> Prajakta Voice (ID: P0TQBmxaqqw6qfDmK2xb)
 */
async function generateSpeech(text, language = 'en') {
  if (!text) {
    throw new Error('Text is required for TTS generation.');
  }

  const cleanedText = cleanMarkdown(text);
  const langLower = (language || 'en').toLowerCase();

  // Voice Selection based on Language
  // English -> Simran (4QmRQP2RqsuTD7HT9MkW)
  // Hindi & Marathi -> Prajakta (P0TQBmxaqqw6qfDmK2xb)
  const defaultSimranVoice = '4QmRQP2RqsuTD7HT9MkW';
  const defaultPrajaktaVoice = 'P0TQBmxaqqw6qfDmK2xb';

  const voiceId = langLower === 'en'
    ? (process.env.ELEVENLABS_VOICE_ENGLISH || defaultSimranVoice)
    : (process.env.ELEVENLABS_VOICE_HINDI_MARATHI || defaultPrajaktaVoice);

  const apiKey = (process.env.ELEVENLABS_API_KEY || '').trim();

  // Attempt ElevenLabs TTS if API Key is available
  if (apiKey) {
    try {
      logger.info(`Generating ElevenLabs TTS for language '${langLower}' using Voice ID: ${voiceId}`);
      const chunks = splitTextIntoChunks(cleanedText, 800);
      const buffers = [];

      for (const chunk of chunks) {
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': apiKey,
            'Accept': 'audio/mpeg'
          },
          body: JSON.stringify({
            text: chunk,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75
            }
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`ElevenLabs API error (${response.status}): ${errText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        buffers.push(Buffer.from(arrayBuffer));
      }

      const combinedBuffer = Buffer.concat(buffers);
      return `data:audio/mpeg;base64,${combinedBuffer.toString('base64')}`;
    } catch (elevenErr) {
      logger.error(`ElevenLabs TTS failed, falling back to Google TTS: ${elevenErr.message}`);
    }
  } else {
    logger.info(`ELEVENLABS_API_KEY not set or empty. Using fallback Google TTS for language '${langLower}' with target voice ID: ${voiceId}`);
  }

  // Fallback: Google Translate TTS
  const chunks = splitTextIntoChunks(cleanedText, 200);
  logger.info(`Generating fallback Google TTS for ${chunks.length} chunks in language: ${langLower}`);

  const buffers = [];
  for (const chunk of chunks) {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${langLower}&client=tw-ob&q=${encodeURIComponent(chunk)}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to generate speech for chunk. Status: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    buffers.push(Buffer.from(arrayBuffer));
  }

  const combinedBuffer = Buffer.concat(buffers);
  return `data:audio/mpeg;base64,${combinedBuffer.toString('base64')}`;
}

module.exports = {
  generateSpeech
};
