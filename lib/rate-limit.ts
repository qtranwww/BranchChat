type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const WINDOW_MS = 60_000;
const REQUEST_LIMIT = 10;

const rateLimitStore = new Map<string, RateLimitEntry>();

export function consumeChatRequest(identifier: string, now = Date.now()): boolean {
  const current = rateLimitStore.get(identifier);

  if (!current || current.resetAt <= now) {
    rateLimitStore.set(identifier, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (current.count >= REQUEST_LIMIT) {
    return false;
  }

  current.count += 1;
  return true;
}
