import { GoogleGenAI } from "@google/genai";

// Models to try in order — if one 404s we fall back to the next
const MODEL_CANDIDATES = [
  "gemini-3-flash-preview",
];


export const analyzePrescription = async (file) => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing Gemini API key. Create a .env file in the project root with:\nVITE_GEMINI_API_KEY=your_key_here"
    );
  }

  const ai = new GoogleGenAI({ apiKey });
  const base64Data = await fileToBase64(file);
  const mimeType = file.type;

  const prompt = `
You are a medical assistant AI with deep pharmacological knowledge.
Carefully analyze this prescription image and extract ALL medicines mentioned.

Return ONLY a valid JSON array — no explanation, no markdown fences, no extra text.

Required format:
[
  {
    "medicine_name": "Full medicine name with strength, e.g. Paracetamol 500mg",
    "dosage": "e.g. 1 tablet",
    "frequency": "e.g. 3 times a day",
    "timing": "e.g. After morning meal / Before bed",
    "duration": "e.g. 5 days"
  }
]

CRITICAL RULE: If ANY field is missing or unclear from the prescription, you MUST use your medical knowledge to suggest the most appropriate, medically safe default value based on the medicine name, its common usage, and standard prescribing practices. Do NOT ever return "Not specified" or leave any field empty. Every field must have a meaningful, helpful value.

Examples of smart defaults:
- Paracetamol with no timing → "After meals"
- Antibiotic with no frequency → "3 times a day (every 8 hours)"
- Vitamin D with no duration → "30 days (typical course)"
- Antacid with no timing → "Before meals"
  `.trim();

  const userModel = import.meta.env.VITE_GEMINI_MODEL;
  const modelsToTry = userModel
    ? [userModel, ...MODEL_CANDIDATES.filter((m) => m !== userModel)]
    : MODEL_CANDIDATES;

  let lastError = null;

  for (const modelName of modelsToTry) {
    try {
      const result = await callWithRetry(() =>
        ai.models.generateContent({
          model: modelName,
          contents: [
            {
              role: "user",
              parts: [
                { text: prompt },
                { inlineData: { mimeType, data: base64Data } },
              ],
            },
          ],
        })
      );

      const responseText =
        typeof result?.text === "function"
          ? result.text()
          : (result?.text ?? "");
      const jsonMatch = responseText.match(/\[[\s\S]*?\]/);
      if (!jsonMatch) return [];

      const medicines = JSON.parse(jsonMatch[0]);
      return Array.isArray(medicines) ? medicines : [];
    } catch (err) {
      lastError = err;
      const msg = err?.message || "";

      // 404 = model not available → try next model
      if (msg.includes("404") || msg.includes("not found")) {
        console.warn(`Model "${modelName}" not available, trying next…`);
        continue;
      }

      // For any other error, stop immediately and surface it
      break;
    }
  }

  // If we get here, every model failed
  const message = lastError?.message || "Unknown Gemini error";

  if (message.toLowerCase().includes("quota") || message.includes("429")) {
    throw new Error(
      "API quota exceeded. Your free-tier limit has been reached.\n" +
        "→ Enable billing at https://ai.google.dev or generate a new API key with available quota."
    );
  }

  throw new Error(message);
};


async function callWithRetry(fn, maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const is429 =
        err?.message?.includes("429") ||
        err?.message?.toLowerCase().includes("quota");

      if (is429 && attempt < maxRetries) {
        // wait progressively longer: 3 s, 6 s …
        const wait = (attempt + 1) * 3000;
        console.warn(`Rate-limited — retrying in ${wait / 1000}s…`);
        await sleep(wait);
        continue;
      }
      throw err;
    }
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Convert a File to a raw base64 string (no data-URI prefix) */
const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = (err) => reject(err);
  });