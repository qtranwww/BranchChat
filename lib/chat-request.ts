import type { ChatMessage } from "./conversation";

const MAX_MESSAGES = 41;
const MAX_MESSAGE_LENGTH = 4_000;
const MAX_TOTAL_LENGTH = 40_000;

export class InvalidChatRequestError extends Error {}

export function parseChatRequest(value: unknown): ChatMessage[] {
  if (!value || typeof value !== "object" || !("messages" in value)) {
    throw new InvalidChatRequestError("A messages array is required.");
  }

  const messages = (value as { messages?: unknown }).messages;

  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
    throw new InvalidChatRequestError("The conversation size is invalid.");
  }

  let totalLength = 0;
  const parsedMessages = messages.map((message, index) => {
    if (!message || typeof message !== "object") {
      throw new InvalidChatRequestError("A conversation message is invalid.");
    }

    const { role, content } = message as { role?: unknown; content?: unknown };

    if ((role !== "user" && role !== "assistant") || typeof content !== "string") {
      throw new InvalidChatRequestError("A conversation message is invalid.");
    }

    const expectedRole = index % 2 === 0 ? "user" : "assistant";

    if (role !== expectedRole) {
      throw new InvalidChatRequestError("The conversation order is invalid.");
    }

    const trimmedContent = content.trim();

    if (!trimmedContent || trimmedContent.length > MAX_MESSAGE_LENGTH) {
      throw new InvalidChatRequestError("A conversation message has an invalid length.");
    }

    totalLength += trimmedContent.length;
    return { role, content: trimmedContent } satisfies ChatMessage;
  });

  if (totalLength > MAX_TOTAL_LENGTH || parsedMessages.at(-1)?.role !== "user") {
    throw new InvalidChatRequestError("The conversation context is invalid.");
  }

  return parsedMessages;
}
