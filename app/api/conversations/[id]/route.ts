import { NextResponse } from "next/server";

import {
  deleteConversation,
  loadConversationSnapshot,
  saveConversationSnapshot,
} from "@/lib/conversation-storage";
import { parseConversationSnapshot } from "@/lib/conversation-snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SNAPSHOT_BYTES = 2_000_000;

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const snapshot = loadConversationSnapshot(id);

    return snapshot
      ? NextResponse.json(snapshot)
      : NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  } catch {
    return NextResponse.json(
      { error: "The local conversation could not be loaded." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const contentLength = Number(request.headers.get("content-length") ?? 0);

  if (contentLength > MAX_SNAPSHOT_BYTES) {
    return NextResponse.json({ error: "Conversation snapshot is too large." }, { status: 413 });
  }

  try {
    const rawBody = await request.text();

    if (new TextEncoder().encode(rawBody).byteLength > MAX_SNAPSHOT_BYTES) {
      return NextResponse.json({ error: "Conversation snapshot is too large." }, { status: 413 });
    }

    const snapshot = parseConversationSnapshot(JSON.parse(rawBody), id);

    if (!snapshot) {
      return NextResponse.json({ error: "Conversation snapshot is invalid." }, { status: 400 });
    }

    saveConversationSnapshot(snapshot);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Conversation snapshot is invalid." }, { status: 400 });
    }

    return NextResponse.json(
      { error: "The local conversation could not be saved." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    return deleteConversation(id)
      ? new Response(null, { status: 204 })
      : NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  } catch {
    return NextResponse.json(
      { error: "The local conversation could not be deleted." },
      { status: 500 },
    );
  }
}
