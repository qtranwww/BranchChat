export type NodeStatus = "pending" | "streaming" | "completed" | "failed";

export type ChatNode = {
  id: string;
  sequence: number;
  question: string;
  answer: string;
  status: NodeStatus;
  errorCode: string | null;
};

export type ConversationState = {
  nodes: readonly ChatNode[];
};

export type AppendNodeInput = {
  id: string;
  question: string;
  answer?: string;
  status?: NodeStatus;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export function createConversation(): ConversationState {
  return { nodes: [] };
}

export function appendNode(
  conversation: ConversationState,
  input: AppendNodeInput,
): ConversationState {
  const question = input.question.trim();

  if (!question) {
    return conversation;
  }

  const node: ChatNode = {
    id: input.id,
    sequence: conversation.nodes.length,
    question,
    answer: input.answer ?? "",
    status: input.status ?? "completed",
    errorCode: null,
  };

  return {
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

  return changed ? { nodes } : conversation;
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

export function buildChatMessages(
  conversation: ConversationState,
  targetNodeId: string,
): ChatMessage[] {
  const targetIndex = conversation.nodes.findIndex((node) => node.id === targetNodeId);

  if (targetIndex === -1) {
    return [];
  }

  const messages: ChatMessage[] = [];

  for (const node of conversation.nodes.slice(0, targetIndex + 1)) {
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

export function isTipNode(conversation: ConversationState, nodeId: string): boolean {
  return conversation.nodes.at(-1)?.id === nodeId;
}
