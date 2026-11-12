"use client";

import { useRef, useState } from "react";

import { Composer } from "@/components/composer";
import { ConversationFlow } from "@/components/conversation-flow";
import {
  appendAnswerDelta,
  appendNode,
  buildChatMessages,
  completeNode,
  createChildBranch,
  createConversation,
  failNode,
  prepareNodeRetry,
  type BranchSide,
  type ChatNode,
  type ConversationState,
} from "@/lib/conversation";

const genericErrorCode = "generation_failed";

type BranchDraftState = {
  nodeId: string;
  side: BranchSide;
};

export function ChatExperience() {
  const [conversation, setConversation] = useState<ConversationState>(createConversation);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [branchDraft, setBranchDraft] = useState<BranchDraftState | null>(null);
  const nextNodeId = useRef(0);
  const nextBranchId = useRef(0);

  async function streamAnswer(targetConversation: ConversationState, nodeId: string) {
    setActiveNodeId(nodeId);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: buildChatMessages(targetConversation, nodeId) }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "The AI request failed.");
      }

      if (!response.body) {
        throw new Error("The AI response did not include a stream.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let receivedText = false;

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        const delta = decoder.decode(value, { stream: true });

        if (delta) {
          receivedText = true;
          setConversation((currentConversation) =>
            appendAnswerDelta(currentConversation, nodeId, delta),
          );
        }
      }

      const finalDelta = decoder.decode();

      if (finalDelta) {
        receivedText = true;
        setConversation((currentConversation) =>
          appendAnswerDelta(currentConversation, nodeId, finalDelta),
        );
      }

      if (!receivedText) {
        throw new Error("The AI returned an empty response.");
      }

      setConversation((currentConversation) => completeNode(currentConversation, nodeId));
    } catch {
      setConversation((currentConversation) =>
        failNode(currentConversation, nodeId, genericErrorCode),
      );
    } finally {
      setActiveNodeId(null);
    }
  }

  function addNode(question: string) {
    if (activeNodeId) {
      return;
    }

    const id = `node-${nextNodeId.current}`;
    const nextConversation = appendNode(conversation, {
      id,
      question,
      status: "pending",
    });

    setConversation(nextConversation);
    nextNodeId.current += 1;
    void streamAnswer(nextConversation, id);
  }

  function retryNode(nodeId: string) {
    if (activeNodeId) {
      return;
    }

    const retryConversation = prepareNodeRetry(conversation, nodeId);
    setConversation(retryConversation);
    void streamAnswer(retryConversation, nodeId);
  }

  function addChildBranch(originNodeId: string, side: BranchSide, question: string) {
    if (activeNodeId) {
      return;
    }

    const nodeId = `node-${nextNodeId.current}`;
    const branchId = `branch-${nextBranchId.current}`;
    const nextConversation = createChildBranch(conversation, {
      branchId,
      nodeId,
      originNodeId,
      side,
      question,
    });

    if (nextConversation === conversation) {
      return;
    }

    setConversation(nextConversation);
    setBranchDraft(null);
    nextNodeId.current += 1;
    nextBranchId.current += 1;
    void streamAnswer(nextConversation, nodeId);
  }

  function renderTipComposer(node: ChatNode) {
    return (
      <Composer
        id={`tip-prompt-${node.id}`}
        label="Ask a follow-up question"
        placeholder="Next question..."
        variant="embedded"
        autoFocus
        disabled={activeNodeId !== null}
        onSubmit={addNode}
      />
    );
  }

  return (
    <section className="chat-experience" aria-labelledby="page-title">
      <ConversationFlow
        conversation={conversation}
        renderComposer={renderTipComposer}
        onRetry={retryNode}
        branchDraft={branchDraft}
        onOpenBranchDraft={(nodeId, side) => setBranchDraft({ nodeId, side })}
        onCloseBranchDraft={() => setBranchDraft(null)}
        onSubmitBranchDraft={addChildBranch}
        branchSubmissionDisabled={activeNodeId !== null}
      />

      {conversation.nodes.length === 0 ? (
        <div className="empty-chat">
          <h1 id="page-title">BranchChat</h1>
          <Composer
            id="initial-prompt"
            label="Ask BranchChat a question"
            placeholder="Ask anything..."
            variant="standalone"
            autoFocus
            onSubmit={addNode}
          />
        </div>
      ) : (
        <>
          <h1 id="page-title" className="canvas-title">
            BranchChat
          </h1>
        </>
      )}
    </section>
  );
}
