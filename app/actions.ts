'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function analyzeImage(formData: FormData) {
  const file = formData.get('image') as File;
  if (!file) {
    return { error: 'No image provided' };
  }

  if (!process.env.GEMINI_API_KEY) {
    return { error: 'GEMINI_API_KEY is not set' };
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');

    const model = genAI.getGenerativeModel({
      model: 'gemini-flash-latest', generationConfig: {
        temperature: 0,
        topP: 1,
        topK: 1,
      }
    });

    const prompt = `
  Analyze the food in this image.
  
  Step 1: Estimate the grams of Protein, Carbs, and Fat.
  Step 2: Calculate the Total Calories strictly using this formula: 
          (Protein * 4) + (Carbs * 4) + (Fat * 9).
  
  Step 3: Output ONLY the final result using this exact format:
  
  # ⚡ [Calculated Calories] Calories
  **Protein:** [Protein]g  |  **Carbs:** [Carbs]g  |  **Fat:** [Fat]g
 `;

    const imagePart = {
      inlineData: {
        data: base64,
        mimeType: file.type,
      },
    };

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();

    return { text };
  } catch (error) {
    console.error('Error analyzing image:', error);
    return { error: 'Failed to analyze image' };
  }
}
