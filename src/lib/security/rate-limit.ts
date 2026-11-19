export type RateLimitConfig = {
  bucket: string;
  maxRequests: number;
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

const MAX_TRACKED_KEYS = 5000;
const requestLog = new Map<string, number[]>();

function pruneOldEntries(now: number, maxWindowMs: number): void {
  if (requestLog.size <= MAX_TRACKED_KEYS) return;
  for (const [key, timestamps] of requestLog.entries()) {
    const recent = timestamps.filter((t) => now - t < maxWindowMs);
    if (recent.length === 0) {
      requestLog.delete(key);
    } else {
      requestLog.set(key, recent);
    }
  }
  // If still over cap, evict oldest entries
  while (requestLog.size > MAX_TRACKED_KEYS) {
    const oldestKey = requestLog.keys().next().value;
    if (oldestKey === undefined) break;
    requestLog.delete(oldestKey);
  }
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "anonymous";
}

/**
 * In-memory sliding-window rate limiter keyed by bucket + client IP.
 */
export function checkRateLimit(
  req: Request,
  config: RateLimitConfig,
  now = Date.now(),
): RateLimitResult {
  pruneOldEntries(now, config.windowMs);

  const ip = getClientIp(req);
  const key = `${config.bucket}:${ip}`;
  const cutoff = now - config.windowMs;
  const timestamps = (requestLog.get(key) ?? []).filter((t) => t > cutoff);

  if (timestamps.length >= config.maxRequests) {
    const oldestInWindow = timestamps[0] ?? now;
    const retryAfterMs = Math.max(
      1000,
      config.windowMs - (now - oldestInWindow),
    );
    requestLog.set(key, timestamps);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    };
  }

  timestamps.push(now);
  requestLog.set(key, timestamps);

  return {
    allowed: true,
    remaining: Math.max(0, config.maxRequests - timestamps.length),
    retryAfterSeconds: 0,
  };
}

export function resetRateLimitStore(): void {
  requestLog.clear();
}

export const DIAGNOSE_RATE_LIMIT: RateLimitConfig = {
  bucket: "diagnose",
  maxRequests: 10,
  windowMs: 10 * 60 * 1000, // 10 requests per 10 minutes
};

export const CHAT_RATE_LIMIT: RateLimitConfig = {
  bucket: "chat",
  maxRequests: 30,
  windowMs: 10 * 60 * 1000, // 30 requests per 10 minutes
};
