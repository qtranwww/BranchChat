import { describe, expect, it } from "vitest";

import { readOpenRouterConfiguration } from "./openrouter-config";

describe("OpenRouter configuration", () => {
  it("accepts a local key and model without exposing extra environment values", () => {
    expect(
      readOpenRouterConfiguration({
        OPENROUTER_API_KEY: "sk-or-v1-local",
        OPENROUTER_MODEL: "openai/gpt-test",
      }),
    ).toEqual({
      ok: true,
      configuration: {
        apiKey: "sk-or-v1-local",
        modelId: "openai/gpt-test",
      },
    });
  });

  it("rejects missing, placeholder and malformed configuration", () => {
    expect(readOpenRouterConfiguration({})).toMatchObject({ ok: false });
    expect(
      readOpenRouterConfiguration({
        OPENROUTER_API_KEY: "your_openrouter_api_key",
        OPENROUTER_MODEL: "your_openrouter_model_id",
      }),
    ).toMatchObject({ ok: false, error: { code: "configuration_missing" } });
    expect(
      readOpenRouterConfiguration({
        OPENROUTER_API_KEY: "sk-or-v1-local",
        OPENROUTER_MODEL: "invalid model",
      }),
    ).toMatchObject({ ok: false, error: { code: "configuration_invalid" } });
  });
});
