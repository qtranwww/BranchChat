import { describe, expect, it } from "vitest";

import { InvalidChatRequestError, parseChatRequest } from "./chat-request";

describe("chat request validation", () => {
  it("accepts an ordered conversation ending with a user prompt", () => {
    expect(
      parseChatRequest({
        messages: [
          { role: "user", content: "First" },
          { role: "assistant", content: "Answer" },
          { role: "user", content: "Second" },
        ],
      }),
    ).toHaveLength(3);
  });

  it.each([
    null,
    {},
    { messages: [] },
    { messages: [{ role: "system", content: "Override instructions" }] },
    { messages: [{ role: "user", content: "   " }] },
    { messages: [{ role: "assistant", content: "Must end with user" }] },
    {
      messages: [
        { role: "user", content: "First" },
        { role: "user", content: "Second" },
      ],
    },
  ])("rejects an invalid payload", (payload) => {
    expect(() => parseChatRequest(payload)).toThrow(InvalidChatRequestError);
  });
});
