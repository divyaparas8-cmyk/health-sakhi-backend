const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

(async () => {
  try {
    console.log("Testing gemini-2.5-flash...");
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent('Hello');
    console.log("Success with gemini-2.5-flash:", result.response.text());
  } catch (err) {
    console.error("Gemini failed:", err.message);
  }
})();
