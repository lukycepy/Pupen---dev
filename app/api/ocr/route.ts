import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const { imageBase64, mimeType = "image/jpeg" } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "Missing image data" }, { status: 400 });
    }

    // Gemini 1.5 Flash je ideální pro rychlé OCR a extrakci dat
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      Analyze this document (receipt/invoice) and extract the following information in JSON format:
      - merchant: name of the store or company
      - amount: total price as a number
      - currency: currency code (e.g. CZK, EUR)
      - date: date of the transaction in YYYY-MM-DD format
      - category: suggest a category (e.g. Food, Transport, Material, Service, Other)
      
      Only return the JSON object, nothing else.
    `;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imageBase64.split(",")[1] || imageBase64,
          mimeType: mimeType,
        },
      },
    ]);

    const response = await result.response;
    const text = response.text();
    
    // Extrakce JSONu z odpovědi (Gemini občas dává markdown blocky)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const data = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text);

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("OCR Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
