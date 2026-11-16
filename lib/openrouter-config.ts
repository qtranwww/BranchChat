export type OpenRouterConfiguration = {
  apiKey: string;
  modelId: string;
};

export type OpenRouterConfigurationError = {
  code: "configuration_missing" | "configuration_invalid";
  message: string;
};

export type OpenRouterConfigurationResult =
  | { ok: true; configuration: OpenRouterConfiguration }
  | { ok: false; error: OpenRouterConfigurationError };

function isPlaceholder(value: string): boolean {
  const normalized = value.toLowerCase();
  return normalized.includes("your_") || normalized.includes("your-") || normalized === "your key here";
}

export function readOpenRouterConfiguration(
  environment: Record<string, string | undefined> = process.env,
): OpenRouterConfigurationResult {
  const apiKey = environment.OPENROUTER_API_KEY?.trim() ?? "";
  const modelId = environment.OPENROUTER_MODEL?.trim() ?? "";

  if (!apiKey || !modelId || isPlaceholder(apiKey) || isPlaceholder(modelId)) {
    return {
      ok: false,
      error: {
        code: "configuration_missing",
        message:
          "OpenRouter is not configured. Add OPENROUTER_API_KEY and OPENROUTER_MODEL to .env.local, then restart BranchChat.",
      },
    };
  }

  if (apiKey.length > 512 || modelId.length > 200 || !modelId.includes("/") || /\s/.test(modelId)) {
    return {
      ok: false,
      error: {
        code: "configuration_invalid",
        message: "The OpenRouter model configuration is invalid. Check OPENROUTER_MODEL in .env.local.",
      },
    };
  }

  return { ok: true, configuration: { apiKey, modelId } };
}
