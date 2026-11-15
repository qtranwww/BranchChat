import type { Branch, ChatNode, ConversationState, NodeStatus } from "./conversation";
import { getLocalDatabase, type LocalDatabase } from "./local-database";

export type ConversationSnapshot = {
  id: string;
  title: string;
  conversation: ConversationState;
};

export type ConversationSummary = {
  id: string;
  title: string;
  nodeCount: number;
  updatedAt: string;
};

type ConversationRow = {
  id: string;
  title: string;
};

type BranchRow = {
  id: string;
  originNodeId: string | null;
  side: "left" | "right" | null;
  siblingOrder: number;
};

type NodeRow = {
  id: string;
  branchId: string;
  previousNodeId: string | null;
  sequence: number;
  question: string;
  answer: string;
  status: NodeStatus;
  errorCode: string | null;
};

export function saveConversationSnapshot(
  snapshot: ConversationSnapshot,
  database: LocalDatabase = getLocalDatabase(),
): void {
  const now = Date.now();

  database.transaction(() => {
    database.pragma("defer_foreign_keys = ON");
    database
      .prepare(
        `INSERT INTO conversations (id, title, created_at, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET title = excluded.title, updated_at = excluded.updated_at`,
      )
      .run(snapshot.id, snapshot.title, now, now);

    database.prepare("DELETE FROM nodes WHERE conversation_id = ?").run(snapshot.id);
    database.prepare("DELETE FROM branches WHERE conversation_id = ?").run(snapshot.id);

    const insertBranch = database.prepare(
      `INSERT INTO branches
       (conversation_id, id, origin_node_id, side, sibling_order, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    const insertNode = database.prepare(
      `INSERT INTO nodes
       (conversation_id, id, branch_id, previous_node_id, sequence, sort_order,
        question, answer, status, error_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    snapshot.conversation.branches.forEach((branch, index) => {
      insertBranch.run(
        snapshot.id,
        branch.id,
        branch.originNodeId,
        branch.side,
        branch.siblingOrder,
        index,
      );
    });

    snapshot.conversation.nodes.forEach((node, index) => {
      insertNode.run(
        snapshot.id,
        node.id,
        node.branchId,
        node.previousNodeId,
        node.sequence,
        index,
        node.question,
        node.answer,
        node.status,
        node.errorCode,
      );
    });
  })();
}

export function loadConversationSnapshot(
  id: string,
  database: LocalDatabase = getLocalDatabase(),
): ConversationSnapshot | null {
  database
    .prepare(
      `UPDATE nodes
       SET status = 'failed', error_code = 'interrupted'
       WHERE conversation_id = ? AND status IN ('pending', 'streaming')`,
    )
    .run(id);

  const conversation = database
    .prepare("SELECT id, title FROM conversations WHERE id = ?")
    .get(id) as ConversationRow | undefined;

  if (!conversation) {
    return null;
  }

  const branches = database
    .prepare(
      `SELECT id, origin_node_id AS originNodeId, side, sibling_order AS siblingOrder
       FROM branches WHERE conversation_id = ? ORDER BY sort_order`,
    )
    .all(id) as BranchRow[];
  const nodes = database
    .prepare(
      `SELECT id, branch_id AS branchId, previous_node_id AS previousNodeId,
              sequence, question, answer, status, error_code AS errorCode
       FROM nodes WHERE conversation_id = ? ORDER BY sort_order`,
    )
    .all(id) as NodeRow[];

  return {
    id: conversation.id,
    title: conversation.title,
    conversation: {
      branches: branches satisfies Branch[],
      nodes: nodes satisfies ChatNode[],
    },
  };
}

export function listConversationSummaries(
  database: LocalDatabase = getLocalDatabase(),
): ConversationSummary[] {
  const rows = database
    .prepare(
      `SELECT conversations.id, conversations.title,
              COUNT(nodes.id) AS nodeCount, conversations.updated_at AS updatedAt
       FROM conversations
       LEFT JOIN nodes ON nodes.conversation_id = conversations.id
       GROUP BY conversations.id
       ORDER BY conversations.updated_at DESC`,
    )
    .all() as Array<{
    id: string;
    title: string;
    nodeCount: number;
    updatedAt: number;
  }>;

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    nodeCount: row.nodeCount,
    updatedAt: new Date(row.updatedAt).toISOString(),
  }));
}

export function deleteConversation(
  id: string,
  database: LocalDatabase = getLocalDatabase(),
): boolean {
  return database.prepare("DELETE FROM conversations WHERE id = ?").run(id).changes === 1;
}
