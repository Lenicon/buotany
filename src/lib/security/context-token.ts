import { createHash, createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import type { BotanicalContext } from "./prompts";
import { sanitizeDataField } from "./prompts";

const TOKEN_VERSION = 1;
const DEFAULT_TTL_SECONDS = 60 * 60 * 2; // 2 hours
const MAX_TOKEN_LENGTH = 8192;
const MAX_CLOCK_SKEW_SECONDS = 60;

type SignedPayload = {
  v: number;
  jti: string;
  iat: number;
  exp: number;
  ctx: BotanicalContext;
};

function getSigningKey(): Buffer {
  const explicitSecret = process.env.CONTEXT_SIGNING_SECRET?.trim();
  if (explicitSecret) {
    return createHash("sha256")
      .update(`buotany-ctx:${explicitSecret}`)
      .digest();
  }
  const fallback = process.env.AIKI_API_KEY?.trim();
  if (!fallback) {
    throw new Error(
      "Missing CONTEXT_SIGNING_SECRET or AIKI_API_KEY for context signing.",
    );
  }
  return createHash("sha256")
    .update(`buotany-ctx-fallback:${fallback}`)
    .digest();
}

function computeSignature(encodedPayload: string, key: Buffer): string {
  return createHmac("sha256", key).update(encodedPayload).digest("base64url");
}

function isNonEmptyString(value: unknown, maxLen = 128): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLen;
}

/**
 * Signs a sanitized BotanicalContext into a compact, tamper-evident token
 * (`<base64url-payload>.<base64url-hmac>`) so the client cannot forge or
 * inject instructions into `/api/chat`.
 */
export function signContext(
  context: BotanicalContext,
  ttlSeconds = DEFAULT_TTL_SECONDS,
  nowSeconds = Math.floor(Date.now() / 1000),
): string {
  const payload: SignedPayload = {
    v: TOKEN_VERSION,
    jti: randomUUID(),
    iat: nowSeconds,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    ctx: context,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  const sig = computeSignature(encoded, getSigningKey());
  return `${encoded}.${sig}`;
}

export type VerifyContextResult =
  | { ok: true; context: BotanicalContext; jti: string; iat: number; exp: number }
  | { ok: false; error: string };

function isValidBotanicalContext(value: unknown): value is BotanicalContext {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  if (!Array.isArray(obj.topSpecies) || !Array.isArray(obj.topDiseases))
    return false;
  if (obj.topSpecies.length > 3 || obj.topDiseases.length > 3) return false;

  for (const s of obj.topSpecies) {
    if (!s || typeof s !== "object") return false;
    const item = s as Record<string, unknown>;
    if (
      typeof item.scientificName !== "string" ||
      typeof item.score !== "number" ||
      !Array.isArray(item.commonNames) ||
      !item.commonNames.every((c) => typeof c === "string")
    ) {
      return false;
    }
  }

  for (const d of obj.topDiseases) {
    if (!d || typeof d !== "object") return false;
    const item = d as Record<string, unknown>;
    if (
      typeof item.name !== "string" ||
      typeof item.label !== "string" ||
      typeof item.score !== "number"
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Verifies signature, expiration, and schema of a context token returned by `/api/diagnose`.
 */
export function verifyContext(
  token: unknown,
  nowSeconds = Math.floor(Date.now() / 1000),
): VerifyContextResult {
  if (
    typeof token !== "string" ||
    token.length === 0 ||
    token.length > MAX_TOKEN_LENGTH
  ) {
    return { ok: false, error: "Invalid diagnosis context token." };
  }

  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { ok: false, error: "Malformed diagnosis context token." };
  }

  const [encoded, providedSig] = parts;
  let expectedSig: string;
  try {
    expectedSig = computeSignature(encoded, getSigningKey());
  } catch {
    return {
      ok: false,
      error: "Server context verification is not configured.",
    };
  }

  const providedBuf = Buffer.from(providedSig, "utf8");
  const expectedBuf = Buffer.from(expectedSig, "utf8");
  if (
    providedBuf.length !== expectedBuf.length ||
    !timingSafeEqual(providedBuf, expectedBuf)
  ) {
    return { ok: false, error: "Diagnosis context token failed verification." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return { ok: false, error: "Corrupted diagnosis context token." };
  }

  const payload = parsed as Partial<SignedPayload>;
  if (
    payload.v !== TOKEN_VERSION ||
    !isNonEmptyString(payload.jti, 128) ||
    typeof payload.iat !== "number" ||
    !Number.isFinite(payload.iat) ||
    typeof payload.exp !== "number" ||
    !Number.isFinite(payload.exp) ||
    !isValidBotanicalContext(payload.ctx)
  ) {
    return { ok: false, error: "Invalid diagnosis context payload." };
  }

  if (payload.iat > nowSeconds + MAX_CLOCK_SKEW_SECONDS) {
    return { ok: false, error: "Invalid diagnosis token issue time." };
  }

  if (payload.exp < Math.floor(Date.now() / 1000)) {
    return {
      ok: false,
      error:
        "Your plant diagnosis session has expired. Please upload your photos again.",
    };
  }

  // Re-sanitize fields defensively
  const sanitized: BotanicalContext = {
    topSpecies: payload.ctx.topSpecies.map((s) => ({
      scientificName: sanitizeDataField(s.scientificName) || "Unknown",
      commonNames: s.commonNames
        .slice(0, 4)
        .map((c) => sanitizeDataField(c, 80))
        .filter(Boolean),
      score: Math.min(1, Math.max(0, s.score)),
    })),
    topDiseases: payload.ctx.topDiseases.map((d) => ({
      name: sanitizeDataField(d.name, 80),
      label: sanitizeDataField(d.label) || "Unknown condition",
      score: Math.min(1, Math.max(0, d.score)),
    })),
  };

  return {
    ok: true,
    context: sanitized,
    jti: payload.jti,
    iat: payload.iat,
    exp: payload.exp,
  };
}
