import { describe, expect, it } from "vitest";

import { appendNode, createConversation, isTipNode } from "./conversation";

const placeholderAnswer = "\\<answer zone\\>";

function appendQuestion(
  conversation: ReturnType<typeof createConversation>,
  id: string,
  question: string,
) {
  return appendNode(conversation, {
    id,
    question,
    answer: placeholderAnswer,
  });
}

describe("linear conversation", () => {
  it("starts without an empty node", () => {
    expect(createConversation().nodes).toEqual([]);
  });

  it("does not create a node for a whitespace-only prompt", () => {
    const conversation = createConversation();

    expect(appendQuestion(conversation, "node-0", "   \n ")).toBe(conversation);
  });

  it("appends exactly one node per valid prompt", () => {
    const conversation = appendQuestion(createConversation(), "node-0", "First question");

    expect(conversation.nodes).toHaveLength(1);
    expect(conversation.nodes[0]).toEqual({
      id: "node-0",
      sequence: 0,
      question: "First question",
      answer: placeholderAnswer,
    });
  });

  it("preserves prior nodes and chronological order", () => {
    const firstConversation = appendQuestion(createConversation(), "node-0", "First question");
    const firstNode = firstConversation.nodes[0];
    const secondConversation = appendQuestion(firstConversation, "node-1", "Second question");

    expect(secondConversation.nodes).toHaveLength(2);
    expect(secondConversation.nodes[0]).toBe(firstNode);
    expect(secondConversation.nodes.map((node) => node.question)).toEqual([
      "First question",
      "Second question",
    ]);
    expect(secondConversation.nodes.map((node) => node.sequence)).toEqual([0, 1]);
  });

  it("marks only the last node as the tip", () => {
    const firstConversation = appendQuestion(createConversation(), "node-0", "First question");
    const secondConversation = appendQuestion(firstConversation, "node-1", "Second question");

    expect(isTipNode(secondConversation, "node-0")).toBe(false);
    expect(isTipNode(secondConversation, "node-1")).toBe(true);
    expect(isTipNode(secondConversation, "missing-node")).toBe(false);
  });
});
