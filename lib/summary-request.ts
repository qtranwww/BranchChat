import type { ChatMessage } from "./conversation";

const MAX_MESSAGES = 40;
const MAX_MESSAGE_LENGTH = 4_000;
const MAX_TOTAL_LENGTH = 40_000;

export class InvalidSummaryRequestError extends Error {
  constructor(
    message: string,
    readonly code: "summary_context_invalid" | "summary_context_too_large",
  ) {
    super(message);
  }
}

export function parseSummaryRequest(value: unknown): ChatMessage[] {
  if (!value || typeof value !== "object" || !("messages" in value)) {
    throw new InvalidSummaryRequestError(
      "A messages array is required.",
      "summary_context_invalid",
    );
  }

  const messages = (value as { messages?: unknown }).messages;

  if (!Array.isArray(messages) || messages.length === 0 || messages.length % 2 !== 0) {
    throw new InvalidSummaryRequestError(
      "The summary context must contain complete conversation turns.",
      "summary_context_invalid",
    );
  }

  if (messages.length > MAX_MESSAGES) {
    throw new InvalidSummaryRequestError(
      "The summary context is too large.",
      "summary_context_too_large",
    );
  }

  let totalLength = 0;
  const parsedMessages = messages.map((message, index) => {
    if (!message || typeof message !== "object") {
      throw new InvalidSummaryRequestError(
        "A summary message is invalid.",
        "summary_context_invalid",
      );
    }

    const { role, content } = message as { role?: unknown; content?: unknown };
    const expectedRole: ChatMessage["role"] = index % 2 === 0 ? "user" : "assistant";

    if (role !== expectedRole || typeof content !== "string" || !content.trim()) {
      throw new InvalidSummaryRequestError(
        "The summary context order is invalid.",
        "summary_context_invalid",
      );
    }

    const trimmedContent = content.trim();

    if (trimmedContent.length > MAX_MESSAGE_LENGTH) {
      throw new InvalidSummaryRequestError(
        "A summary message is too large.",
        "summary_context_too_large",
      );
    }

    totalLength += trimmedContent.length;
    return { role: expectedRole, content: trimmedContent } satisfies ChatMessage;
  });

  if (totalLength > MAX_TOTAL_LENGTH) {
    throw new InvalidSummaryRequestError(
      "The summary context is too large.",
      "summary_context_too_large",
    );
  }

  return parsedMessages;
}
