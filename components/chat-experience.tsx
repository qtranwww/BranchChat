"use client";

import { useEffect, useRef, useState } from "react";

import { Composer } from "@/components/composer";
import { ConversationNode } from "@/components/conversation-node";
import {
  appendNode,
  createConversation,
  isTipNode,
  type ConversationState,
} from "@/lib/conversation";

const placeholderAnswer = "\\<answer zone\\>";

export function ChatExperience() {
  const [conversation, setConversation] = useState<ConversationState>(createConversation);
  const nextNodeId = useRef(0);
  const tipElement = useRef<HTMLDivElement>(null);

  function addNode(question: string) {
    const id = `node-${nextNodeId.current}`;

    setConversation((currentConversation) =>
      appendNode(currentConversation, {
        id,
        question,
        answer: placeholderAnswer,
      }),
    );

    nextNodeId.current += 1;
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
                  isTip={isTip}
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
