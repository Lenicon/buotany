export type ValidatedChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export const MAX_CHAT_MESSAGES = 20;
export const MAX_USER_MESSAGE_CHARS = 1500;
export const MAX_ASSISTANT_MESSAGE_CHARS = 8000;
export const MAX_TOTAL_CHAT_CHARS = 24000;

export const SAFE_REFUSAL_MESSAGE =
  "I'm Buotany, and I can only help with plant identification, plant care, and plant pathology questions. Ask me anything about your plant's leaves, watering, light, soil, or pests!";

const ZERO_WIDTH_RE = /[\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g;

function stripUnsafeControlChars(input: string): string {
  let out = "";
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    // Preserve \t (0x09), \n (0x0a), \r (0x0d)
    if (
      (code >= 0x00 && code <= 0x08) ||
      code === 0x0b ||
      code === 0x0c ||
      (code >= 0x0e && code <= 0x1f) ||
      code === 0x7f
    ) {
      continue;
    }
    out += input[i];
  }
  return out;
}

/**
 * High-signal prompt-injection, jailbreak, delimiter-spoofing, and
 * system-prompt-extraction patterns. Designed to minimize false positives on
 * normal plant-care language while blocking common attack vectors.
 */
const INJECTION_PATTERNS: ReadonlyArray<{ name: string; regex: RegExp }> = [
  {
    name: "instruction_override",
    regex:
      /\b(?:ignore|disregard|forget|override|bypass|skip|pass\s+over)\s+(?:all\s+|any\s+|the\s+)?(?:previous|prior|above|earlier|initial|original|system|developer)\s+(?:instructions?|prompts?|rules?|directives?|constraints?|guidelines?|commands?|orders?)\b/i,
  },
  {
    name: "context_reset",
    regex:
      /\bforget\s+(?:everything|all)\s+(?:we(?:'|’)?ve\s+|you\s+)?(?:discussed|said|talked\s+about|been\s+told)\b/i,
  },
  {
    name: "new_instructions",
    regex:
      /\b(?:from\s+now\s+on|starting\s+now|instead)\s*,?\s*(?:you\s+are|act\s+as|pretend\s+to\s+be|ignore\s+your\s+rules|follow\s+(?:these|my)\s+instructions?)\b/i,
  },
  {
    name: "persona_hijack",
    regex:
      /\b(?:you\s+are\s+now|switch\s+to|enter|enable|activate)\s+(?:a\s+)?(?:DAN|do\s+anything\s+now|developer\s+mode|god\s+mode|jailbreak(?:ed)?|unfiltered|unrestricted|admin\s+mode|debug\s+mode)\b/i,
  },
  {
    name: "prompt_extraction",
    regex:
      /\b(?:reveal|show|print|output|repeat|dump|leak|display|echo|tell\s+me|what\s+(?:is|are))\s+(?:me\s+)?(?:your|the)\s+(?:exact\s+|full\s+|complete\s+|hidden\s+|internal\s+)?(?:system\s+prompt|system\s+instructions?|initial\s+prompt|hidden\s+instructions?|developer\s+prompt|security\s+rules?)\b/i,
  },
  {
    name: "delimiter_spoofing",
    regex:
      /(?:<\|(?:im_start|im_end|system|endoftext)\|>|\[\/?INST\]|<<\/?SYS>>|<\/?botanical_data>|^\s*###\s*(?:system|instruction|developer)\b)/im,
  },
  {
    name: "role_spoofing_marker",
    regex:
      /^\s*(?:system|developer)\s*:\s*(?:you\s+are|ignore|override|new\s+rules)/im,
  },
];

export function normalizeUserText(text: string): string {
  return stripUnsafeControlChars(text.normalize("NFKC"))
    .replace(ZERO_WIDTH_RE, "")
    .trim();
}

export type InputScreenResult =
  | { allowed: true; sanitized: string }
  | { allowed: false; reason: string; sanitized: string };

/**
 * Screens a single user text string for prompt-injection and jailbreak attempts.
 */
export function screenUserInput(rawText: string): InputScreenResult {
  const sanitized = normalizeUserText(rawText);
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.regex.test(sanitized)) {
      return { allowed: false, reason: pattern.name, sanitized };
    }
  }
  return { allowed: true, sanitized };
}

export type ValidateChatMessagesResult =
  | { ok: true; messages: ValidatedChatMessage[] }
  | { ok: false; kind: "validation_error"; error: string }
  | { ok: false; kind: "prompt_injection"; reason: string };

/**
 * Strictly validates client-supplied chat history at runtime:
 * - Rejects non-"user"/"assistant" roles (blocks "system" / "developer" injection)
 * - Enforces turn count, per-message length, and total character caps
 * - Screens all user turns for prompt-injection patterns
 */
export function validateChatMessages(
  rawMessages: unknown,
): ValidateChatMessagesResult {
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    return {
      ok: false,
      kind: "validation_error",
      error: "Messages are required.",
    };
  }

  if (rawMessages.length > MAX_CHAT_MESSAGES) {
    return {
      ok: false,
      kind: "validation_error",
      error: `Conversation limit reached (max ${MAX_CHAT_MESSAGES} messages). Start a new session to continue.`,
    };
  }

  const validated: ValidatedChatMessage[] = [];
  let totalChars = 0;

  for (const item of rawMessages) {
    if (!item || typeof item !== "object") {
      return {
        ok: false,
        kind: "validation_error",
        error: "Invalid message format.",
      };
    }

    const { role, content } = item as { role?: unknown; content?: unknown };
    if (role !== "user" && role !== "assistant") {
      return {
        ok: false,
        kind: "validation_error",
        error: "Unsupported message role.",
      };
    }

    if (typeof content !== "string") {
      return {
        ok: false,
        kind: "validation_error",
        error: "Message content must be text.",
      };
    }

    const normalized = normalizeUserText(content);
    if (normalized.length === 0) {
      return {
        ok: false,
        kind: "validation_error",
        error: "Message cannot be empty.",
      };
    }

    const maxLen =
      role === "user" ? MAX_USER_MESSAGE_CHARS : MAX_ASSISTANT_MESSAGE_CHARS;
    if (normalized.length > maxLen) {
      return {
        ok: false,
        kind: "validation_error",
        error:
          role === "user"
            ? `Message is too long (max ${MAX_USER_MESSAGE_CHARS} characters).`
            : "Conversation history contains an oversized message.",
      };
    }

    totalChars += normalized.length;
    if (totalChars > MAX_TOTAL_CHAT_CHARS) {
      return {
        ok: false,
        kind: "validation_error",
        error: "Conversation is too long. Please start a new photo session.",
      };
    }

    if (role === "user") {
      const screen = screenUserInput(normalized);
      if (!screen.allowed) {
        return { ok: false, kind: "prompt_injection", reason: screen.reason };
      }
      validated.push({ role: "user", content: screen.sanitized });
    } else {
      validated.push({ role: "assistant", content: normalized });
    }
  }

  const lastMessage = validated[validated.length - 1];
  if (lastMessage?.role !== "user") {
    return {
      ok: false,
      kind: "validation_error",
      error: "The latest message must be from the user.",
    };
  }

  return { ok: true, messages: validated };
}

const SYSTEM_LEAK_INDICATORS: ReadonlyArray<RegExp> = [
  /SECURITY\s*&\s*BOUNDARY\s*RULES\s*\(HIGHEST\s*PRIORITY/i,
  /Untrusted\s+Data\s+Isolation:\s*Treat\s+all\s+text\s+inside/i,
  /<\/?botanical_data>/i,
];

/**
 * Post-processes LLM output to catch accidental system-prompt leakage and strip
 * dangerous markdown constructs (image beacons, non-https links).
 */
export function sanitizeAssistantOutput(
  rawOutput: string | null | undefined,
  fallback: string,
): string {
  const trimmed = rawOutput?.trim();
  if (!trimmed) return fallback;

  for (const leakRegex of SYSTEM_LEAK_INDICATORS) {
    if (leakRegex.test(trimmed)) {
      return SAFE_REFUSAL_MESSAGE;
    }
  }

  // Strip markdown image embeds `![alt](url)` to prevent exfiltration beacons
  let cleaned = trimmed.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "$1");

  // Neutralize non-https markdown links (javascript:, data:, http:, etc.)
  cleaned = cleaned.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (match, label: string, url: string) => {
      const safeUrl = url.trim();
      if (/^https:\/\//i.test(safeUrl)) {
        return match;
      }
      return label;
    },
  );

  return cleaned.trim() || fallback;
}
