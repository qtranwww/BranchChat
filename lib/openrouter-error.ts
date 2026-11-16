import { APICallError } from "ai";

export type ProviderError = {
  code:
    | "invalid_api_key"
    | "insufficient_credits"
    | "model_unavailable"
    | "provider_rate_limit"
    | "provider_timeout"
    | "provider_unavailable"
    | "provider_rejected";
  message: string;
  status: number;
};

function findApiCallError(error: unknown, visited = new Set<unknown>()): APICallError | null {
  if (APICallError.isInstance(error)) {
    return error;
  }

  if (!error || typeof error !== "object" || visited.has(error)) {
    return null;
  }

  visited.add(error);
  const candidate = error as { cause?: unknown; lastError?: unknown; errors?: unknown[] };

  for (const nested of [candidate.lastError, candidate.cause, ...(candidate.errors ?? [])]) {
    const apiError = findApiCallError(nested, visited);

    if (apiError) {
      return apiError;
    }
  }

  return null;
}

export function describeProviderError(error: unknown): ProviderError {
  const apiError = findApiCallError(error);
  const statusCode = apiError?.statusCode;

  if (statusCode === 401 || statusCode === 403) {
    return {
      code: "invalid_api_key",
      message: "OpenRouter rejected the API key. Check OPENROUTER_API_KEY and try again.",
      status: 401,
    };
  }

  if (statusCode === 402) {
    return {
      code: "insufficient_credits",
      message: "OpenRouter reports insufficient credits for this request.",
      status: 402,
    };
  }

  if (statusCode === 404) {
    return {
      code: "model_unavailable",
      message: "The configured OpenRouter model was not found or is unavailable.",
      status: 502,
    };
  }

  if (statusCode === 429) {
    return {
      code: "provider_rate_limit",
      message: "OpenRouter rate-limited this key. Wait a moment or check its quota.",
      status: 429,
    };
  }

  if (
    statusCode === 408 ||
    statusCode === 504 ||
    (error instanceof Error && /timed?\s*out|timeout/i.test(error.message))
  ) {
    return {
      code: "provider_timeout",
      message: "OpenRouter did not respond in time. Please retry.",
      status: 504,
    };
  }

  if (statusCode && statusCode >= 500) {
    return {
      code: "provider_unavailable",
      message: "OpenRouter or the selected model provider is temporarily unavailable.",
      status: 502,
    };
  }

  return {
    code: "provider_rejected",
    message: "OpenRouter could not start this request. Check the configured model and provider status.",
    status: 502,
  };
}
