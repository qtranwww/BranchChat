export type ChatNode = {
  id: string;
  sequence: number;
  question: string;
  answer: string;
};

export type ConversationState = {
  nodes: readonly ChatNode[];
};

export type AppendNodeInput = {
  id: string;
  question: string;
  answer: string;
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
    answer: input.answer,
  };

  return {
    nodes: [...conversation.nodes, node],
  };
}

export function isTipNode(conversation: ConversationState, nodeId: string): boolean {
  return conversation.nodes.at(-1)?.id === nodeId;
}
