import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { guardPublicJsonPost } from "@/lib/public-post-guard";
import { requireUser } from "@/lib/server-auth";
import { getServerSupabase } from "@/lib/supabase-server";

export async function POST(req: Request) {
  try {
    const g = await guardPublicJsonPost(req, { keyPrefix: "ocr", windowMs: 60_000, max: 5, honeypot: false });
    if (!g.ok) return g.response;
    const body = g.body;

    const user = await requireUser(req);
    const supabase = getServerSupabase();
    const profRes = await supabase
      .from("profiles")
      .select("is_admin, can_manage_admins, can_view_budget, can_edit_budget")
      .eq("id", user.id)
      .maybeSingle();
    if (profRes.error) throw profRes.error;
    const p: any = profRes.data || {};
    const canUse = p?.can_manage_admins === true || p?.is_admin === true || p?.can_view_budget === true || p?.can_edit_budget === true;
    if (!canUse) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const apiKey = process.env.GOOGLE_AI_API_KEY || "";
    if (!apiKey) return NextResponse.json({ error: "OCR není nakonfigurované." }, { status: 501 });

    const { imageBase64, mimeType = "image/jpeg" } = body || {};

    if (!imageBase64) {
      return NextResponse.json({ error: "Missing image data" }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
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
