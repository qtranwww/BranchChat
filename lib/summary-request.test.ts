import { describe, expect, it } from "vitest";

import { InvalidSummaryRequestError, parseSummaryRequest } from "./summary-request";

describe("summary request validation", () => {
  it("accepts complete conversation turns", () => {
    expect(
      parseSummaryRequest({
        messages: [
          { role: "user", content: "Question" },
          { role: "assistant", content: "Answer" },
        ],
      }),
    ).toEqual([
      { role: "user", content: "Question" },
      { role: "assistant", content: "Answer" },
    ]);
  });

  it.each([
    null,
    {},
    { messages: [] },
    { messages: [{ role: "user", content: "Incomplete" }] },
    {
      messages: [
        { role: "assistant", content: "Wrong" },
        { role: "user", content: "order" },
      ],
    },
  ])("rejects invalid summary context", (payload) => {
    expect(() => parseSummaryRequest(payload)).toThrow(InvalidSummaryRequestError);
  });

  it("reports oversized context separately", () => {
    try {
      parseSummaryRequest({
        messages: [
          { role: "user", content: "x".repeat(4_001) },
          { role: "assistant", content: "Answer" },
        ],
      });
      throw new Error("Expected the oversized summary request to be rejected.");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidSummaryRequestError);
      expect(error).toMatchObject({ code: "summary_context_too_large" });
    }
  });
});
