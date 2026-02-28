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
    "name": "Full medicine name with strength, e.g. Paracetamol 500mg",
    "dosage": "e.g. 1 tablet or 5 ml",
    "frequency": "once / twice / thrice (use these exact words)",
    "timing": ["morning", "afternoon", "evening"],
    "numberOfDays": 7,
    "note": "Brief usage instruction, e.g. Take after meals with water",
    "scheduledTimes": {
      "morning": "08:00",
      "afternoon": "13:00",
      "evening": "18:00"
    }
  }
]

FIELD RULES:
- "name": Full medicine name including strength/form (e.g. "Amoxicillin 500mg Capsule").
- "dosage": Amount per dose (e.g. "1 tablet", "5 ml", "2 capsules").
- "frequency": Use ONLY "once", "twice", or "thrice".
- "timing": Array containing ONLY "morning", "afternoon", and/or "evening" based on frequency.
  - once → pick the most appropriate single timing ["morning"] or ["evening"]
  - twice → ["morning", "evening"]
  - thrice → ["morning", "afternoon", "evening"]
- "numberOfDays": Integer number of days. Convert weeks/months to days.
- "note": Practical instructions (before/after meals, with water, avoid alcohol, etc.)
- "scheduledTimes": Map ONLY the timings present in the timing array. Use 24-hour format.
  - morning → "08:00", afternoon → "13:00", evening → "18:00" (defaults)
  - Only include keys that are in the timing array.

CRITICAL RULE: If ANY field is missing or unclear from the prescription, you MUST use your medical knowledge to suggest the most appropriate, medically safe default value. Do NOT ever return empty fields. Every field must have a meaningful value.

Examples of smart defaults:
- Paracetamol with no timing → frequency "thrice", timing ["morning","afternoon","evening"]
- Antibiotic with no frequency → frequency "thrice"
- Vitamin D with no duration → numberOfDays 30
- Antacid with no note → note "Take before meals"
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

      // Strip markdown fences if present
      let cleaned = responseText
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/g, "")
        .trim();

      // Extract the JSON array — use a bracket-counting approach
      // to handle nested objects/arrays correctly
      const startIdx = cleaned.indexOf("[");
      if (startIdx === -1) return [];

      let depth = 0;
      let endIdx = -1;
      for (let i = startIdx; i < cleaned.length; i++) {
        if (cleaned[i] === "[") depth++;
        else if (cleaned[i] === "]") {
          depth--;
          if (depth === 0) { endIdx = i; break; }
        }
      }
      if (endIdx === -1) return [];

      const jsonStr = cleaned.substring(startIdx, endIdx + 1);
      const medicines = JSON.parse(jsonStr);
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


/**
 * Generate a balanced diet plan based on the user's medicines.
 * @param {Array} medicines - Array of { name, dosage, frequency, timing, note }
 * @returns {Promise<Object>} Parsed diet plan object
 */
export const generateDietPlan = async (medicines) => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing Gemini API key. Create a .env file in the project root with:\nVITE_GEMINI_API_KEY=your_key_here"
    );
  }

  const ai = new GoogleGenAI({ apiKey });

  const medList = medicines
    .map(
      (m, i) =>
        `${i + 1}. ${m.name} — Dosage: ${m.dosage}, Frequency: ${m.frequency}, Timing: ${(m.timing || []).join(", ")}, Note: ${m.note || "N/A"}`
    )
    .join("\n");

  const prompt = `
You are a certified clinical nutritionist. A patient is currently taking the following medicines:

${medList}

Based on these medicines, generate a personalized, balanced daily diet plan that:
- Supports the effectiveness of the medicines
- Avoids foods that may interact negatively with the medicines
- Promotes overall health and recovery

Return ONLY a valid JSON object — no explanation, no markdown fences, no extra text.

Required format:
{
  "meals": {
    "breakfast": {
      "items": [
        { "name": "Food name", "detail": "Portion size and brief reason" }
      ]
    },
    "lunch": {
      "items": [
        { "name": "Food name", "detail": "Portion size and brief reason" }
      ]
    },
    "snacks": {
      "items": [
        { "name": "Food name", "detail": "Portion size and brief reason" }
      ]
    },
    "dinner": {
      "items": [
        { "name": "Food name", "detail": "Portion size and brief reason" }
      ]
    }
  },
  "tips": ["Tip 1", "Tip 2", "Tip 3"],
  "avoid": ["Food/drink to avoid 1", "Food/drink to avoid 2"]
}

Rules:
- Each meal should have 3-5 food items.
- Tips should be 3-5 practical dietary tips considering the medicines.
- Avoid list should include 3-6 foods/drinks that interact badly with the medicines.
- Use simple, easy-to-find foods.
- Keep detail text concise (under 20 words).
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
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        })
      );

      const responseText =
        typeof result?.text === "function"
          ? result.text()
          : (result?.text ?? "");

      // Strip markdown fences if present
      let cleaned = responseText
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/g, "")
        .trim();

      // Extract the JSON object
      const startIdx = cleaned.indexOf("{");
      if (startIdx === -1) throw new Error("No JSON object found in response");

      let depth = 0;
      let endIdx = -1;
      for (let i = startIdx; i < cleaned.length; i++) {
        if (cleaned[i] === "{") depth++;
        else if (cleaned[i] === "}") {
          depth--;
          if (depth === 0) { endIdx = i; break; }
        }
      }
      if (endIdx === -1) throw new Error("Incomplete JSON object in response");

      const jsonStr = cleaned.substring(startIdx, endIdx + 1);
      const plan = JSON.parse(jsonStr);

      // Validate structure
      if (!plan.meals) throw new Error("Invalid diet plan structure");

      return plan;
    } catch (err) {
      lastError = err;
      const msg = err?.message || "";
      if (msg.includes("404") || msg.includes("not found")) {
        console.warn(`Model "${modelName}" not available, trying next…`);
        continue;
      }
      break;
    }
  }

  const message = lastError?.message || "Unknown Gemini error";
  if (message.toLowerCase().includes("quota") || message.includes("429")) {
    throw new Error(
      "API quota exceeded. Your free-tier limit has been reached.\n" +
        "→ Enable billing at https://ai.google.dev or generate a new API key with available quota."
    );
  }
  throw new Error(message);
};