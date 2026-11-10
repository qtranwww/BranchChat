"use client";

import { useEffect, useRef, useState } from "react";

import { Composer } from "@/components/composer";
import { ConversationNode } from "@/components/conversation-node";
import {
  appendAnswerDelta,
  appendNode,
  buildChatMessages,
  completeNode,
  createConversation,
  failNode,
  isTipNode,
  prepareNodeRetry,
  type ConversationState,
} from "@/lib/conversation";

const genericErrorCode = "generation_failed";

export function ChatExperience() {
  const [conversation, setConversation] = useState<ConversationState>(createConversation);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const nextNodeId = useRef(0);
  const tipElement = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (conversation.nodes.length === 0) {
      return;
    }

    tipElement.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [conversation.nodes.length]);

  return (
    <section className="chat-experience" aria-labelledby="page-title">
      <h1 id="page-title">BranchChat</h1>

      {conversation.nodes.length === 0 ? (
        <Composer
          id="initial-prompt"
          label="Ask BranchChat a question"
          placeholder="Ask anything..."
          variant="standalone"
          autoFocus
          onSubmit={addNode}
        />
      ) : (
        <div className="conversation-stack">
          {conversation.nodes.map((node) => {
            const isTip = isTipNode(conversation, node.id);

            return (
              <div
                className="conversation-node-shell"
                data-sequence={node.sequence}
                key={node.id}
                ref={isTip ? tipElement : undefined}
              >
                <ConversationNode
                  question={node.question}
                  answer={node.answer}
                  status={node.status}
                  isTip={isTip}
                  onRetry={isTip ? () => retryNode(node.id) : undefined}
                  composer={
                    isTip ? (
                      <Composer
                        id={`tip-prompt-${node.id}`}
                        label="Ask a follow-up question"
                        placeholder="Next question..."
                        variant="embedded"
                        autoFocus
                        onSubmit={addNode}
                      />
                    ) : undefined
                  }
                />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
