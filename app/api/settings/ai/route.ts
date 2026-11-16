import { NextResponse } from "next/server";

import { readOpenRouterConfiguration } from "@/lib/openrouter-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const result = readOpenRouterConfiguration();

  if (!result.ok) {
    return NextResponse.json({
      provider: "OpenRouter",
      model: null,
      configured: false,
      issue: result.error.message,
    });
  }

  return NextResponse.json({
    provider: "OpenRouter",
    model: result.configuration.modelId,
    configured: true,
  });
}
