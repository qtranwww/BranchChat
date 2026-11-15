import {
  MAIN_BRANCH_ID,
  type Branch,
  type BranchSide,
  type ChatNode,
  type ConversationState,
  type NodeStatus,
} from "./conversation";
import type { ConversationSnapshot } from "./conversation-storage";

const idPattern = /^[a-zA-Z0-9_-]{1,100}$/;
const statuses = new Set<NodeStatus>(["pending", "streaming", "completed", "failed"]);
const sides = new Set<BranchSide>(["left", "right"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readId(value: unknown): string | null {
  return typeof value === "string" && idPattern.test(value) ? value : null;
}

function parseBranch(value: unknown): Branch | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readId(value.id);
  const originNodeId = value.originNodeId === null ? null : readId(value.originNodeId);
  const side = value.side === null ? null : value.side;

  if (
    !id ||
    (value.originNodeId !== null && !originNodeId) ||
    (side !== null && !sides.has(side as BranchSide)) ||
    !Number.isInteger(value.siblingOrder) ||
    (value.siblingOrder as number) < 0
  ) {
    return null;
  }

  return {
    id,
    originNodeId,
    side: side as BranchSide | null,
    siblingOrder: value.siblingOrder as number,
  };
}

function parseNode(value: unknown): ChatNode | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readId(value.id);
  const branchId = readId(value.branchId);
  const previousNodeId = value.previousNodeId === null ? null : readId(value.previousNodeId);

  if (
    !id ||
    !branchId ||
    (value.previousNodeId !== null && !previousNodeId) ||
    !Number.isInteger(value.sequence) ||
    (value.sequence as number) < 0 ||
    typeof value.question !== "string" ||
    !value.question.trim() ||
    value.question.length > 4_000 ||
    typeof value.answer !== "string" ||
    value.answer.length > 40_000 ||
    typeof value.status !== "string" ||
    !statuses.has(value.status as NodeStatus) ||
    (value.errorCode !== null &&
      (typeof value.errorCode !== "string" || value.errorCode.length > 100))
  ) {
    return null;
  }

  return {
    id,
    branchId,
    previousNodeId,
    sequence: value.sequence as number,
    question: value.question,
    answer: value.answer,
    status: value.status as NodeStatus,
    errorCode: value.errorCode as string | null,
  };
}

function isStructurallyValid(conversation: ConversationState): boolean {
  const branchIds = new Set(conversation.branches.map((branch) => branch.id));
  const nodeIds = new Set(conversation.nodes.map((node) => node.id));

  if (
    branchIds.size !== conversation.branches.length ||
    nodeIds.size !== conversation.nodes.length
  ) {
    return false;
  }

  const mainBranches = conversation.branches.filter(
    (branch) => branch.originNodeId === null,
  );

  if (
    mainBranches.length !== 1 ||
    mainBranches[0].id !== MAIN_BRANCH_ID ||
    mainBranches[0].side !== null ||
    mainBranches[0].siblingOrder !== 0
  ) {
    return false;
  }

  for (const branch of conversation.branches) {
    if (branch.originNodeId !== null) {
      const origin = conversation.nodes.find((node) => node.id === branch.originNodeId);

      if (!origin || origin.status !== "completed" || branch.side === null) {
        return false;
      }
    }

    const branchNodes = conversation.nodes
      .filter((node) => node.branchId === branch.id)
      .sort((first, second) => first.sequence - second.sequence);

    for (let index = 0; index < branchNodes.length; index += 1) {
      if (
        branchNodes[index].sequence !== index ||
        branchNodes[index].previousNodeId !== (branchNodes[index - 1]?.id ?? null)
      ) {
        return false;
      }
    }
  }

  return conversation.nodes.every((node) => branchIds.has(node.branchId));
}

export function parseConversationSnapshot(
  value: unknown,
  expectedId: string,
): ConversationSnapshot | null {
  if (!isRecord(value) || value.id !== expectedId || !readId(value.id)) {
    return null;
  }

  if (
    typeof value.title !== "string" ||
    !value.title.trim() ||
    value.title.length > 120 ||
    !isRecord(value.conversation) ||
    !Array.isArray(value.conversation.branches) ||
    !Array.isArray(value.conversation.nodes) ||
    value.conversation.branches.length === 0 ||
    value.conversation.branches.length > 500 ||
    value.conversation.nodes.length > 2_000
  ) {
    return null;
  }

  const branches = value.conversation.branches.map(parseBranch);
  const nodes = value.conversation.nodes.map(parseNode);

  if (branches.some((branch) => branch === null) || nodes.some((node) => node === null)) {
    return null;
  }

  const conversation: ConversationState = {
    branches: branches as Branch[],
    nodes: nodes as ChatNode[],
  };

  return isStructurallyValid(conversation)
    ? { id: expectedId, title: value.title.trim(), conversation }
    : null;
}
