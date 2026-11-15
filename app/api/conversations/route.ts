import { NextResponse } from "next/server";

import { listConversationSummaries } from "@/lib/conversation-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  try {
    return NextResponse.json({ conversations: listConversationSummaries() });
  } catch {
    return NextResponse.json(
      { error: "Local conversation history could not be read." },
      { status: 500 },
    );
  }
}
