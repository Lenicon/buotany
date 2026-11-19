import { NextResponse } from "next/server";
import OpenAI from "openai";
import {
  type BotanicalContext,
  buildChatSystemPrompt,
  CHAT_RATE_LIMIT,
  checkRateLimit,
  SAFE_REFUSAL_MESSAGE,
  sanitizeAssistantOutput,
  validateChatMessages,
  verifyContext,
} from "@/lib/security";

function getOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.AIKI_API_KEY,
    baseURL: process.env.AIKI_BASE_URL,
  });
}

export async function POST(req: Request) {
  try {
    const rateLimit = checkRateLimit(req, CHAT_RATE_LIMIT);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error:
            "Too many messages sent. Please wait a moment before trying again.",
        },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        },
      );
    }

    if (!process.env.AIKI_API_KEY) {
      return NextResponse.json(
        { error: "Missing AIKI_API_KEY on server." },
        { status: 500 },
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body." },
        { status: 400 },
      );
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request payload." },
        { status: 400 },
      );
    }

    const { messages, contextToken } = body as {
      messages?: unknown;
      contextToken?: unknown;
    };

    const validation = validateChatMessages(messages);
    if (!validation.ok) {
      if (validation.kind === "prompt_injection") {
        return NextResponse.json({
          reply: SAFE_REFUSAL_MESSAGE,
          blocked: true,
        });
      }
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    let botanicalContext: BotanicalContext | null = null;
    if (
      contextToken !== undefined &&
      contextToken !== null &&
      contextToken !== ""
    ) {
      const verified = verifyContext(contextToken);
      if (!verified.ok) {
        return NextResponse.json({ error: verified.error }, { status: 400 });
      }
      botanicalContext = verified.context;
    }

    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: "gpt-6-luna",
      temperature: 0.4,
      max_tokens: 700,
      messages: [
        { role: "system", content: buildChatSystemPrompt(botanicalContext) },
        ...validation.messages,
      ],
    });

    const reply = sanitizeAssistantOutput(
      completion.choices[0]?.message?.content,
      "I couldn't put together a reply for that.",
    );

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("Chat route error:", err);
    return NextResponse.json(
      { error: "Failed to get a response from assistant." },
      { status: 500 },
    );
  }
}
