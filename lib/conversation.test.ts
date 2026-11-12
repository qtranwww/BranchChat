import { describe, expect, it } from "vitest";

import {
  appendAnswerDelta,
  appendNode,
  buildChatMessages,
  canBranchFromNode,
  completeNode,
  createChildBranch,
  createConversation,
  failNode,
  isTipNode,
  MAIN_BRANCH_ID,
  prepareNodeRetry,
} from "./conversation";

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
      branchId: MAIN_BRANCH_ID,
      previousNodeId: null,
      sequence: 0,
      question: "First question",
      answer: placeholderAnswer,
      status: "completed",
      errorCode: null,
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

  it("streams, completes, fails, and retries without replacing the question", () => {
    const pending = appendNode(createConversation(), {
      id: "node-0",
      question: "Keep this question",
      status: "pending",
    });
    const streaming = appendAnswerDelta(pending, "node-0", "Partial answer");
    const completed = completeNode(streaming, "node-0");
    const failed = failNode(completed, "node-0", "provider_error");
    const retried = prepareNodeRetry(failed, "node-0");

    expect(streaming.nodes[0]).toMatchObject({
      question: "Keep this question",
      answer: "Partial answer",
      status: "streaming",
    });
    expect(completed.nodes[0].status).toBe("completed");
    expect(failed.nodes[0]).toMatchObject({ status: "failed", errorCode: "provider_error" });
    expect(retried.nodes[0]).toMatchObject({
      question: "Keep this question",
      answer: "",
      status: "pending",
      errorCode: null,
    });
  });

  it("builds context from completed turns and the current prompt", () => {
    const first = appendQuestion(createConversation(), "node-0", "First question");
    const second = appendNode(first, {
      id: "node-1",
      question: "Second question",
      status: "pending",
    });

    expect(buildChatMessages(second, "node-1")).toEqual([
      { role: "user", content: "First question" },
      { role: "assistant", content: placeholderAnswer },
      { role: "user", content: "Second question" },
    ]);
  });

  it("creates a child branch and its first node without changing the parent branch", () => {
    const parentConversation = appendQuestion(
      createConversation(),
      "node-0",
      "Parent question",
    );
    const parentNode = parentConversation.nodes[0];
    const branchedConversation = createChildBranch(parentConversation, {
      branchId: "branch-0",
      nodeId: "node-1",
      originNodeId: parentNode.id,
      side: "left",
      question: "Branch question",
    });

    expect(branchedConversation.nodes[0]).toBe(parentNode);
    expect(branchedConversation.branches.at(-1)).toEqual({
      id: "branch-0",
      originNodeId: "node-0",
      side: "left",
      siblingOrder: 0,
    });
    expect(branchedConversation.nodes.at(-1)).toMatchObject({
      id: "node-1",
      branchId: "branch-0",
      previousNodeId: null,
      sequence: 0,
      question: "Branch question",
      status: "pending",
    });
  });

  it("assigns stable sibling order independently on each side", () => {
    const parentConversation = appendQuestion(
      createConversation(),
      "node-0",
      "Parent question",
    );
    const firstLeft = createChildBranch(parentConversation, {
      branchId: "branch-0",
      nodeId: "node-1",
      originNodeId: "node-0",
      side: "left",
      question: "First left",
    });
    const secondLeft = createChildBranch(firstLeft, {
      branchId: "branch-1",
      nodeId: "node-2",
      originNodeId: "node-0",
      side: "left",
      question: "Second left",
    });
    const firstRight = createChildBranch(secondLeft, {
      branchId: "branch-2",
      nodeId: "node-3",
      originNodeId: "node-0",
      side: "right",
      question: "First right",
    });

    expect(firstRight.branches.slice(1).map((branch) => branch.siblingOrder)).toEqual([
      0,
      1,
      0,
    ]);
  });

  it("uses the parent path through the origin as child branch context", () => {
    const first = appendQuestion(createConversation(), "node-0", "First parent question");
    const second = appendQuestion(first, "node-1", "Origin question");
    const child = createChildBranch(second, {
      branchId: "branch-0",
      nodeId: "node-2",
      originNodeId: "node-1",
      side: "right",
      question: "Child question",
    });

    expect(buildChatMessages(child, "node-2")).toEqual([
      { role: "user", content: "First parent question" },
      { role: "assistant", content: placeholderAnswer },
      { role: "user", content: "Origin question" },
      { role: "assistant", content: placeholderAnswer },
      { role: "user", content: "Child question" },
    ]);
    expect(isTipNode(child, "node-1")).toBe(true);
    expect(isTipNode(child, "node-2")).toBe(true);
  });

  it("continues a child branch without changing the parent branch tip", () => {
    const parent = appendQuestion(createConversation(), "node-0", "Parent question");
    const child = createChildBranch(parent, {
      branchId: "branch-0",
      nodeId: "node-1",
      originNodeId: "node-0",
      side: "left",
      question: "First child question",
      answer: "First child answer",
      status: "completed",
    });
    const continued = appendNode(child, {
      id: "node-2",
      branchId: "branch-0",
      question: "Second child question",
      status: "pending",
    });

    expect(continued.nodes.at(-1)).toMatchObject({
      id: "node-2",
      branchId: "branch-0",
      previousNodeId: "node-1",
      sequence: 1,
    });
    expect(isTipNode(continued, "node-0")).toBe(true);
    expect(isTipNode(continued, "node-1")).toBe(false);
    expect(isTipNode(continued, "node-2")).toBe(true);
    expect(buildChatMessages(continued, "node-2")).toEqual([
      { role: "user", content: "Parent question" },
      { role: "assistant", content: placeholderAnswer },
      { role: "user", content: "First child question" },
      { role: "assistant", content: "First child answer" },
      { role: "user", content: "Second child question" },
    ]);
  });

  it("allows branching only from completed nodes", () => {
    const completed = appendQuestion(createConversation(), "node-0", "Completed question");
    const pending = appendNode(createConversation(), {
      id: "node-1",
      question: "Pending question",
      status: "pending",
    });
    const streaming = appendAnswerDelta(pending, "node-1", "Partial answer");
    const failed = failNode(pending, "node-1", "provider_error");

    expect(canBranchFromNode(completed.nodes[0])).toBe(true);
    expect(canBranchFromNode(pending.nodes[0])).toBe(false);
    expect(canBranchFromNode(streaming.nodes[0])).toBe(false);
    expect(canBranchFromNode(failed.nodes[0])).toBe(false);
  });
});
