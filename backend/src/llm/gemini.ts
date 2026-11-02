// the only file that talks to google
// switching to another llm provider would only mean rewriting this file

const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
const TIMEOUT_MS = 10_000;

// ask gemini for a json answer that follows the given schema
export async function generateJson(prompt: string, responseSchema: object): Promise<unknown> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const response = await fetch(`${API_URL}/${model}:generateContent`, {
    method: 'POST',
    // key goes in a header, not the url, so it doesn't end up in logs
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        // 0 = most predictable answer, same title should give the same skills
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema,
      },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Gemini responded with status ${response.status}`);
  }

  // the answer text is nested a few levels down in google's response
  const body = await response.json();
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string') {
    throw new Error('Gemini returned no text');
  }
  return JSON.parse(text);
}
