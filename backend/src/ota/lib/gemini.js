const { GoogleGenerativeAI } = require('@google/generative-ai');

let cached = null;

function getModel() {
  if (cached) return cached;
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set in .env');
  const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  const genAI = new GoogleGenerativeAI(key);
  cached = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0,
    },
  });
  return cached;
}

async function extractJson(prompt) {
  const model = getModel();
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error(`Gemini did not return valid JSON: ${text.slice(0, 200)}`);
  }
}

module.exports = { getModel, extractJson };
