let GoogleGenerativeAI: any = null;

// Dynamic import to prevent crashes if the package is not installed
try {
    const mod = await import('@google/generative-ai');
    GoogleGenerativeAI = mod.GoogleGenerativeAI;
} catch {
    // Package not installed — AI will use local fallback
}

const MODEL_NAME = 'gemini-3.1-flash-lite-preview';

let genAI: any = null;

function getClient(): any {
    if (!GoogleGenerativeAI) return null;
    if (genAI) return genAI;
    const key = process.env.GEMINI_API_KEY || (import.meta as any).env?.GEMINI_API_KEY;
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
