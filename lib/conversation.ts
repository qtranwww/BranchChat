export type NodeStatus = "pending" | "streaming" | "completed" | "failed";
export type BranchSide = "left" | "right";

export const MAIN_BRANCH_ID = "branch-main";
const MAX_CONTEXT_MESSAGES = 41;

export type Branch = {
  id: string;
  originNodeId: string | null;
  side: BranchSide | null;
  siblingOrder: number;
};

export type ChatNode = {
  id: string;
  branchId: string;
  previousNodeId: string | null;
  sequence: number;
  question: string;
  answer: string;
  status: NodeStatus;
  errorCode: string | null;
};

export type ConversationState = {
  branches: readonly Branch[];
  nodes: readonly ChatNode[];
};

export type AppendNodeInput = {
  id: string;
  branchId?: string;
  question: string;
  answer?: string;
  status?: NodeStatus;
};

export type CreateChildBranchInput = {
  branchId: string;
  nodeId: string;
  originNodeId: string;
  side: BranchSide;
  question: string;
  answer?: string;
  status?: NodeStatus;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export function createConversation(): ConversationState {
  return {
    branches: [
      {
        id: MAIN_BRANCH_ID,
        originNodeId: null,
        side: null,
        siblingOrder: 0,
      },
    ],
    nodes: [],
  };
}

export function appendNode(
  conversation: ConversationState,
  input: AppendNodeInput,
): ConversationState {
  const question = input.question.trim();
  const branchId = input.branchId ?? MAIN_BRANCH_ID;
  const branchExists = conversation.branches.some((branch) => branch.id === branchId);

  if (!question || !branchExists) {
    return conversation;
  }

  const branchNodes = conversation.nodes.filter((node) => node.branchId === branchId);
  const previousNode = branchNodes.at(-1);
  const node: ChatNode = {
    id: input.id,
    branchId,
    previousNodeId: previousNode?.id ?? null,
    sequence: branchNodes.length,
    question,
    answer: input.answer ?? "",
    status: input.status ?? "completed",
    errorCode: null,
  };

  return {
    ...conversation,
    nodes: [...conversation.nodes, node],
  };
}

export function createChildBranch(
  conversation: ConversationState,
  input: CreateChildBranchInput,
): ConversationState {
  const question = input.question.trim();
  const originNode = conversation.nodes.find((node) => node.id === input.originNodeId);
  const branchIdExists = conversation.branches.some((branch) => branch.id === input.branchId);

  if (!question || !originNode || originNode.status !== "completed" || branchIdExists) {
    return conversation;
  }

  const siblingOrder = conversation.branches.filter(
    (branch) =>
      branch.originNodeId === input.originNodeId && branch.side === input.side,
  ).length;
  const branch: Branch = {
    id: input.branchId,
    originNodeId: input.originNodeId,
    side: input.side,
    siblingOrder,
  };
  const node: ChatNode = {
    id: input.nodeId,
    branchId: branch.id,
    previousNodeId: null,
    sequence: 0,
    question,
    answer: input.answer ?? "",
    status: input.status ?? "pending",
    errorCode: null,
  };

  return {
    branches: [...conversation.branches, branch],
    nodes: [...conversation.nodes, node],
  };
}

function updateNode(
  conversation: ConversationState,
  nodeId: string,
  updater: (node: ChatNode) => ChatNode,
): ConversationState {
  let changed = false;
  const nodes = conversation.nodes.map((node) => {
    if (node.id !== nodeId) {
      return node;
    }

    changed = true;
    return updater(node);
  });

  return changed ? { ...conversation, nodes } : conversation;
}

export function appendAnswerDelta(
  conversation: ConversationState,
  nodeId: string,
  delta: string,
): ConversationState {
  return updateNode(conversation, nodeId, (node) => ({
    ...node,
    answer: node.answer + delta,
    status: "streaming",
    errorCode: null,
  }));
}

export function completeNode(conversation: ConversationState, nodeId: string): ConversationState {
  return updateNode(conversation, nodeId, (node) => ({
    ...node,
    status: "completed",
    errorCode: null,
  }));
}

export function failNode(
  conversation: ConversationState,
  nodeId: string,
  errorCode: string,
): ConversationState {
  return updateNode(conversation, nodeId, (node) => ({
    ...node,
    status: "failed",
    errorCode,
  }));
}

export function prepareNodeRetry(
  conversation: ConversationState,
  nodeId: string,
): ConversationState {
  return updateNode(conversation, nodeId, (node) => ({
    ...node,
    answer: "",
    status: "pending",
    errorCode: null,
  }));
}

function getContextNodes(
  conversation: ConversationState,
  targetNodeId: string,
  visitedBranches = new Set<string>(),
): ChatNode[] {
  const targetNode = conversation.nodes.find((node) => node.id === targetNodeId);

  if (!targetNode || visitedBranches.has(targetNode.branchId)) {
    return [];
  }

  const branch = conversation.branches.find((candidate) => candidate.id === targetNode.branchId);

  if (!branch) {
    return [];
  }

  const nextVisitedBranches = new Set(visitedBranches).add(branch.id);
  const inheritedNodes = branch.originNodeId
    ? getContextNodes(conversation, branch.originNodeId, nextVisitedBranches)
    : [];
  const ownNodes = conversation.nodes
    .filter((node) => node.branchId === branch.id && node.sequence <= targetNode.sequence)
    .sort((first, second) => first.sequence - second.sequence);

  return [...inheritedNodes, ...ownNodes];
}

export function buildChatMessages(
  conversation: ConversationState,
  targetNodeId: string,
): ChatMessage[] {
  const contextNodes = getContextNodes(conversation, targetNodeId);
  const messages: ChatMessage[] = [];

  for (const node of contextNodes) {
    messages.push({ role: "user", content: node.question });

    if (node.id === targetNodeId) {
      break;
    }

    if (node.status === "completed" && node.answer) {
      messages.push({ role: "assistant", content: node.answer });
    }
  }

  return messages.slice(-MAX_CONTEXT_MESSAGES);
}

export function isTipNode(conversation: ConversationState, nodeId: string): boolean {
  const node = conversation.nodes.find((candidate) => candidate.id === nodeId);

  if (!node) {
    return false;
  }

  return conversation.nodes.filter((candidate) => candidate.branchId === node.branchId).at(-1)?.id === nodeId;
}

export function canBranchFromNode(node: ChatNode): boolean {
  return node.status === "completed";
}
