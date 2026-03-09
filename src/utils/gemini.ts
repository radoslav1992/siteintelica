import { GoogleGenerativeAI } from '@google/generative-ai';

const MODEL_NAME = 'gemini-3.1-flash-lite-preview';

let genAI: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI | null {
    if (genAI) return genAI;
    const key = process.env.GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
    if (!key || key === 'your_api_key_here') return null;
    genAI = new GoogleGenerativeAI(key);
    return genAI;
}

export async function askGemini(prompt: string): Promise<string | null> {
    const client = getClient();
    if (!client) return null; // Fall back to local generation

    try {
        const model = client.getGenerativeModel({ model: MODEL_NAME });
        const result = await model.generateContent(prompt);
        const response = result.response;
        return response.text();
    } catch (error) {
        console.error('Gemini API error:', error);
        return null; // Fall back to local generation
    }
}
