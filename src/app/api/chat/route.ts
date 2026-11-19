import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.AIKI_API_KEY, baseURL: process.env.AIKI_BASE_URL });

export async function POST(req: Request) {
  try {
    if (!process.env.AIKI_API_KEY) {
      return NextResponse.json({ error: "Missing AIKI_API_KEY on server." }, { status: 500 });
    }

    const { messages, contextSummary } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Messages are required." }, { status: 400 });
    }

    const systemContent =
      "You are Buotany, a helpful plant care and plant pathology assistant. " +
      "Answer follow-up questions concisely and practically." +
      (contextSummary
        ? `\n\nPrior Pl@ntNet identification context:\n${contextSummary}`
        : "");

    const completion = await openai.chat.completions.create({
      model: "gpt-6-luna",
      messages: [
        { role: "system", content: systemContent },
        ...messages.map((m: { role: "user" | "assistant"; content: string }) => ({
          role: m.role,
          content: m.content,
        })),
      ],
    });

    const reply =
      completion.choices[0]?.message?.content?.trim() ||
      "I couldn't put together a reply for that.";

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("Chat route error:", err);
    return NextResponse.json(
      { error: "Failed to get a response from assistant." },
      { status: 500 }
    );
  }
}