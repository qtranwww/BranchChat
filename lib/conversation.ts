export type NodeStatus = "pending" | "streaming" | "completed" | "failed";
export type BranchSide = "left" | "right";
export type ContextMode = "full" | "summary_beta";

export const MAIN_BRANCH_ID = "branch-main";
const MAX_CONTEXT_MESSAGES = 41;
const MAX_CONTEXT_TOTAL_LENGTH = 40_000;
const MAX_COMBINED_MESSAGE_LENGTH = 16_500;
const MAX_FORK_SUMMARY_LENGTH = 12_000;
const SUMMARY_PREFIX = "Background summary from before this branch:\n---\n";
const SUMMARY_SUFFIX = "\n---\nContinue from this background:\n";
const SUMMARY_SEPARATOR = "\n\n--- Next branch background ---\n\n";

export type Branch = {
  id: string;
  originNodeId: string | null;
  side: BranchSide | null;
  siblingOrder: number;
  forkSummary: string | null;
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
  contextMode: ContextMode;
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

export function createConversation(contextMode: ContextMode = "full"): ConversationState {
  return {
    contextMode,
    branches: [
      {
        id: MAIN_BRANCH_ID,
        originNodeId: null,
        side: null,
        siblingOrder: 0,
        forkSummary: null,
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
    forkSummary: null,
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
    ...conversation,
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
    .sort((first, second) => first.sequence - second.sequence)
    .filter(
      (node) =>
        node.id === targetNodeId ||
        (node.status === "completed" && Boolean(node.answer.trim())),
    );

  return [...inheritedNodes, ...ownNodes];
}

function buildMessagesFromNodes(nodes: readonly ChatNode[], targetNodeId: string): ChatMessage[] {
  const messages: ChatMessage[] = [];

  for (const node of nodes) {
    messages.push({ role: "user", content: node.question });

    if (node.id === targetNodeId) {
      break;
    }

    if (node.status === "completed" && node.answer) {
      messages.push({ role: "assistant", content: node.answer });
    }
  }

  return messages;
}

function buildSummaryBranchMessages(
  conversation: ConversationState,
  targetNode: ChatNode,
  branch: Branch,
): ChatMessage[] {
  const ownNodes = conversation.nodes
    .filter((node) => node.branchId === branch.id && node.sequence <= targetNode.sequence)
    .sort((first, second) => first.sequence - second.sequence)
    .filter(
      (node) =>
        node.id === targetNode.id ||
        (node.status === "completed" && Boolean(node.answer.trim())),
    );
  const selectedNodes = [targetNode];
  let totalLength =
    SUMMARY_PREFIX.length +
    branch.forkSummary!.length +
    SUMMARY_SUFFIX.length +
    targetNode.question.length;

  for (let index = ownNodes.length - 2; index >= 0; index -= 1) {
    const node = ownNodes[index];
    const turnLength = node.question.length + node.answer.length;

    if (
      selectedNodes.length >= (MAX_CONTEXT_MESSAGES + 1) / 2 ||
      node.answer.length > MAX_COMBINED_MESSAGE_LENGTH ||
      totalLength + turnLength > MAX_CONTEXT_TOTAL_LENGTH
    ) {
      break;
    }

    selectedNodes.unshift(node);
    totalLength += turnLength;
  }

  const messages = buildMessagesFromNodes(selectedNodes, targetNode.id);
  const firstMessage = messages[0];

  if (!firstMessage) {
    return [];
  }

  const content = `${SUMMARY_PREFIX}${branch.forkSummary}${SUMMARY_SUFFIX}${firstMessage.content}`;

  if (content.length > MAX_COMBINED_MESSAGE_LENGTH) {
    return [];
  }

  messages[0] = { role: "user", content };
  return messages;
}

export function buildChatMessages(
  conversation: ConversationState,
  targetNodeId: string,
): ChatMessage[] {
  const targetNode = conversation.nodes.find((node) => node.id === targetNodeId);
  const branch = targetNode
    ? conversation.branches.find((candidate) => candidate.id === targetNode.branchId)
    : undefined;

  if (branch?.forkSummary && targetNode && branch.originNodeId) {
    return buildSummaryBranchMessages(conversation, targetNode, branch);
  }

  const contextNodes = getContextNodes(conversation, targetNodeId);
  return buildMessagesFromNodes(contextNodes, targetNodeId).slice(-MAX_CONTEXT_MESSAGES);
}

export function buildSummaryMessages(
  conversation: ConversationState,
  originNodeId: string,
): ChatMessage[] {
  const originNode = conversation.nodes.find((node) => node.id === originNodeId);

  if (!originNode) {
    return [];
  }

  const contextNodes = conversation.nodes
    .filter(
      (node) =>
        node.branchId === originNode.branchId &&
        node.sequence <= originNode.sequence &&
        node.status === "completed" &&
        Boolean(node.answer.trim()),
    )
    .sort((first, second) => first.sequence - second.sequence);

  return contextNodes
    .flatMap((node) => [
      { role: "user", content: node.question } as const,
      { role: "assistant", content: node.answer } as const,
    ]);
}

export function setBranchSummary(
  conversation: ConversationState,
  branchId: string,
  forkSummary: string,
): ConversationState {
  const summary = forkSummary.trim();

  if (!summary || conversation.contextMode !== "summary_beta") {
    return conversation;
  }

  const targetBranch = conversation.branches.find((branch) => branch.id === branchId);
  const originNode = targetBranch?.originNodeId
    ? conversation.nodes.find((node) => node.id === targetBranch.originNodeId)
    : undefined;
  const parentBranch = originNode
    ? conversation.branches.find((branch) => branch.id === originNode.branchId)
    : undefined;
  const inheritedSummary = parentBranch?.forkSummary?.trim();
  const combinedSummary = inheritedSummary
    ? `${inheritedSummary}${SUMMARY_SEPARATOR}${summary}`
    : summary;

  if (
    !targetBranch ||
    !originNode ||
    !parentBranch ||
    combinedSummary.length > MAX_FORK_SUMMARY_LENGTH
  ) {
    return conversation;
  }

  let changed = false;
  const branches = conversation.branches.map((branch) => {
    if (branch.id !== branchId || branch.originNodeId === null || branch.forkSummary) {
      return branch;
    }

    changed = true;
    return { ...branch, forkSummary: combinedSummary };
  });

  return changed ? { ...conversation, branches } : conversation;
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
