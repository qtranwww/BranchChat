import { afterEach, describe, expect, it } from "vitest";

import {
  appendNode,
  completeNode,
  createChildBranch,
  createConversation,
} from "./conversation";
import {
  deleteConversation,
  listConversationSummaries,
  loadConversationSnapshot,
  renameConversation,
  saveConversationSnapshot,
} from "./conversation-storage";
import { parseConversationSnapshot } from "./conversation-snapshot";
import { openLocalDatabase, type LocalDatabase } from "./local-database";

let database: LocalDatabase | null = null;

function getDatabase() {
  database = openLocalDatabase(":memory:");
  return database;
}

afterEach(() => {
  database?.close();
  database = null;
});

describe("local conversation storage", () => {
  it("saves and restores the exact branch tree", () => {
    const db = getDatabase();
    const mainPending = appendNode(createConversation(), {
      id: "node-0",
      question: "Main question",
      answer: "Main answer",
      status: "pending",
    });
    const mainCompleted = completeNode(mainPending, "node-0");
    const withChild = createChildBranch(mainCompleted, {
      branchId: "branch-0",
      nodeId: "node-1",
      originNodeId: "node-0",
      side: "left",
      question: "Side question",
      answer: "Side answer",
      status: "completed",
    });

    saveConversationSnapshot(
      { id: "conversation-1", title: "Main question", conversation: withChild },
      db,
    );
    saveConversationSnapshot(
      { id: "conversation-1", title: "Main question", conversation: withChild },
      db,
    );

    expect(loadConversationSnapshot("conversation-1", db)).toEqual({
      id: "conversation-1",
      title: "Main question",
      conversation: withChild,
    });
    expect(listConversationSummaries(db)).toMatchObject([
      { id: "conversation-1", title: "Main question", nodeCount: 2 },
    ]);
  });

  it("turns an interrupted generation into a retryable failure on load", () => {
    const db = getDatabase();
    const pending = appendNode(createConversation(), {
      id: "node-0",
      question: "Pending question",
      status: "pending",
    });

    saveConversationSnapshot(
      { id: "conversation-1", title: "Pending question", conversation: pending },
      db,
    );

    expect(loadConversationSnapshot("conversation-1", db)?.conversation.nodes[0]).toMatchObject({
      question: "Pending question",
      status: "failed",
      errorCode: "interrupted",
    });
  });

  it("keeps separate conversations isolated", () => {
    const db = getDatabase();
    const first = appendNode(createConversation(), {
      id: "node-0",
      question: "First",
      answer: "One",
    });
    const second = appendNode(createConversation(), {
      id: "node-0",
      question: "Second",
      answer: "Two",
    });

    saveConversationSnapshot({ id: "conversation-1", title: "First", conversation: first }, db);
    saveConversationSnapshot({ id: "conversation-2", title: "Second", conversation: second }, db);

    expect(loadConversationSnapshot("conversation-1", db)?.conversation.nodes[0].question).toBe(
      "First",
    );
    expect(loadConversationSnapshot("conversation-2", db)?.conversation.nodes[0].question).toBe(
      "Second",
    );
  });

  it("deletes a conversation and its tree", () => {
    const db = getDatabase();
    const conversation = appendNode(createConversation(), {
      id: "node-0",
      question: "Delete me",
      answer: "Gone",
    });

    saveConversationSnapshot(
      { id: "conversation-1", title: "Delete me", conversation },
      db,
    );

    expect(deleteConversation("conversation-1", db)).toBe(true);
    expect(loadConversationSnapshot("conversation-1", db)).toBeNull();
    expect(listConversationSummaries(db)).toEqual([]);
    expect(deleteConversation("conversation-1", db)).toBe(false);
  });

  it("renames a conversation without changing its tree", () => {
    const db = getDatabase();
    const conversation = appendNode(createConversation(), {
      id: "node-0",
      question: "Original question",
      answer: "Answer",
    });

    saveConversationSnapshot(
      { id: "conversation-1", title: "Original question", conversation },
      db,
    );

    expect(renameConversation("conversation-1", "A clearer title", db)).toBe(true);
    expect(loadConversationSnapshot("conversation-1", db)).toEqual({
      id: "conversation-1",
      title: "A clearer title",
      conversation,
    });
    expect(renameConversation("missing", "Unused", db)).toBe(false);
  });

  it("persists the selected context mode and keeps it immutable", () => {
    const db = getDatabase();
    const parent = appendNode(createConversation("summary_beta"), {
      id: "node-0",
      question: "Parent",
      answer: "Parent answer",
      status: "completed",
    });
    const child = createChildBranch(parent, {
      branchId: "branch-0",
      nodeId: "node-1",
      originNodeId: "node-0",
      side: "left",
      question: "Child",
    });
    saveConversationSnapshot(
      { id: "conversation-1", title: "Beta", conversation: child },
      db,
    );

    expect(loadConversationSnapshot("conversation-1", db)).toMatchObject({
      conversation: {
        contextMode: "summary_beta",
      },
    });
    expect(() =>
      saveConversationSnapshot(
        {
          id: "conversation-1",
          title: "Changed",
          conversation: { ...child, contextMode: "full" },
        },
        db,
      ),
    ).toThrow("context mode cannot be changed");
  });
});

describe("conversation snapshot validation", () => {
  it("accepts a valid snapshot and rejects mismatched or broken trees", () => {
    const conversation = appendNode(createConversation(), {
      id: "node-0",
      question: "Question",
      answer: "Answer",
    });
    const snapshot = {
      id: "conversation-1",
      title: "Question",
      conversation,
    };

    expect(parseConversationSnapshot(snapshot, "conversation-1")).toEqual(snapshot);
    expect(parseConversationSnapshot(snapshot, "conversation-2")).toBeNull();
    expect(
      parseConversationSnapshot(
        {
          ...snapshot,
          conversation: {
            ...conversation,
            nodes: [{ ...conversation.nodes[0], branchId: "missing-branch" }],
          },
        },
        "conversation-1",
      ),
    ).toBeNull();
  });
});
