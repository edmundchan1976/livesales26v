
import { GoogleGenAI, Type } from "@google/genai";

export const extractInventoryFromImage = async (base64Data: string, mimeType: string) => {
  const apiKey = process.env.API_KEY;
  
  if (!apiKey || apiKey === "undefined" || apiKey.length < 10) {
    throw new Error("MISSING_API_KEY");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        {
          inlineData: {
            data: base64Data.split(',')[1], // Remove the data:image/xxx;base64, prefix
            mimeType: mimeType,
          },
        },
        {
          text: "Extract an inventory list from this document. I need the Category, Item Name, Price, and Quantity. Return the data as a clean JSON array of objects.",
        },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING },
            name: { type: Type.STRING },
            price: { type: Type.NUMBER },
            quantity: { type: Type.NUMBER },
          },
          required: ["category", "name", "price", "quantity"]
        }
      }
    }
  });

  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error("Failed to parse AI response", e);
    return [];
  }
};
