import { APICallError } from "ai";
import { describe, expect, it } from "vitest";

import { describeProviderError } from "./openrouter-error";

function apiError(statusCode: number) {
  return new APICallError({
    message: "Provider error",
    url: "https://openrouter.ai/api/v1/chat/completions",
    requestBodyValues: {},
    statusCode,
    isRetryable: false,
  });
}

describe("OpenRouter error descriptions", () => {
  it.each([
    [401, "invalid_api_key"],
    [402, "insufficient_credits"],
    [404, "model_unavailable"],
    [429, "provider_rate_limit"],
    [500, "provider_unavailable"],
  ])("maps provider status %i to %s", (statusCode, code) => {
    expect(describeProviderError(apiError(statusCode))).toMatchObject({ code });
  });

  it("finds a provider error wrapped by retry handling", () => {
    expect(describeProviderError({ lastError: apiError(401) })).toMatchObject({
      code: "invalid_api_key",
    });
  });

  it("maps timeout failures without exposing their original message", () => {
    expect(describeProviderError(new Error("Request timed out with secret details"))).toEqual({
      code: "provider_timeout",
      message: "OpenRouter did not respond in time. Please retry.",
      status: 504,
    });
  });
});
